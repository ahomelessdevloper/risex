import "server-only";
import { cacheLife } from "next/cache";
import {
  CATEGORIES,
  DEPTH_BANDS,
  type BookStats,
  type Category,
  type DayVolume,
  type FundingHistory,
  type LeaderCategory,
  type Leaderboard,
  type LeaderWindow,
  type Market,
  type MarketVolume,
  type Overview,
  type SeriesPoint,
  type VolumeHistory,
} from "./types";

const API = "https://api.rise.trade/v1";
const LLAMA = "https://api.llama.fi";
const RPC = "https://rpc.risechain.com";
const USDC = "0xe436820ba0c69702c1d3e601d421c0ef38262739";
const COLLATERAL_MANAGER = "0x2c03c7d7e2974c6599b6b108879109281ef3f818";

const NS_PER_MS = 1_000_000;
const DAY_MS = 86_400_000;
/** RISEx mainnet trading start (first daily candle). */
const LAUNCH_MS = Date.UTC(2026, 3, 1);

interface RawMarket {
  market_id: string;
  display_name: string;
  category: string;
  config: { max_leverage: string; open_interest_limit: string };
  quote_volume_24h: string;
  change_24h: string;
  high_24h: string;
  low_24h: string;
  last_price: string;
  mark_price: string;
  index_price: string;
  open_interest: string;
  current_funding_rate: string;
  funding_interval: string;
  next_funding_time: string;
  active: boolean;
  is_new: boolean;
  reduce_only: boolean;
}

interface RawCandle {
  time: string;
  close: string;
  volume: string;
}

const num = (v: string | number | undefined | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toCategory = (raw: string): Category =>
  CATEGORIES.some((c) => c.key === raw) ? (raw as Category) : "other";

const symbolOf = (displayName: string) => displayName.split("/")[0].trim();

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`RISEx API ${path} responded ${res.status}`);
  const body = (await res.json()) as { data: T };
  return body.data;
}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return (await res.json()) as T;
}

/** Runs `fn` over `items` with at most `limit` requests in flight. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const fetchRawMarkets = () => api<{ markets: RawMarket[] }>("/markets").then((d) => d.markets);

function toMarket(m: RawMarket): Market {
  const price = num(m.last_price);
  const change = num(m.change_24h);
  const prev = price - change;
  const markPrice = num(m.mark_price);
  // The API reports long + short summed; halve it for the usual one-sided convention.
  const oiBase = num(m.open_interest) / 2;
  const oiLimit = num(m.config.open_interest_limit);
  const intervalHours = num(m.funding_interval) / NS_PER_MS / 3_600_000 || 1;
  const fundingRate = num(m.current_funding_rate);
  return {
    id: num(m.market_id),
    symbol: symbolOf(m.display_name),
    name: m.display_name,
    category: toCategory(m.category),
    price,
    markPrice,
    indexPrice: num(m.index_price),
    changePct: prev > 0 ? (change / prev) * 100 : 0,
    high24h: num(m.high_24h),
    low24h: num(m.low_24h),
    volume24h: num(m.quote_volume_24h),
    oiBase,
    oiUsd: oiBase * markPrice,
    oiCapUsed: oiLimit > 0 ? num(m.open_interest) / oiLimit : null,
    fundingRate,
    fundingIntervalHours: intervalHours,
    fundingApr: fundingRate * (8760 / intervalHours) * 100,
    nextFundingMs: num(m.next_funding_time) / NS_PER_MS,
    maxLeverage: num(m.config.max_leverage),
    isNew: m.is_new,
    reduceOnly: m.reduce_only,
  };
}

export async function getMarkets(): Promise<Market[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  const raw = await fetchRawMarkets();
  return raw.filter((m) => m.active).map(toMarket);
}

/** USDC held by the RISEx CollateralManager, read live from RISE chain. */
export async function getTvl(): Promise<number> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  const data = "0x70a08231" + COLLATERAL_MANAGER.slice(2).padStart(64, "0");
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: USDC, data }, "latest"],
    }),
  });
  const body = (await res.json()) as { result?: string; error?: { message: string } };
  if (!body.result) throw new Error(`RISE RPC: ${body.error?.message ?? "no result"}`);
  return Number(BigInt(body.result)) / 1e6;
}

/**
 * Daily USD volume since launch, built from each market's daily candles
 * (close × base volume — the same method DefiLlama uses for RISEx).
 */
export async function getVolumeHistory(): Promise<VolumeHistory> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });

  // Include delisted markets so history stays complete.
  const markets = await fetchRawMarkets();
  const now = Date.now();
  const from = BigInt(LAUNCH_MS) * BigInt(NS_PER_MS);
  const to = BigInt(now) * BigInt(NS_PER_MS);
  const interval = BigInt(DAY_MS) * BigInt(NS_PER_MS);

  const candles = await pool(markets, 8, (m) =>
    api<{ data: RawCandle[] }>(
      `/markets/id/${m.market_id}/trading-view-data?interval=${interval}&from=${from}&to=${to}`,
    ).then((d) => d.data ?? []),
  );

  const days = new Map<number, DayVolume>();
  const perMarket = new Map<string, MarketVolume>();
  const cut7 = now - 7 * DAY_MS;
  const cut30 = now - 30 * DAY_MS;

  // Delisted duplicates (e.g. an old DOGE market) fold into the live market for that symbol.
  const live = new Map(
    markets.filter((m) => m.active).map((m) => [symbolOf(m.display_name), m] as const),
  );

  markets.forEach((m, i) => {
    const symbol = symbolOf(m.display_name);
    const canonical = live.get(symbol) ?? m;
    const category = toCategory(canonical.category);
    const mv = perMarket.get(symbol) ?? {
      id: num(canonical.market_id),
      symbol,
      category,
      v7d: 0,
      v30d: 0,
      all: 0,
    };
    for (const c of candles[i]) {
      const t = num(c.time) / NS_PER_MS;
      const usd = num(c.close) * num(c.volume);
      if (!usd) continue;
      const day =
        days.get(t) ??
        ({ t, total: 0, crypto: 0, stocks: 0, commodity: 0, index_etf: 0, other: 0 } as DayVolume);
      day.total += usd;
      day[category] += usd;
      days.set(t, day);
      mv.all += usd;
      if (t + DAY_MS > cut30) mv.v30d += usd;
      if (t + DAY_MS > cut7) mv.v7d += usd;
    }
    if (m.active || mv.all > 0) perMarket.set(symbol, mv);
  });

  return {
    days: [...days.values()].sort((a, b) => a.t - b.t),
    markets: [...perMarket.values()].sort((a, b) => b.all - a.all),
  };
}

interface LlamaChart {
  totalDataChart: [number, number][];
}

/** Daily one-sided open interest, as tracked by DefiLlama. */
export async function getOiHistory(): Promise<SeriesPoint[]> {
  "use cache";
  cacheLife("hours");
  const d = await json<LlamaChart>(`${LLAMA}/summary/open-interest/risex`);
  // DefiLlama's first point predates the public launch; skip the warm-up dust.
  return d.totalDataChart.filter(([t]) => t * 1000 >= LAUNCH_MS).map(([t, v]) => ({ t: t * 1000, v }));
}

/** Daily TVL (collateral held by RISEx), as tracked by DefiLlama. */
export async function getTvlHistory(): Promise<SeriesPoint[]> {
  "use cache";
  cacheLife("hours");
  const d = await json<{
    chainTvls: Record<string, { tvl: { date: number; totalLiquidityUSD: number }[] }>;
  }>(`${LLAMA}/protocol/risex`);
  const byDay = new Map<number, number>();
  for (const series of Object.values(d.chainTvls)) {
    for (const p of series.tvl) {
      const day = Math.floor((p.date * 1000) / DAY_MS) * DAY_MS;
      byDay.set(day, (byDay.get(day) ?? 0) + p.totalLiquidityUSD);
    }
  }
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v }));
}

const settle = <T,>(p: Promise<T>): Promise<T | null> =>
  p.catch((err) => {
    console.error(err);
    return null;
  });

export async function getOverview(): Promise<Overview> {
  const [markets, tvl, volume, oiHistory, tvlHistory] = await Promise.all([
    getMarkets(),
    settle(getTvl()),
    settle(getVolumeHistory()),
    settle(getOiHistory()),
    settle(getTvlHistory()),
  ]);
  return {
    updatedAt: Date.now(),
    markets,
    tvl: tvl ?? tvlHistory?.at(-1)?.v ?? null,
    volume,
    oiHistory,
    tvlHistory,
  };
}

const LEADER_API_CATEGORY: Record<LeaderCategory, string> = {
  volume: "USER_VOLUME_CATEGORY_TRADED",
  fees: "USER_VOLUME_CATEGORY_TOTAL_FEE",
  liquidations: "USER_VOLUME_CATEGORY_LIQUIDATION",
};

interface RawLeader {
  rank: number;
  address: string;
  traded_volume: string;
  liquidation_volume: string;
  total_volume: string;
  total_fee: string;
  trade_count: number;
}

export async function getLeaderboard(
  window: LeaderWindow,
  category: LeaderCategory,
): Promise<Leaderboard> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  const d = await api<{ entries: RawLeader[] }>(
    `/stats/user-volume/leaderboard?window=${window}&limit=100&category=${LEADER_API_CATEGORY[category]}`,
  );
  return {
    window,
    category,
    entries: d.entries.map((e) => ({
      rank: e.rank,
      address: e.address,
      tradedVolume: num(e.traded_volume),
      liquidationVolume: num(e.liquidation_volume),
      totalVolume: num(e.total_volume),
      fees: num(e.total_fee),
      trades: e.trade_count,
    })),
  };
}

interface RawFunding {
  funding_rate: string;
  end_time: string;
}

/** Hourly funding settlements for the last 30 days. */
export async function getFundingHistory(marketId: number): Promise<FundingHistory> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  const start = BigInt(Date.now() - 30 * DAY_MS) * BigInt(NS_PER_MS);
  const d = await api<{ records: RawFunding[] }>(
    `/markets/id/${marketId}/funding-rate-history?start_time=${start}&limit=1000`,
  );
  const records = (d.records ?? [])
    .map((r) => ({ t: num(r.end_time) / NS_PER_MS, rate: num(r.funding_rate) }))
    .sort((a, b) => a.t - b.t);
  // Settlement spacing gives the interval; RISEx settles hourly today.
  const gaps = records.slice(1).map((r, i) => r.t - records[i].t).sort((a, b) => a - b);
  const intervalHours = gaps.length ? Math.max(gaps[Math.floor(gaps.length / 2)] / 3_600_000, 1 / 60) : 1;
  return {
    marketId,
    intervalHours,
    points: records.map((r) => ({ ...r, apr: r.rate * (8760 / intervalHours) * 100 })),
  };
}

interface RawLevel {
  price: string;
  quantity: string;
}

/** Spread and resting depth around mid for every live market. */
export async function getLiquidity(): Promise<BookStats[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  const markets = (await fetchRawMarkets()).filter((m) => m.active);
  const books = await pool(markets, 8, (m) =>
    api<{ bids: RawLevel[]; asks: RawLevel[] }>(`/orderbook?market_id=${m.market_id}&limit=250`).catch(
      () => null,
    ),
  );
  const out: BookStats[] = [];
  markets.forEach((m, i) => {
    const book = books[i];
    if (!book?.bids?.length || !book?.asks?.length) return;
    const bids = book.bids.map((l) => ({ p: num(l.price), q: num(l.quantity) }));
    const asks = book.asks.map((l) => ({ p: num(l.price), q: num(l.quantity) }));
    const bestBid = Math.max(...bids.map((l) => l.p));
    const bestAsk = Math.min(...asks.map((l) => l.p));
    const mid = (bestBid + bestAsk) / 2;
    if (!(mid > 0)) return;
    out.push({
      id: num(m.market_id),
      symbol: symbolOf(m.display_name),
      category: toCategory(m.category),
      mid,
      spreadBps: ((bestAsk - bestBid) / mid) * 10_000,
      depth: DEPTH_BANDS.map((band) => {
        const lo = mid * (1 - band / 100);
        const hi = mid * (1 + band / 100);
        return {
          band,
          bid: bids.filter((l) => l.p >= lo).reduce((s, l) => s + l.p * l.q, 0),
          ask: asks.filter((l) => l.p <= hi).reduce((s, l) => s + l.p * l.q, 0),
        };
      }),
      bidLevels: bids.length,
      askLevels: asks.length,
    });
  });
  return out;
}

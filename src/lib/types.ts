export type Category = "crypto" | "stocks" | "commodity" | "index_etf" | "other";

export const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: "crypto", label: "Crypto", color: "var(--series-1)" },
  { key: "stocks", label: "Stocks", color: "var(--series-2)" },
  { key: "commodity", label: "Commodities", color: "var(--series-3)" },
  { key: "index_etf", label: "Indices & ETFs", color: "var(--series-4)" },
  { key: "other", label: "Other", color: "var(--series-other)" },
];

export const categoryMeta = (key: Category) =>
  CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];

export interface Market {
  id: number;
  symbol: string;
  name: string;
  category: Category;
  price: number;
  markPrice: number;
  indexPrice: number;
  changePct: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  /** One-sided open interest in base units (the API reports long + short summed). */
  oiBase: number;
  /** One-sided open interest in USD at mark price. */
  oiUsd: number;
  /** Share of the market's open-interest cap in use (0–1), null when uncapped. */
  oiCapUsed: number | null;
  /** Funding rate for one funding interval. */
  fundingRate: number;
  fundingIntervalHours: number;
  /** Annualised funding, as a percentage. */
  fundingApr: number;
  nextFundingMs: number;
  maxLeverage: number;
  isNew: boolean;
  reduceOnly: boolean;
}

export type CategoryVolumes = Record<Category, number>;

export interface DayVolume extends CategoryVolumes {
  /** Start of the UTC day, ms. */
  t: number;
  total: number;
}

export interface MarketVolume {
  id: number;
  symbol: string;
  category: Category;
  v7d: number;
  v30d: number;
  all: number;
}

export interface VolumeHistory {
  days: DayVolume[];
  markets: MarketVolume[];
}

export interface SeriesPoint {
  t: number;
  v: number;
}

export interface Overview {
  updatedAt: number;
  markets: Market[];
  tvl: number | null;
  volume: VolumeHistory | null;
  oiHistory: SeriesPoint[] | null;
  tvlHistory: SeriesPoint[] | null;
}

export const LEADER_WINDOWS = ["24h", "7d", "2w"] as const;
export type LeaderWindow = (typeof LEADER_WINDOWS)[number];

export const LEADER_CATEGORIES = ["volume", "fees", "liquidations"] as const;
export type LeaderCategory = (typeof LEADER_CATEGORIES)[number];

export interface Trader {
  rank: number;
  address: string;
  tradedVolume: number;
  liquidationVolume: number;
  totalVolume: number;
  fees: number;
  trades: number;
}

export interface Leaderboard {
  window: LeaderWindow;
  category: LeaderCategory;
  entries: Trader[];
}

export interface FundingPoint {
  t: number;
  rate: number;
  apr: number;
}

export interface FundingHistory {
  marketId: number;
  intervalHours: number;
  points: FundingPoint[];
}

export interface PointsInfo {
  /** e.g. "Week 14 (19-25 Oct UTC)" */
  epochLabel: string | null;
  nextDropMs: number | null;
  weeklyPoints: number;
  dropsSoFar: number;
  distributedPoints: number;
  /** Weekly drops in a full Season 1 (it ends no later than Q2 2027). */
  seasonWeeks: number;
  seasonPoints: number;
}

export const DEPTH_BANDS = [0.5, 1, 2] as const;

export interface BookStats {
  id: number;
  symbol: string;
  category: Category;
  mid: number;
  spreadBps: number;
  /** USD notional resting within ±band% of mid, per side. */
  depth: { band: number; bid: number; ask: number }[];
  bidLevels: number;
  askLevels: number;
}

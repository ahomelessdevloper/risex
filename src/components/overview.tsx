"use client";

import { useState } from "react";
import { AreaSeries, StackedBars } from "./charts";
import { Card, Delta, FilterRow, Legend, Note, Segmented, StatTile } from "./ui";
import { count, day, pct, usd } from "@/lib/format";
import { CATEGORIES, categoryMeta, type Category, type DayVolume, type Overview as OverviewData, type SeriesPoint } from "@/lib/types";

const DAY = 86_400_000;
type Range = "30" | "90" | "all";
type Grain = "day" | "week";
type TopMetric = "vol24" | "oi" | "v30d" | "all";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const change = (a?: number, b?: number) => (a != null && b ? ((a - b) / b) * 100 : null);

/** Categories that actually carry volume, in fixed palette order. */
const activeCategories = (days: DayVolume[]) =>
  CATEGORIES.filter((c) => days.some((d) => d[c.key] > 0));

function toWeeks(days: DayVolume[]): DayVolume[] {
  const weeks = new Map<number, DayVolume>();
  for (const d of days) {
    // Weeks start Monday 00:00 UTC.
    const dow = (new Date(d.t).getUTCDay() + 6) % 7;
    const t = d.t - dow * DAY;
    const w = weeks.get(t) ?? { t, total: 0, crypto: 0, stocks: 0, commodity: 0, index_etf: 0, other: 0 };
    w.total += d.total;
    for (const c of CATEGORIES) w[c.key] += d[c.key];
    weeks.set(t, w);
  }
  return [...weeks.values()];
}

export function Overview({ data }: { data: OverviewData }) {
  const [range, setRange] = useState<Range>("90");
  const [grain, setGrain] = useState<Grain>("day");
  const [top, setTop] = useState<TopMetric>("vol24");

  const { markets, volume, oiHistory, tvlHistory } = data;
  const today = Math.floor(data.updatedAt / DAY) * DAY;
  const vol24 = sum(markets.map((m) => m.volume24h));
  const oi = sum(markets.map((m) => m.oiUsd));
  const fundingApr = oi ? sum(markets.map((m) => m.fundingApr * m.oiUsd)) / oi : null;

  const days = volume?.days ?? [];
  const complete = days.filter((d) => d.t < today);
  const lastN = (n: number) => sum(complete.filter((d) => d.t >= today - n * DAY).map((d) => d.total));
  const vol7 = lastN(7);
  const prev7 = sum(complete.filter((d) => d.t >= today - 14 * DAY && d.t < today - 7 * DAY).map((d) => d.total));
  const vol30 = lastN(30);
  const allTime = sum(days.map((d) => d.total));
  const yesterday = complete.at(-1);
  const dayBefore = complete.at(-2);
  const oiYesterday = oiHistory?.at(-2)?.v;
  const tvlWeekAgo = tvlHistory?.find((p) => p.t >= today - 7 * DAY)?.v;

  const from = range === "all" ? 0 : today - Number(range) * DAY;
  const inRange = <T extends { t: number }>(xs: T[]) => xs.filter((x) => x.t >= from);
  const shownDays = inRange(days);
  const bars = grain === "week" ? toWeeks(shownDays) : shownDays;
  const cumulative: SeriesPoint[] = [];
  let running = sum(days.filter((d) => d.t < from).map((d) => d.total));
  for (const d of shownDays) {
    running += d.total;
    cumulative.push({ t: d.t, v: running });
  }
  const series = activeCategories(days);

  const byCategory = CATEGORIES.map((c) => ({
    ...c,
    vol: sum(markets.filter((m) => m.category === c.key).map((m) => m.volume24h)),
    oi: sum(markets.filter((m) => m.category === c.key).map((m) => m.oiUsd)),
  })).filter((c) => c.vol > 0 || c.oi > 0);

  const histVol = new Map((volume?.markets ?? []).map((m) => [m.symbol, m]));
  const topRows = markets
    .map((m) => ({
      symbol: m.symbol,
      category: m.category,
      value:
        top === "vol24" ? m.volume24h
        : top === "oi" ? m.oiUsd
        : top === "v30d" ? (histVol.get(m.symbol)?.v30d ?? 0)
        : (histVol.get(m.symbol)?.all ?? 0),
    }))
    .sort((a, b) => b.value - a.value);
  const topTotal = sum(topRows.map((r) => r.value));
  const newCount = markets.filter((m) => m.isNew).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          hero
          className="col-span-2 lg:row-span-2 flex flex-col justify-between"
          label="Trading volume · rolling 24h"
          value={usd(vol24)}
          sub={
            <div className="flex flex-col gap-1">
              <span>
                Yesterday {usd(yesterday?.total)} <Delta value={change(yesterday?.total, dayBefore?.total)} suffix="d/d" />
              </span>
              <span className="text-muted">Sum of {markets.length} live markets · RISEx API</span>
            </div>
          }
        />
        <StatTile
          label="Open interest"
          value={usd(oi)}
          sub={<Delta value={change(oi, oiYesterday)} suffix="vs yesterday" />}
        />
        <StatTile
          label="TVL (onchain collateral)"
          value={usd(data.tvl)}
          sub={<Delta value={change(data.tvl ?? undefined, tvlWeekAgo)} suffix="7d" />}
        />
        <StatTile label="Volume · last 7 days" value={usd(vol7)} sub={<Delta value={change(vol7, prev7)} suffix="w/w" />} />
        <StatTile
          label="All-time volume"
          value={usd(allTime)}
          sub={days[0] ? `Since ${day(days[0].t, true)}` : undefined}
        />
        <StatTile label="Volume · last 30 days" value={usd(vol30)} sub={`${usd(vol30 / 30)} daily average`} />
        <StatTile
          label="Live markets"
          value={count(markets.length)}
          sub={`${newCount} new · OI/TVL ${data.tvl ? (oi / data.tvl).toFixed(2) : "—"}×`}
        />
        <StatTile
          label="Volume / open interest"
          value={oi ? `${(vol24 / oi).toFixed(2)}×` : "—"}
          sub="24h turnover of open positions"
        />
        <StatTile
          label="Funding APR · OI-weighted"
          value={pct(fundingApr, 1)}
          sub="Positive = longs pay shorts"
        />
      </div>

      <FilterRow>
        <Segmented
          label="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: "30", label: "30D" },
            { value: "90", label: "90D" },
            { value: "all", label: "All" },
          ]}
        />
        <Segmented
          label="Granularity"
          value={grain}
          onChange={setGrain}
          options={[
            { value: "day", label: "Daily" },
            { value: "week", label: "Weekly" },
          ]}
        />
      </FilterRow>

      <Card
        title={`${grain === "week" ? "Weekly" : "Daily"} volume by asset class`}
        subtitle="Close × base volume from each market's daily candles (UTC). Today is partial."
        table={{
          columns: [grain === "week" ? "Week of" : "Day", ...series.map((s) => s.label), "Total"],
          rows: [...bars].reverse().map((d) => [day(d.t, true), ...series.map((s) => usd(d[s.key])), usd(d.total)]),
        }}
      >
        <div className="mb-3">
          <Legend items={series} />
        </div>
        {volume ? (
          <StackedBars
            data={bars}
            series={series}
            labelFormat={(t) => (grain === "week" ? `Week of ${day(t, true)}` : day(t, true))}
          />
        ) : (
          <Note>Volume history is temporarily unavailable.</Note>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Cumulative volume"
          subtitle={`${usd(allTime)} traded since launch`}
          table={{ columns: ["Day", "Cumulative"], rows: [...cumulative].reverse().map((p) => [day(p.t, true), usd(p.v)]) }}
        >
          <AreaSeries data={cumulative} name="Cumulative volume" />
        </Card>
        <Card
          title="Open interest"
          subtitle="Daily, one-sided · via DefiLlama"
          table={{
            columns: ["Day", "Open interest"],
            rows: inRange(oiHistory ?? []).reverse().map((p) => [day(p.t, true), usd(p.v)]),
          }}
        >
          {oiHistory ? (
            <AreaSeries data={inRange(oiHistory)} name="Open interest" />
          ) : (
            <Note>Open interest history is temporarily unavailable.</Note>
          )}
        </Card>
        <Card
          title="TVL"
          subtitle="Collateral held by the RISEx CollateralManager · via DefiLlama"
          table={{
            columns: ["Day", "TVL"],
            rows: inRange(tvlHistory ?? []).reverse().map((p) => [day(p.t, true), usd(p.v)]),
          }}
        >
          {tvlHistory ? (
            <AreaSeries data={inRange(tvlHistory)} name="TVL" />
          ) : (
            <Note>TVL history is temporarily unavailable.</Note>
          )}
        </Card>
        <Card title="Asset class mix" subtitle="Share of rolling 24h volume and current open interest">
          <div className="flex flex-col gap-5">
            {(["vol", "oi"] as const).map((k) => {
              const total = sum(byCategory.map((c) => c[k]));
              return (
                <div key={k}>
                  <div className="mb-2 flex items-baseline justify-between text-xs">
                    <span className="text-ink-2">{k === "vol" ? "24h volume" : "Open interest"}</span>
                    <span className="font-semibold text-ink num">{usd(total)}</span>
                  </div>
                  <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={`${k === "vol" ? "Volume" : "Open interest"} by asset class`}>
                    {byCategory.map((c) =>
                      c[k] > 0 ? (
                        <div
                          key={c.key}
                          title={`${c.label}: ${usd(c[k])}`}
                          style={{ width: `${(c[k] / total) * 100}%`, background: c.color }}
                        />
                      ) : null,
                    )}
                  </div>
                  <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    {byCategory.map((c) => (
                      <li key={c.key} className="flex items-center gap-1.5 min-w-0">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.color }} aria-hidden />
                        <span className="truncate text-ink-2">{c.label}</span>
                        <span className="ml-auto font-medium text-ink num">{total ? ((c[k] / total) * 100).toFixed(1) : 0}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card
        title="Top markets"
        subtitle={
          top === "vol24" ? "Rolling 24h volume"
          : top === "oi" ? "Current one-sided open interest"
          : top === "v30d" ? "Volume over the last 30 full days"
          : "Volume since launch"
        }
        actions={
          <Segmented
            label="Rank markets by"
            size="sm"
            value={top}
            onChange={setTop}
            options={[
              { value: "vol24", label: "24h vol" },
              { value: "oi", label: "OI" },
              { value: "v30d", label: "30d vol" },
              { value: "all", label: "All-time" },
            ]}
          />
        }
      >
        <div className="mb-3">
          <Legend items={byCategory} />
        </div>
        <TopBars rows={topRows.slice(0, 15)} total={topTotal} />
      </Card>
    </div>
  );
}

function TopBars({ rows, total }: { rows: { symbol: string; category: Category; value: number }[]; total: number }) {
  const max = rows[0]?.value || 1;
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.symbol} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-xs" title={`${r.symbol}: ${usd(r.value)}`}>
          <span className="truncate font-medium text-ink">{r.symbol}</span>
          <div className="h-4">
            <div
              className="h-full rounded-r"
              style={{ width: `${Math.max((r.value / max) * 100, 0.5)}%`, background: categoryMeta(r.category).color }}
            />
          </div>
          <span className="w-28 text-right text-ink num">
            {usd(r.value)} <span className="text-muted">{total ? ((r.value / total) * 100).toFixed(1) : 0}%</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

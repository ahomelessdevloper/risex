"use client";

import { useState } from "react";
import { AreaSeries } from "./charts";
import { Card, ErrorBox, FilterRow, Note, StatTile } from "./ui";
import { countdown, dateTime, day, pct } from "@/lib/format";
import { useJson } from "@/lib/hooks";
import type { FundingHistory, Market } from "@/lib/types";

const DAY = 86_400_000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function Funding({ markets, now }: { markets: Market[]; now: number }) {
  const byOi = [...markets].sort((a, b) => b.oiUsd - a.oiUsd);
  const [marketId, setMarketId] = useState(byOi[0]?.id ?? 1);
  const selected = markets.find((m) => m.id === marketId);
  const history = useJson<FundingHistory>(`/api/funding/${marketId}`);

  const sorted = [...markets].sort((a, b) => b.fundingApr - a.fundingApr);
  const oiTotal = markets.reduce((s, m) => s + m.oiUsd, 0);
  const weighted = oiTotal ? markets.reduce((s, m) => s + m.fundingApr * m.oiUsd, 0) / oiTotal : null;
  const positive = markets.filter((m) => m.fundingRate > 0).length;
  const nextFunding = Math.min(...markets.map((m) => m.nextFundingMs).filter((t) => t > 0));

  // While another market loads, the previous one stays on screen, dimmed.
  const points = history.data?.points ?? [];
  const lastTs = points.at(-1)?.t ?? 0;
  const apr7 = avg(points.filter((p) => p.t > lastTs - 7 * DAY).map((p) => p.apr));
  const apr30 = avg(points.map((p) => p.apr));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="OI-weighted funding APR" value={pct(weighted, 1)} sub="Across all live markets" />
        <StatTile
          label="Markets where longs pay"
          value={`${positive} / ${markets.length}`}
          sub={`${markets.length - positive} with zero or negative funding`}
        />
        <StatTile
          label="Highest funding APR"
          value={sorted[0] ? pct(sorted[0].fundingApr, 1) : "—"}
          sub={sorted[0]?.symbol}
        />
        <StatTile
          label="Next settlement"
          value={now && Number.isFinite(nextFunding) ? countdown(nextFunding, now) : "—"}
          sub={`Every ${markets[0]?.fundingIntervalHours ?? 1}h`}
        />
      </div>

      <FilterRow>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Market
          <select
            value={marketId}
            onChange={(e) => setMarketId(Number(e.target.value))}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {byOi.map((m) => (
              <option key={m.id} value={m.id}>
                {m.symbol}
              </option>
            ))}
          </select>
        </label>
      </FilterRow>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={`${selected?.symbol ?? ""} funding history · annualised`}
          subtitle={`Hourly settlements, last 30 days · 7d avg ${pct(apr7, 1)} · 30d avg ${pct(apr30, 1)}`}
          table={{
            columns: ["Settled", "Rate", "APR"],
            rows: [...points].reverse().map((p) => [dateTime(p.t), pct(p.rate * 100, 4), pct(p.apr, 1)]),
          }}
        >
          {history.error ? (
            <ErrorBox message={`Could not load funding history: ${history.error}`} />
          ) : (
            <div className={`transition-opacity ${history.loading ? "opacity-50" : ""}`}>
              {points.length ? (
                <AreaSeries
                  data={points.map((p) => ({ t: p.t, v: p.apr }))}
                  name="Funding APR"
                  height={420}
                  fill={false}
                  zeroLine
                  curve="linear"
                  format={(v) => pct(v, 2)}
                  tickFormat={(v) => `${v.toFixed(0)}%`}
                  labelFormat={dateTime}
                  tickLabel={(t) => day(t)}
                />
              ) : (
                <div className="h-[420px]" />
              )}
            </div>
          )}
        </Card>

        <Card
          title="Current funding by market"
          subtitle="Annualised · positive = longs pay shorts"
          table={{
            columns: ["Market", "Rate (1h)", "APR"],
            rows: sorted.map((m) => [m.symbol, pct(m.fundingRate * 100, 4), pct(m.fundingApr, 1)]),
          }}
        >
          <DivergingBars rows={sorted.map((m) => ({ label: m.symbol, value: m.fundingApr }))} />
        </Card>
      </div>
      <Note>
        APR = per-interval rate × intervals per year. Rates come from RISEx&apos;s funding settlements (FundingRate
        contract events) via the RISEx API.
      </Note>
    </div>
  );
}

/** Horizontal bars from a centre line: blue for negative, red for positive. */
function DivergingBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--diverge-neg)" }} aria-hidden />
          Shorts pay
        </span>
        <span className="flex items-center gap-1.5">
          Longs pay
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--diverge-pos)" }} aria-hidden />
        </span>
      </div>
      <ol className="flex max-h-[420px] flex-col gap-1 overflow-y-auto pr-1">
        {rows.map((r) => {
          const w = (Math.abs(r.value) / max) * 50;
          const pos = r.value >= 0;
          return (
            <li
              key={r.label}
              className="grid grid-cols-[3.75rem_1fr_3.75rem] items-center gap-2 text-xs"
              title={`${r.label}: ${pct(r.value, 2)} APR`}
            >
              <span className="truncate font-medium text-ink">{r.label}</span>
              <div className="relative h-3">
                <div className="absolute inset-y-0 left-1/2 w-px bg-grid" />
                <div
                  className={`absolute inset-y-0 ${pos ? "rounded-r" : "rounded-l"}`}
                  style={{
                    width: `${Math.max(w, r.value ? 0.6 : 0)}%`,
                    [pos ? "left" : "right"]: "50%",
                    background: pos ? "var(--diverge-pos)" : "var(--diverge-neg)",
                  }}
                />
              </div>
              <span className="text-right text-ink-2 num">{pct(r.value, 1)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

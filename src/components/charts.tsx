"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { day, usd, usdTick } from "@/lib/format";

const tick = { fill: "var(--muted)", fontSize: 11 };

/** Round axis ticks (steps of 1, 2, 2.5 or 5 × 10^n) spanning [min, max], always including 0. */
function niceTicks(min: number, max: number, count = 4): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (hi === lo) return [0];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw * 0.8)!;
  const ticks: number[] = [];
  for (let v = Math.floor(lo / step) * step; v < hi + step - 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

export interface SeriesDef<K extends string> {
  key: K;
  label: string;
  color: string;
}

function TooltipBox({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { label: string; value: string; color: string }[];
  total?: string;
}) {
  return (
    <div className="min-w-44 rounded-xl border border-line bg-[var(--surface-solid)]/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1.5 text-muted">{title}</div>
      {total && (
        <div className="mb-1 flex items-baseline justify-between gap-4">
          <span className="text-sm font-semibold text-ink num">{total}</span>
          <span className="text-ink-2">Total</span>
        </div>
      )}
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} aria-hidden />
            <span className="font-semibold text-ink num">{r.value}</span>
          </span>
          <span className="text-ink-2">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Stacked columns over time, one stack segment per series. */
export function StackedBars<K extends string, T extends { t: number } & Record<K, number>>({
  data,
  series,
  height = 280,
  labelFormat = (t) => day(t, true),
}: {
  data: T[];
  series: SeriesDef<K>[];
  height?: number;
  labelFormat?: (t: number) => string;
}) {
  const dense = data.length > 45;
  const ticks = niceTicks(0, Math.max(0, ...data.map((d) => series.reduce((s, x) => s + (d[x.key] || 0), 0))));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={dense ? 1 : "20%"}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="t"
          tickFormatter={(t) => day(t)}
          tick={tick}
          tickLine={false}
          axisLine={{ stroke: "var(--axis)" }}
          minTickGap={28}
        />
        <YAxis
          tickFormatter={usdTick}
          ticks={ticks}
          domain={[ticks[0], ticks.at(-1)!]}
          tick={tick}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ fill: "var(--wash)" }}
          isAnimationActive={false}
          content={(p) => {
            if (!p.active || !p.payload?.length) return null;
            const row = p.payload[0].payload as T;
            const visible = series.filter((s) => row[s.key] > 0);
            return (
              <TooltipBox
                title={labelFormat(row.t)}
                total={usd(series.reduce((s, x) => s + (row[x.key] || 0), 0))}
                rows={[...visible].reverse().map((s) => ({ label: s.label, color: s.color, value: usd(row[s.key]) }))}
              />
            );
          }}
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="stack"
            fill={s.color}
            maxBarSize={24}
            stroke="var(--surface-solid)"
            strokeWidth={dense ? 0 : 1}
            radius={i === series.length - 1 && !dense ? [3, 3, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A single series over time: a 2px line over a 10% wash. */
export function AreaSeries({
  data,
  name,
  height = 220,
  color = "var(--series-1)",
  format = (v: number) => usd(v),
  tickFormat = usdTick,
  labelFormat = (t: number) => day(t, true),
  tickLabel = (t: number) => day(t),
  zeroLine = false,
  fill = true,
  curve = "monotone",
}: {
  data: { t: number; v: number }[];
  name: string;
  height?: number;
  color?: string;
  format?: (v: number) => string;
  tickFormat?: (v: number) => string;
  labelFormat?: (t: number) => string;
  tickLabel?: (t: number) => string;
  zeroLine?: boolean;
  fill?: boolean;
  curve?: "monotone" | "linear" | "stepAfter";
}) {
  const values = data.map((d) => d.v);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="t"
          tickFormatter={tickLabel}
          tick={tick}
          tickLine={false}
          axisLine={{ stroke: "var(--axis)" }}
          minTickGap={28}
        />
        <YAxis
          tickFormatter={tickFormat}
          ticks={ticks}
          domain={[ticks[0], ticks.at(-1)!]}
          tick={tick}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        {zeroLine && <ReferenceLine y={0} stroke="var(--axis)" />}
        <Tooltip
          cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
          isAnimationActive={false}
          content={(p) => {
            if (!p.active || !p.payload?.length) return null;
            const pt = p.payload[0].payload as { t: number; v: number };
            return <TooltipBox title={labelFormat(pt.t)} rows={[{ label: name, value: format(pt.v), color }]} />;
          }}
        />
        <Area
          type={curve}
          dataKey="v"
          name={name}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={color}
          fillOpacity={fill ? 0.1 : 0}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: "var(--surface-solid)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

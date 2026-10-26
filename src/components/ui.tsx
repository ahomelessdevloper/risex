"use client";

import { useState, type ReactNode } from "react";
import { pct } from "@/lib/format";

export function Card({
  title,
  subtitle,
  actions,
  table,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** A table-view twin of the chart; adds a Chart/Table toggle to the header. */
  table?: { columns: string[]; rows: ReactNode[][] };
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`glass-card rounded-2xl border border-line bg-surface p-4 sm:p-5 min-w-0 ${className}`}>
      {(title || actions || table) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {table && (
              <Segmented
                label="View"
                size="sm"
                value={showTable ? "table" : "chart"}
                onChange={(v) => setShowTable(v === "table")}
                options={[
                  { value: "chart", label: "Chart" },
                  { value: "table", label: "Table" },
                ]}
              />
            )}
          </div>
        </header>
      )}
      {table && showTable ? <DataTable columns={table.columns} rows={table.rows} /> : children}
    </section>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-line">
      <table className="w-full text-xs num">
        <thead className="sticky top-0 bg-[var(--surface-solid)] text-muted">
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={`px-3 py-2 font-medium ${i ? "text-right" : "text-left"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((cell, j) => (
                <td key={j} className={`px-3 py-1.5 ${j ? "text-right text-ink" : "text-left text-ink-2"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  hero = false,
  className = "",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  hero?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`glass-card rounded-2xl border border-line bg-surface p-4 min-w-0 ${hero ? "hero-glow" : ""} ${className}`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div
        className={`mt-1 font-semibold tracking-tight ${hero ? "text-gradient text-5xl sm:text-6xl" : "text-2xl text-ink"}`}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

/** Signed change with an arrow, so direction never relies on color alone. */
export function Delta({ value, digits = 2, suffix }: { value: number | null; digits?: number; suffix?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-muted">—</span>;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span className={`num whitespace-nowrap ${flat ? "text-muted" : up ? "text-up" : "text-down"}`}>
      {flat ? "" : up ? "▲ " : "▼ "}
      {pct(value, digits)}
      {suffix && <span className="text-muted"> {suffix}</span>}
    </span>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-black/25 p-0.5 backdrop-blur">

      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-lg font-medium transition-colors ${
              size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
            } ${active ? "bg-white/12 text-ink shadow-sm ring-1 ring-white/15" : "text-muted hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** A thin meter; the unfilled track is a lighter step of the same hue. */
export function Meter({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--meter-track)" }}
    >
      <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: "var(--meter-fill)" }} />
    </div>
  );
}

export function FilterRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted">{children}</p>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-line bg-wash px-3 py-2 text-sm text-ink-2" role="alert">
      <span aria-hidden>⚠ </span>
      {message}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Delta, FilterRow, Meter, Note, Segmented } from "./ui";
import { countdown, pct, price, usd } from "@/lib/format";
import { CATEGORIES, categoryMeta, type Category, type Market } from "@/lib/types";

type SortKey = "volume24h" | "oiUsd" | "changePct" | "fundingApr" | "oiCapUsed" | "maxLeverage" | "symbol";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "symbol", label: "Market" },
  { key: "changePct", label: "24h" },
  { key: "volume24h", label: "24h volume" },
  { key: "oiUsd", label: "Open interest" },
  { key: "oiCapUsed", label: "OI cap used", className: "hidden md:table-cell" },
  { key: "fundingApr", label: "Funding (1h · APR)" },
  { key: "maxLeverage", label: "Max lev.", className: "hidden sm:table-cell" },
];

export function Markets({ markets, now }: { markets: Market[]; now: number }) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "volume24h", desc: true });

  const present = CATEGORIES.filter((c) => markets.some((m) => m.category === c.key));
  const q = query.trim().toLowerCase();
  const rows = markets
    .filter((m) => (category === "all" || m.category === category) && (!q || m.symbol.toLowerCase().includes(q)))
    .sort((a, b) => {
      const dir = sort.desc ? -1 : 1;
      if (sort.key === "symbol") return a.symbol.localeCompare(b.symbol) * dir;
      return ((a[sort.key] ?? -1) - (b[sort.key] ?? -1)) * dir;
    });

  const totalVol = rows.reduce((s, m) => s + m.volume24h, 0);
  const totalOi = rows.reduce((s, m) => s + m.oiUsd, 0);
  const nextFunding = Math.min(...markets.map((m) => m.nextFundingMs).filter((t) => t > 0));

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "symbol" }));

  return (
    <div className="flex flex-col gap-4">
      <FilterRow>
        <Segmented
          label="Asset class"
          value={category}
          onChange={setCategory}
          options={[{ value: "all", label: "All" }, ...present.map((c) => ({ value: c.key, label: c.label }))]}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search market"
          aria-label="Search market"
          className="h-8 w-40 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="ml-auto text-xs text-muted num">
          Next funding in {now && Number.isFinite(nextFunding) ? countdown(nextFunding, now) : "—"}
        </span>
      </FilterRow>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                {COLUMNS.map((c, i) => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined}
                    className={`px-3 py-2.5 font-medium whitespace-nowrap ${i ? "text-right" : "text-left"} ${c.className ?? ""}`}
                  >
                    <button type="button" onClick={() => onSort(c.key)} className="hover:text-ink">
                      {c.label}
                      <span className="ml-1 inline-block w-2" aria-hidden>
                        {sort.key === c.key ? (sort.desc ? "↓" : "↑") : ""}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0 hover:bg-wash">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: categoryMeta(m.category).color }}
                        title={categoryMeta(m.category).label}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium text-ink">
                          {m.symbol}
                          {m.isNew && (
                            <span className="rounded border border-line px-1 text-[10px] font-medium text-ink-2">NEW</span>
                          )}
                          {m.reduceOnly && (
                            <span className="rounded border border-line px-1 text-[10px] font-medium text-ink-2">
                              REDUCE-ONLY
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted">${price(m.price)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Delta value={m.changePct} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink">{usd(m.volume24h)}</td>
                  <td className="px-3 py-2.5 text-right text-ink">{usd(m.oiUsd)}</td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {m.oiCapUsed == null ? (
                      <span className="block text-right text-muted">—</span>
                    ) : (
                      <div className="ml-auto flex w-28 items-center gap-2">
                        <Meter value={m.oiCapUsed} label={`${m.symbol} open interest cap used`} />
                        <span className="w-9 text-right text-xs text-ink-2">{(m.oiCapUsed * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="text-ink">{pct(m.fundingRate * 100, 4)}</span>
                    <span className="ml-2 text-xs text-muted">{pct(m.fundingApr, 1)}</span>
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-ink-2 sm:table-cell">{m.maxLeverage}×</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line text-xs text-ink-2 num">
                <td className="px-3 py-2.5 font-medium">{rows.length} markets</td>
                <td />
                <td className="px-3 py-2.5 text-right font-semibold text-ink">{usd(totalVol)}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-ink">{usd(totalOi)}</td>
                <td className="hidden md:table-cell" />
                <td />
                <td className="hidden sm:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      <Note>
        Open interest is one-sided (the API reports long + short summed, halved here) and valued at mark price. OI cap
        used compares the API&apos;s reported open interest with each market&apos;s open-interest limit. Funding is the
        current per-interval rate; positive means longs pay shorts.
      </Note>
    </div>
  );
}

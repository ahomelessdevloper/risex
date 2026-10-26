"use client";

import { useState } from "react";
import { Card, ErrorBox, FilterRow, Legend, Note, Segmented, StatTile } from "./ui";
import { price, usd } from "@/lib/format";
import { useJson } from "@/lib/hooks";
import { DEPTH_BANDS, categoryMeta, type BookStats } from "@/lib/types";

type Band = (typeof DEPTH_BANDS)[number];

const BID = { label: "Bids", color: "var(--series-1)" };
const ASK = { label: "Asks", color: "var(--series-2)" };

const depthAt = (b: BookStats, band: Band) => b.depth.find((d) => d.band === band) ?? { band, bid: 0, ask: 0 };
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

export function Liquidity() {
  const [band, setBand] = useState<Band>(1);
  const { data, error } = useJson<BookStats[]>("/api/liquidity", { refreshMs: 30_000 });
  const books = data ?? [];

  const rows = [...books].sort((a, b) => {
    const da = depthAt(a, band);
    const db = depthAt(b, band);
    return db.bid + db.ask - (da.bid + da.ask);
  });
  const total = rows.reduce((s, b) => s + depthAt(b, band).bid + depthAt(b, band).ask, 0);
  const btc = books.find((b) => b.symbol === "BTC");
  const eth = books.find((b) => b.symbol === "ETH");
  const top = rows.slice(0, 15);
  const max = Math.max(...top.map((b) => depthAt(b, band).bid + depthAt(b, band).ask), 1);

  return (
    <div className="flex flex-col gap-4">
      <FilterRow>
        <Segmented
          label="Depth band around mid"
          value={String(band) as `${Band}`}
          onChange={(v) => setBand(Number(v) as Band)}
          options={DEPTH_BANDS.map((b) => ({ value: String(b) as `${Band}`, label: `±${b}%` }))}
        />
      </FilterRow>

      {error && <ErrorBox message={`Could not load order books: ${error}`} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={`Resting depth ±${band}%`} value={usd(total)} sub={`Bids + asks across ${books.length} books`} />
        <StatTile
          label="Median spread"
          value={books.length ? `${median(books.map((b) => b.spreadBps))!.toFixed(2)} bps` : "—"}
          sub="Best ask − best bid, over mid"
        />
        <StatTile
          label={`BTC depth ±${band}%`}
          value={btc ? usd(depthAt(btc, band).bid + depthAt(btc, band).ask) : "—"}
          sub={btc ? `Spread ${btc.spreadBps.toFixed(2)} bps` : undefined}
        />
        <StatTile
          label={`ETH depth ±${band}%`}
          value={eth ? usd(depthAt(eth, band).bid + depthAt(eth, band).ask) : "—"}
          sub={eth ? `Spread ${eth.spreadBps.toFixed(2)} bps` : undefined}
        />
      </div>

      <Card
        title={`Deepest books · ±${band}% of mid`}
        subtitle="USD notional resting on each side · refreshes every 30s"
        table={{
          columns: ["Market", "Bids", "Asks", "Total"],
          rows: rows.map((b) => {
            const d = depthAt(b, band);
            return [b.symbol, usd(d.bid), usd(d.ask), usd(d.bid + d.ask)];
          }),
        }}
      >
        <div className="mb-3">
          <Legend items={[BID, ASK]} />
        </div>
        <ol className="flex flex-col gap-1.5">
          {top.map((b) => {
            const d = depthAt(b, band);
            return (
              <li
                key={b.id}
                className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-3 text-xs"
                title={`${b.symbol}: bids ${usd(d.bid)} · asks ${usd(d.ask)}`}
              >
                <span className="truncate font-medium text-ink">{b.symbol}</span>
                <div className="flex h-4 gap-[2px]" style={{ width: `${Math.max(((d.bid + d.ask) / max) * 100, 0.5)}%` }}>
                  {d.bid > 0 && <div className="h-full" style={{ flexGrow: d.bid, background: BID.color }} />}
                  {d.ask > 0 && <div className="h-full rounded-r" style={{ flexGrow: d.ask, background: ASK.color }} />}
                </div>
                <span className="text-right text-ink num">{usd(d.bid + d.ask)}</span>
              </li>
            );
          })}
          {!books.length && !error && <li className="py-10 text-center text-sm text-muted">Loading order books…</li>}
        </ol>
      </Card>

      <section className="glass-card overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th scope="col" className="px-3 py-2.5 text-left font-medium">Market</th>
                <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Mid</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Spread</th>
                {DEPTH_BANDS.map((x) => (
                  <th key={x} scope="col" className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    ±{x}%
                  </th>
                ))}
                <th scope="col" className="hidden px-3 py-2.5 text-right font-medium whitespace-nowrap md:table-cell">
                  Bid share ±{band}%
                </th>
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((b) => {
                const d = depthAt(b, band);
                return (
                  <tr key={b.id} className="border-b border-line last:border-0 hover:bg-wash">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ background: categoryMeta(b.category).color }}
                          aria-hidden
                        />
                        {b.symbol}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 text-right text-ink-2 sm:table-cell">${price(b.mid)}</td>
                    <td className="px-3 py-2 text-right text-ink">{b.spreadBps.toFixed(2)} bps</td>
                    {DEPTH_BANDS.map((x) => {
                      const dx = depthAt(b, x);
                      return (
                        <td key={x} className={`px-3 py-2 text-right ${x === band ? "text-ink" : "text-ink-2"}`}>
                          {usd(dx.bid + dx.ask)}
                        </td>
                      );
                    })}
                    <td className="hidden px-3 py-2 text-right text-ink-2 md:table-cell">
                      {d.bid + d.ask ? `${((d.bid / (d.bid + d.ask)) * 100).toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <Note>
        Snapshot of each market&apos;s order book (up to 250 price levels per side) from the RISEx API. Depth is
        the USD value of resting orders within the band around the mid price.
      </Note>
    </div>
  );
}

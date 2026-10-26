"use client";

import { useState } from "react";
import { ErrorBox, FilterRow, Meter, Note, Segmented, StatTile } from "./ui";
import { count, pct, shortAddress, usd } from "@/lib/format";
import { useJson } from "@/lib/hooks";
import type { LeaderCategory, Leaderboard, LeaderWindow } from "@/lib/types";

const EXPLORER = "https://explorer.risechain.com/address/";
const WINDOW_LABEL: Record<LeaderWindow, string> = { "24h": "24h", "7d": "7 days", "2w": "14 days" };
const CATEGORY_LABEL: Record<LeaderCategory, string> = {
  volume: "traded volume",
  fees: "fees paid",
  liquidations: "liquidation volume",
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * `platformVolume` maps each window to total exchange volume over it. Each fill counts toward
 * both the maker and the taker on the leaderboard, so shares are taken against twice that.
 */
export function Traders({ platformVolume }: { platformVolume: Record<LeaderWindow, number | null> }) {
  const [window, setWindow] = useState<LeaderWindow>("24h");
  const [category, setCategory] = useState<LeaderCategory>("volume");
  const { data, error, loading } = useJson<Leaderboard>(`/api/leaderboard?window=${window}&category=${category}`);

  const entries = data?.entries ?? [];
  const twoSided = (platformVolume[window] ?? 0) * 2;
  const share = (v: number) => (twoSided ? v / twoSided : null);
  const top100 = sum(entries.map((e) => e.tradedVolume));
  const top10 = sum(entries.slice(0, 10).map((e) => e.tradedVolume));
  const maxShare = Math.max(...entries.map((e) => share(e.tradedVolume) ?? 0), 1e-9);
  const scope = `Top ${entries.length || 100} by ${CATEGORY_LABEL[category]} · ${WINDOW_LABEL[window]}`;

  return (
    <div className="flex flex-col gap-4">
      <FilterRow>
        <Segmented
          label="Time window"
          value={window}
          onChange={setWindow}
          options={[
            { value: "24h", label: "24h" },
            { value: "7d", label: "7D" },
            { value: "2w", label: "14D" },
          ]}
        />
        <Segmented
          label="Rank traders by"
          value={category}
          onChange={setCategory}
          options={[
            { value: "volume", label: "Volume" },
            { value: "fees", label: "Fees" },
            { value: "liquidations", label: "Liquidations" },
          ]}
        />
      </FilterRow>

      {error && <ErrorBox message={`Could not load the leaderboard: ${error}`} />}

      <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile
            label={`Top ${entries.length || 100} traded volume`}
            value={usd(top100)}
            sub={share(top100) != null ? `${pct(share(top100)! * 100, 1, false)} of all volume` : scope}
          />
          <StatTile
            label="Top 10 traders' share"
            value={share(top10) != null ? pct(share(top10)! * 100, 1, false) : "—"}
            sub={`${usd(top10)} traded`}
          />
          <StatTile label="Net fees paid" value={usd(sum(entries.map((e) => e.fees)))} sub="Maker rebates net out" />
          <StatTile label="Liquidation volume" value={usd(sum(entries.map((e) => e.liquidationVolume)))} sub={scope} />
          <StatTile label="Trades" value={count(sum(entries.map((e) => e.trades)))} sub={scope} />
        </div>

        <section className="glass-card overflow-hidden rounded-2xl border border-line bg-surface">
          <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 sm:px-5">
            <h2 className="text-sm font-semibold text-ink">Leaderboard</h2>
            <p className="text-xs text-muted">{scope}</p>
          </header>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line text-xs text-muted">
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">#</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">Trader</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Traded volume</th>
                  <th scope="col" className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Share</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Liquidations</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Fees (net)</th>
                  <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Trades</th>
                  <th scope="col" className="hidden px-3 py-2.5 text-right font-medium whitespace-nowrap lg:table-cell">
                    Avg trade
                  </th>
                </tr>
              </thead>
              <tbody className="num">
                {entries.map((e) => {
                  const s = share(e.tradedVolume);
                  return (
                    <tr key={e.address} className="border-b border-line last:border-0 hover:bg-wash">
                      <td className="px-3 py-2 text-muted">{e.rank}</td>
                      <td className="px-3 py-2">
                        <a
                          href={`${EXPLORER}${e.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-ink hover:text-accent hover:underline"
                          title={e.address}
                        >
                          {shortAddress(e.address)}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-right text-ink">{usd(e.tradedVolume)}</td>
                      <td className="hidden px-3 py-2 md:table-cell">
                        {s == null ? (
                          <span className="block text-right text-muted">—</span>
                        ) : (
                          <div className="ml-auto flex w-32 items-center gap-2">
                            <Meter value={s / maxShare} label={`${shortAddress(e.address)} share of volume`} />
                            <span className="w-11 text-right text-xs text-ink-2">{pct(s * 100, 2, false)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-ink-2">{e.liquidationVolume ? usd(e.liquidationVolume) : "—"}</td>
                      <td className={`px-3 py-2 text-right ${e.fees < 0 ? "text-ink-2" : "text-ink"}`}>{usd(e.fees)}</td>
                      <td className="hidden px-3 py-2 text-right text-ink-2 sm:table-cell">{count(e.trades)}</td>
                      <td className="hidden px-3 py-2 text-right text-ink-2 lg:table-cell">
                        {e.trades ? usd(e.tradedVolume / e.trades) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {!entries.length && !error && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-muted">
                      Loading leaderboard…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <Note>
        From RISEx&apos;s public user-volume leaderboard (top 100 accounts, up to 14 days). Every fill counts for both
        the maker and the taker, so share is measured against twice the exchange&apos;s volume for the window
        (7D/14D totals come from daily candles and are approximate). Negative fees are net maker rebates.
      </Note>
    </div>
  );
}

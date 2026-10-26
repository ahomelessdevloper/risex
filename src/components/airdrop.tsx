"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Card, Note } from "./ui";
import { count, duration, parseAmount, pct, usd, usdPrecise } from "@/lib/format";
import { useJson } from "@/lib/hooks";
import { REFERRAL_URL } from "@/lib/links";
import type { PointsInfo } from "@/lib/types";

const STORAGE_KEY = "risellama:airdrop";
const SUPPLY_PCTS = [20, 25, 30] as const;
const FDV_PRESETS = [100e6, 250e6, 500e6, 1e9, 2e9, 5e9];

interface Inputs {
  myPoints: string;
  /** null until the user types a total; the live Season 1 total is used meanwhile. */
  totalPoints: string | null;
  fdv: string;
}

const DEFAULTS: Inputs = { myPoints: "1,000", totalPoints: null, fdv: "500M" };

function loadInputs(): Inputs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Inputs>) };
  } catch {}
  return DEFAULTS;
}

/** 200K, 2.6M, 9.8M */
const compactNum = (n: number) => usd(n, 1).replace("$", "").replace(/\.0(?=[KMB]?$)/, "");
const fullNum = (n: number) => Math.round(n).toLocaleString("en-US");

export function Airdrop({ now }: { now: number }) {
  const { data: info } = useJson<PointsInfo>("/api/points");
  const [inputs, setInputs] = useState<Inputs>(loadInputs);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {}
  }, [inputs]);

  const set = (patch: Partial<Inputs>) => setInputs((s) => ({ ...s, ...patch }));

  const totalText = inputs.totalPoints ?? (info ? count(info.distributedPoints) : "");
  const my = parseAmount(inputs.myPoints);
  const total = parseAmount(totalText);
  const fdv = parseAmount(inputs.fdv);
  const ready = my != null && total != null && total > 0 && fdv != null;

  const scenario = (supplyPct: number, atFdv = fdv ?? 0) => {
    const pool = (atFdv * supplyPct) / 100;
    const perPoint = total ? pool / total : 0;
    return { pool, perPoint, worth: (my ?? 0) * perPoint };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="RISE airdrop calculator"
          subtitle="Estimate what your RISEx points could be worth at launch"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <AmountField
              label="Your points"
              value={inputs.myPoints}
              onChange={(v) => set({ myPoints: v })}
              hint={my != null ? `${fullNum(my)} pts` : "Enter a number"}
              invalid={my == null}
            />
            <AmountField
              label="Total points (all users)"
              value={totalText}
              onChange={(v) => set({ totalPoints: v })}
              hint={total != null ? `${fullNum(total)} pts` : "Enter a number"}
              invalid={total == null || total <= 0}
              chips={
                info && (
                  <>
                    <Chip
                      active={inputs.totalPoints === null}
                      onClick={() => set({ totalPoints: null })}
                    >
                      Live S1 · {compactNum(info.distributedPoints)}
                    </Chip>
                    <Chip onClick={() => set({ totalPoints: count(info.seasonPoints) })}>
                      Full S1 · {compactNum(info.seasonPoints)}
                    </Chip>
                  </>
                )
              }
            />
            <AmountField
              label="Launch FDV"
              prefix="$"
              value={inputs.fdv}
              onChange={(v) => set({ fdv: v })}
              hint={fdv != null ? `$${fullNum(fdv)}` : "e.g. 500M or 1.5B"}
              invalid={fdv == null}
              chips={FDV_PRESETS.map((p) => (
                <Chip key={p} active={fdv === p} onClick={() => set({ fdv: usd(p, 0).replace("$", "") })}>
                  {usd(p, 0)}
                </Chip>
              ))}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-4 text-sm text-ink-2">
            <span>
              Your share of all points{" "}
              <span className="font-semibold text-ink num">
                {ready ? pct(((my ?? 0) / (total ?? 1)) * 100, 4, false) : "—"}
              </span>
            </span>
            <span>
              Tip: type <span className="font-mono text-ink">2.5m</span> or{" "}
              <span className="font-mono text-ink">1b</span> for millions and billions
            </span>
          </div>
        </Card>

        <section className="glass-card hero-glow flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div>
            <div className="text-xs text-muted">Next points drop</div>
            <div className="text-gradient mt-1 text-4xl font-semibold tracking-tight num">
              {info?.nextDropMs && now ? duration(info.nextDropMs - now) : "—"}
            </div>
            <div className="mt-1 text-xs text-ink-2">{info?.epochLabel ?? "Ignite Season 1"}</div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Fact label="Weekly pool" value={info ? `${compactNum(info.weeklyPoints)} pts` : "—"} />
            <Fact label="Drops so far" value={info ? String(info.dropsSoFar) : "—"} />
            <Fact label="Distributed" value={info ? `${compactNum(info.distributedPoints)} pts` : "—"} />
            <Fact
              label={`Full season (${info?.seasonWeeks ?? "—"} wks)`}
              value={info ? `${compactNum(info.seasonPoints)} pts` : "—"}
            />
          </dl>
          <a
            href={REFERRAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glow mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            Stack points on RISEx <span aria-hidden>↗</span>
          </a>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {SUPPLY_PCTS.map((p) => {
          const s = scenario(p);
          return (
            <section
              key={p}
              className={`glass-card rounded-2xl border bg-surface p-5 ${p === 25 ? "hero-glow border-accent/40" : "border-line"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">{p}% of supply</span>
                {p === 25 && (
                  <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[10px] font-medium text-accent">
                    MID CASE
                  </span>
                )}
              </div>
              <div className="mt-3 text-xs text-muted">Your airdrop worth</div>
              <div className="text-gradient text-4xl font-semibold tracking-tight">{ready ? usd(s.worth) : "—"}</div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
                <Fact label="Value per point" value={ready ? usdPrecise(s.perPoint) : "—"} />
                <Fact label="Airdrop pool" value={ready ? usd(s.pool) : "—"} />
              </dl>
            </section>
          );
        })}
      </div>

      <Card title="Your airdrop at different launch FDVs" subtitle="Rows are the share of total supply given to points holders">
        <div className="overflow-x-auto">
          <table className="w-full text-sm num">
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="px-3 py-2 text-left font-medium">Supply</th>
                {FDV_PRESETS.map((f) => (
                  <th
                    key={f}
                    scope="col"
                    className={`px-3 py-2 text-right font-medium whitespace-nowrap ${fdv === f ? "text-accent" : ""}`}
                  >
                    {usd(f, 0)} FDV
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SUPPLY_PCTS.map((p) => (
                <tr key={p} className="border-t border-line">
                  <th scope="row" className="px-3 py-2.5 text-left font-medium text-ink-2">
                    {p}%
                  </th>
                  {FDV_PRESETS.map((f) => {
                    const s = scenario(p, f);
                    return (
                      <td key={f} className={`px-3 py-2.5 text-right ${fdv === f ? "bg-white/5" : ""}`}>
                        <div className="font-semibold text-ink">{ready ? usd(s.worth) : "—"}</div>
                        <div className="text-xs text-muted">{ready ? `${usdPrecise(s.perPoint)}/pt` : ""}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Note>
        Hypothetical estimate. RISEx has not announced a token, supply split or points conversion. Value per point =
        launch FDV × airdrop share ÷ total points. The live total counts Ignite Season 1 drops so far (200K points a
        week since 20 July 2026, per the RISEx docs); Season 0 retroactive points aren&apos;t published, so they are not
        included. Your inputs are saved in this browser.
      </Note>
    </div>
  );
}

function AmountField({
  label,
  value,
  onChange,
  hint,
  invalid,
  prefix,
  chips,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
  invalid: boolean;
  prefix?: string;
  chips?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">{label}</span>
        <span
          className={`flex items-center rounded-xl border bg-black/25 px-3 focus-within:ring-2 focus-within:ring-accent ${
            invalid ? "border-down/60" : "border-line"
          }`}
        >
          {prefix && <span className="text-lg text-ink-2">{prefix}</span>}
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={invalid}
            className="h-11 w-full min-w-0 bg-transparent px-1 text-lg font-semibold text-ink outline-none num"
          />
        </span>
      </label>
      <span className={`text-xs ${invalid ? "text-down" : "text-ink-2"}`}>{hint}</span>
      {chips && <div className="flex flex-wrap gap-1.5">{chips}</div>}
    </div>
  );
}

function Chip({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active ? "border-accent/50 bg-accent/15 text-ink" : "border-line bg-white/5 text-ink-2 hover:bg-white/10 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold text-ink num">{value}</dd>
    </div>
  );
}

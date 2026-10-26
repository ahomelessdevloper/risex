"use client";

import { Funding } from "./funding";
import { Liquidity } from "./liquidity";
import { Markets } from "./markets";
import { Overview } from "./overview";
import { Traders } from "./traders";
import { ErrorBox } from "./ui";
import { ago } from "@/lib/format";
import { useHash, useJson, useNow } from "@/lib/hooks";
import type { LeaderWindow, Overview as OverviewData } from "@/lib/types";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "markets", label: "Markets" },
  { id: "funding", label: "Funding" },
  { id: "traders", label: "Traders" },
  { id: "liquidity", label: "Liquidity" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DAY = 86_400_000;

/** Exchange volume over a rolling window, from daily buckets (the oldest bucket is pro-rated). */
function rollingVolume(data: OverviewData, days: number): number | null {
  const buckets = data.volume?.days;
  if (!buckets?.length) return null;
  const start = data.updatedAt - days * DAY;
  return buckets.reduce((s, d) => {
    const overlap = Math.min(d.t + DAY, data.updatedAt) - Math.max(d.t, start);
    return overlap > 0 ? s + d.total * Math.min(1, overlap / DAY) : s;
  }, 0);
}

export function Dashboard({ initial }: { initial: OverviewData }) {
  const { data, error } = useJson<OverviewData>("/api/overview", { refreshMs: 60_000, initial });
  const overview = data ?? initial;
  const now = useNow();
  const hash = useHash();
  const tab: TabId = TABS.some((t) => t.id === hash) ? (hash as TabId) : "overview";

  const platformVolume: Record<LeaderWindow, number | null> = {
    "24h": overview.markets.reduce((s, m) => s + m.volume24h, 0),
    "7d": rollingVolume(overview, 7),
    "2w": rollingVolume(overview, 14),
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-page/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-3 sm:px-6">
          <a href="#overview" className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight text-ink">RiseLlama</span>
            <span className="hidden text-xs text-muted sm:inline">RISEx perp DEX stats · unofficial</span>
          </a>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5 num" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${error ? "bg-down" : "bg-up"}`} aria-hidden />
              {error ? "Update failed · retrying" : now ? `Updated ${ago(overview.updatedAt, now)}` : "Live"}
            </span>
            <ThemeToggle />
          </div>
        </div>
        <nav className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6" aria-label="Sections">
          <ul className="flex gap-1" role="tablist">
            {TABS.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`block border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    tab === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6" role="tabpanel">
        {error && !data && <ErrorBox message={`Live refresh failed: ${error}`} />}
        {tab === "overview" && <Overview data={overview} />}
        {tab === "markets" && <Markets markets={overview.markets} now={now} />}
        {tab === "funding" && <Funding markets={overview.markets} now={now} />}
        {tab === "traders" && <Traders platformVolume={platformVolume} />}
        {tab === "liquidity" && <Liquidity />}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 text-xs text-muted sm:px-6">
          <p>
            Data:{" "}
            <a className="underline hover:text-ink" href="https://developer.rise.trade" target="_blank" rel="noreferrer">
              RISEx public API
            </a>
            ,{" "}
            <a className="underline hover:text-ink" href="https://defillama.com/protocol/risex" target="_blank" rel="noreferrer">
              DefiLlama
            </a>{" "}
            (OI and TVL history) and the RISE chain RPC (live TVL). Markets refresh every minute.
          </p>
          <p>Community dashboard, not affiliated with RISE Labs. Not financial advice.</p>
        </div>
      </footer>
    </div>
  );
}

function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const current =
      root.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      className="rounded-lg border border-line bg-surface px-2 py-1 text-ink-2 hover:text-ink"
    >
      <span aria-hidden>◐</span>
    </button>
  );
}

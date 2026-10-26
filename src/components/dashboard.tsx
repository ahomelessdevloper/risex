"use client";

import { useId, type ReactNode } from "react";
import { Airdrop } from "./airdrop";
import { Funding } from "./funding";
import { Liquidity } from "./liquidity";
import { Markets } from "./markets";
import { Overview } from "./overview";
import { Traders } from "./traders";
import { ErrorBox } from "./ui";
import { ago, pct, price } from "@/lib/format";
import { useHash, useJson, useNow } from "@/lib/hooks";
import { DEV_X_HANDLE, DEV_X_URL, REFERRAL_CODE, REFERRAL_URL, TELEGRAM_HANDLE, TELEGRAM_URL } from "@/lib/links";
import type { LeaderWindow, Market, Overview as OverviewData } from "@/lib/types";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "markets", label: "Markets" },
  { id: "funding", label: "Funding" },
  { id: "traders", label: "Traders" },
  { id: "liquidity", label: "Liquidity" },
  { id: "airdrop", label: "Airdrop" },
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
      <ReferralBanner />

      <header className="sticky top-0 z-20 border-b border-line bg-[#06150f]/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <a href="#overview" onClick={() => window.scrollTo({ top: 0 })} className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-semibold tracking-tight text-ink">RiseLlama</span>
          </a>
          <nav className="hidden flex-1 justify-center md:flex" aria-label="Sections">
            <Tabs active={tab} />
          </nav>
          <span className="ml-auto flex items-center gap-2 text-xs text-ink-2 num md:ml-0" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${error ? "bg-down" : "live-dot bg-up"}`} aria-hidden />
            {error ? "Retrying…" : now ? ago(overview.updatedAt, now) : "Live"}
          </span>
        </div>
        <nav className="overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:hidden" aria-label="Sections">
          <Tabs active={tab} />
        </nav>
        <Ticker markets={overview.markets} />
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6" role="tabpanel">
        {error && !data && <ErrorBox message={`Live refresh failed: ${error}`} />}
        {tab === "overview" && <Overview data={overview} />}
        {tab === "markets" && <Markets markets={overview.markets} now={now} />}
        {tab === "funding" && <Funding markets={overview.markets} now={now} />}
        {tab === "traders" && <Traders platformVolume={platformVolume} />}
        {tab === "liquidity" && <Liquidity />}
        {tab === "airdrop" && <Airdrop now={now} />}
      </main>

      <Footer />
    </div>
  );
}

function Tabs({ active }: { active: TabId }) {
  return (
    <ul className="flex w-max gap-1 rounded-2xl border border-line bg-black/25 p-1" role="tablist">
      {TABS.map((t) => (
        <li key={t.id}>
          <a
            href={`#${t.id}`}
            onClick={() => window.scrollTo({ top: 0 })}
            role="tab"
            aria-selected={active === t.id}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active === t.id ? "bg-white/12 text-ink shadow-sm ring-1 ring-white/15" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "airdrop" && <span className="h-1.5 w-1.5 rounded-full bg-accent-2" aria-hidden />}
          </a>
        </li>
      ))}
    </ul>
  );
}

function ReferralBanner() {
  return (
    <a
      href={REFERRAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden border-b border-white/10 bg-gradient-to-r from-[#6ee7b7]/20 via-[#22d3ee]/15 to-[#7dd3fc]/20"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2 text-xs sm:px-6 sm:text-sm">
        <span className="text-ink">
          <span className="hidden sm:inline">Trade perps on RISEx and earn points for the airdrop · </span>
          <span className="sm:hidden">Earn RISEx points · </span>
          <span className="whitespace-nowrap">
            invite code{" "}
            <span className="rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-xs font-semibold">{REFERRAL_CODE}</span>
          </span>
        </span>
        <span className="btn-glow inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold">
          Join RISEx <span aria-hidden>↗</span>
        </span>
      </div>
    </a>
  );
}

function Ticker({ markets }: { markets: Market[] }) {
  const items = [...markets].sort((a, b) => b.volume24h - a.volume24h);
  const list = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((m) => (
        <li key={m.id} className="flex items-center gap-2 px-4 text-xs whitespace-nowrap num">
          <span className="font-semibold text-ink">{m.symbol}</span>
          <span className="text-ink-2">${price(m.price)}</span>
          <span className={m.changePct > 0 ? "text-up" : m.changePct < 0 ? "text-down" : "text-muted"}>
            {m.changePct > 0 ? "▲" : m.changePct < 0 ? "▼" : ""} {pct(Math.abs(m.changePct), 2, false)}
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="ticker overflow-hidden border-t border-line bg-black/20 py-1.5" aria-label="Market prices">
      <div className="ticker-track flex w-max">
        {list(false)}
        {list(true)}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-[#06150f]/50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div>
            <div className="text-sm font-semibold text-ink">RiseLlama</div>
            <div className="text-xs text-muted">Built by @{DEV_X_HANDLE}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <SocialLink href={DEV_X_URL} label={`Follow @${DEV_X_HANDLE} on X`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Follow @{DEV_X_HANDLE}
          </SocialLink>
          <SocialLink href={TELEGRAM_URL} label={`Join @${TELEGRAM_HANDLE} on Telegram`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
            </svg>
            @{TELEGRAM_HANDLE}
          </SocialLink>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="glass-card inline-flex items-center gap-2 rounded-xl border border-line bg-white/5 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-white/10"
    >
      {children}
    </a>
  );
}

function Logo() {
  // Unique per instance: the logo renders in both the header and the footer.
  const gradientId = useId();
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="8" fill={`url(#${gradientId})`} />
      <path
        d="M7 19.5 11.5 13l3 3.5L21 8.5"
        fill="none"
        stroke="#04140e"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="8.5" r="2" fill="#04140e" />
    </svg>
  );
}

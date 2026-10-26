const compact = (n: number, digits: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(digits)}K`;
  return n.toFixed(abs >= 100 || digits === 0 ? 0 : Math.min(digits, 2));
};

/** $164.02M, $1.29B, $20.7K */
export const usd = (n: number | null | undefined, digits = 2) =>
  n == null || !Number.isFinite(n) ? "—" : `${n < 0 ? "-" : ""}$${compact(Math.abs(n), digits)}`;

/** Axis ticks: $0, $50M, $1.5B */
export const usdTick = (n: number) => usd(n, 1).replace(/\.0(?=[KMB]?$)/, "");

export const count = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : n >= 1e4 ? compact(n, 1) : Math.round(n).toLocaleString("en-US");

export const pct = (n: number | null | undefined, digits = 2, signed = true) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = n.toFixed(digits);
  return `${signed && n > 0 ? "+" : ""}${s}%`;
};

/** Price with precision that adapts to magnitude. */
export const price = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 1 : abs >= 10 ? 2 : abs >= 1 ? 3 : abs >= 0.01 ? 4 : 6;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** UTC calendar date: "Oct 26" or "Oct 26, 2026". */
export const day = (ms: number, withYear = false) => {
  const d = new Date(ms);
  const s = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${s}, ${d.getUTCFullYear()}` : s;
};

export const dateTime = (ms: number) => {
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day(ms)} ${hh}:${mm} UTC`;
};

export const ago = (ms: number, now: number) => {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
};

export const countdown = (ms: number, now: number) => {
  const s = Math.max(0, Math.round((ms - now) / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** "1d 4h", "15h 32m", "12m" */
export const duration = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d}d ${h}h`;
  return h ? `${h}h ${m % 60}m` : `${m % 60}m`;
};

/** Parses "1,250", "2.6m", "500M", "1.5b" or "$750k". Returns null when it isn't a number. */
export const parseAmount = (s: string): number | null => {
  const m = s.trim().replace(/[$,\s_]/g, "").match(/^(\d*\.?\d+)([kmb])?$/i);
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase() as "k" | "m" | "b"] ?? 1;
  return Number(m[1]) * mult;
};

/** Value of a single point: enough decimals to stay meaningful below a cent. */
export const usdPrecise = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return usd(n);
  const digits = Math.abs(n) >= 1 ? 2 : Math.abs(n) >= 0.01 ? 4 : 6;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const subscribeClock = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};

/** Current time, ticking each second. 0 during server render and hydration. */
export function useNow() {
  return useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => 0,
  );
}

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** The URL hash without "#", e.g. "markets". */
export function useHash() {
  return useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.slice(1),
    () => "",
  );
}

interface JsonState<T> {
  url: string | null;
  data: T | null;
  error: string | null;
}

/**
 * Fetches JSON from `url`, optionally re-polling every `refreshMs` while the tab is visible.
 * When `url` changes the previous data is kept and `loading` is true until the new response lands.
 * Pass `initial` to seed the first render and skip the first request.
 */
export function useJson<T>(url: string | null, opts: { refreshMs?: number; initial?: T } = {}) {
  const { refreshMs, initial } = opts;
  const [state, setState] = useState<JsonState<T>>(() => ({
    url: initial !== undefined ? url : null,
    data: initial ?? null,
    error: null,
  }));
  const seeded = initial !== undefined;

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? res.statusText);
        if (alive) setState({ url, data: body as T, error: null });
      } catch (err) {
        if (!alive || ctrl.signal.aborted) return;
        setState((s) => ({ ...s, url, error: err instanceof Error ? err.message : String(err) }));
      }
    };
    if (!seeded) load();
    const id = refreshMs
      ? setInterval(() => {
          if (!document.hidden) load();
        }, refreshMs)
      : undefined;
    return () => {
      alive = false;
      ctrl.abort();
      clearInterval(id);
    };
  }, [url, refreshMs, seeded]);

  return { data: state.data, error: state.error, loading: state.url !== url };
}

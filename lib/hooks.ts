"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-only "now" that re-renders on a fixed interval.
 *
 * Backed by useSyncExternalStore so SSR returns `null` (no hydration
 * mismatch) and updates without setState-in-effect — which React 19's
 * strict mode flags as a cascading-render hazard.
 *
 * Critical: useSyncExternalStore contract requires getSnapshot to return
 * the same value (Object.is) until the store actually changes. Returning
 * Date.now() directly would yield a different number on every call, which
 * React reads as "store changed" and re-renders, in an infinite loop
 * (React error #185). Each (refreshMs, …) gets a module-level ticker that
 * caches the current value; getSnapshot reads it, the interval updates it.
 */

type Ticker = {
  now: number | null;
  listeners: Set<() => void>;
  intervalId: ReturnType<typeof setInterval> | null;
};

const tickers = new Map<number, Ticker>();

function getTicker(refreshMs: number): Ticker {
  let ticker = tickers.get(refreshMs);
  if (!ticker) {
    ticker = { now: null, listeners: new Set(), intervalId: null };
    tickers.set(refreshMs, ticker);
  }
  return ticker;
}

function subscribeTicker(
  refreshMs: number,
  callback: () => void,
): () => void {
  const ticker = getTicker(refreshMs);
  if (ticker.intervalId === null) {
    // First subscriber: capture initial timestamp and start the interval.
    ticker.now = Date.now();
    ticker.intervalId = setInterval(() => {
      ticker.now = Date.now();
      ticker.listeners.forEach((l) => l());
    }, refreshMs);
  }
  ticker.listeners.add(callback);
  // The subscriber sees a fresh snapshot vs the pre-subscribe `null`. Notify
  // so React reads the new value without waiting for the first interval tick.
  callback();
  return () => {
    ticker.listeners.delete(callback);
    if (ticker.listeners.size === 0 && ticker.intervalId !== null) {
      clearInterval(ticker.intervalId);
      ticker.intervalId = null;
      ticker.now = null;
    }
  };
}

export function useClientNow(refreshMs = 60_000): number | null {
  return useSyncExternalStore(
    (callback) => subscribeTicker(refreshMs, callback),
    () => getTicker(refreshMs).now,
    () => null,
  );
}

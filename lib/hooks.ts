"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-only "now" that re-renders on a fixed interval.
 *
 * Backed by useSyncExternalStore. Two non-obvious invariants matter:
 *
 *   1. getSnapshot must return the SAME value (Object.is) until the store
 *      actually changes. Returning Date.now() directly yields a new number
 *      on every call → React reads "store changed" → re-render → re-read
 *      → loop forever (React error #185).
 *
 *   2. The subscribe function must be stable across renders. If it's an
 *      arrow function recreated each render, React re-subscribes every
 *      time. Combined with our `callback()` inside subscribe (to notify
 *      React when the snapshot transitions from null → number on first
 *      subscribe), the re-subscribe also fires the callback, which re-
 *      renders, which creates a new arrow → another infinite loop.
 *
 * Fix for both: module-level ticker per refreshMs that caches `now`, plus
 * memoized `{ subscribe, getSnapshot }` pair per refreshMs so the hook
 * always passes the same function references for the same refreshMs.
 */

type Ticker = {
  now: number | null;
  listeners: Set<() => void>;
  intervalId: ReturnType<typeof setInterval> | null;
};

type Subscriber = {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => number | null;
};

const tickers = new Map<number, Ticker>();
const subscribers = new Map<number, Subscriber>();

function getTicker(refreshMs: number): Ticker {
  let ticker = tickers.get(refreshMs);
  if (!ticker) {
    ticker = { now: null, listeners: new Set(), intervalId: null };
    tickers.set(refreshMs, ticker);
  }
  return ticker;
}

function getSubscriber(refreshMs: number): Subscriber {
  let s = subscribers.get(refreshMs);
  if (!s) {
    s = {
      subscribe: (callback: () => void) => {
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
        // Notify React so it picks up the post-subscribe value (was null
        // pre-subscribe). Safe to call here because `subscribe` is stable —
        // React won't re-subscribe on the resulting re-render.
        callback();
        return () => {
          ticker.listeners.delete(callback);
          if (ticker.listeners.size === 0 && ticker.intervalId !== null) {
            clearInterval(ticker.intervalId);
            ticker.intervalId = null;
            ticker.now = null;
          }
        };
      },
      getSnapshot: () => getTicker(refreshMs).now,
    };
    subscribers.set(refreshMs, s);
  }
  return s;
}

const serverSnapshot = () => null;

export function useClientNow(refreshMs = 60_000): number | null {
  const s = getSubscriber(refreshMs);
  return useSyncExternalStore(s.subscribe, s.getSnapshot, serverSnapshot);
}

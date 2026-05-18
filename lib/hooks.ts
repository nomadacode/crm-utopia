"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-only "now" that re-renders on a fixed interval.
 *
 * Backed by useSyncExternalStore so the snapshot is consistent during SSR
 * (always returns `null`) and updates without setState-in-effect — which
 * React 19's strict mode flags as a cascading-render hazard.
 */
export function useClientNow(refreshMs = 60_000): number | null {
  return useSyncExternalStore(
    (callback) => {
      const id = setInterval(callback, refreshMs);
      return () => clearInterval(id);
    },
    () => Date.now(),
    () => null,
  );
}

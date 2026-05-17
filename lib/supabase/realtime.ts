"use client";

import { useEffect, useRef } from "react";
import { supabaseBrowser } from "./client";

type ChangePayload<T> = {
  new: T;
  old: Partial<T>;
};

const DEBUG =
  typeof window !== "undefined" &&
  (window.location.search.includes("realtime_debug") ||
    process.env.NEXT_PUBLIC_REALTIME_DEBUG === "1");

function dlog(...args: unknown[]) {
  if (DEBUG) console.log("[realtime]", ...args);
}

/**
 * Wait for the auth session to be loaded from cookies, then push the access
 * token into the realtime client. Without this, the WebSocket connects using
 * only the anon key, and RLS policies that check the `authenticated` role
 * silently drop every event.
 */
async function ensureRealtimeAuth(supabase: ReturnType<typeof supabaseBrowser>) {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      supabase.realtime.setAuth(data.session.access_token);
      dlog("realtime auth set from session");
    } else {
      dlog("no session, realtime will use anon role");
    }
  } catch (err) {
    console.error("[realtime] auth setup failed", err);
  }
}

export function useRealtimeInserts<T>(
  table: string,
  filter: string | undefined,
  onInsert: (payload: ChangePayload<T>) => void,
) {
  const handler = useRef(onInsert);
  handler.current = onInsert;

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await ensureRealtimeAuth(supabase);
      if (cancelled) return;
      const channelName = `${table}-inserts-${filter ?? "all"}-${Math.random().toString(36).slice(2, 7)}`;
      dlog("subscribe INSERT", channelName, "filter:", filter);
      channelRef = supabase
        .channel(channelName)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "INSERT", schema: "public", table, filter },
          (payload: ChangePayload<T>) => {
            dlog("INSERT event", table, payload);
            handler.current(payload);
          },
        )
        .subscribe((status, err) => {
          dlog("subscribe status", channelName, status, err?.message ?? "");
        });
    })();

    return () => {
      cancelled = true;
      if (channelRef) {
        dlog("unsubscribe");
        supabase.removeChannel(channelRef);
      }
    };
  }, [table, filter]);
}

export function useRealtimeUpdates<T>(
  table: string,
  filter: string | undefined,
  onUpdate: (payload: ChangePayload<T>) => void,
) {
  const handler = useRef(onUpdate);
  handler.current = onUpdate;

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await ensureRealtimeAuth(supabase);
      if (cancelled) return;
      const channelName = `${table}-updates-${filter ?? "all"}-${Math.random().toString(36).slice(2, 7)}`;
      dlog("subscribe UPDATE", channelName, "filter:", filter);
      channelRef = supabase
        .channel(channelName)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "UPDATE", schema: "public", table, filter },
          (payload: ChangePayload<T>) => {
            dlog("UPDATE event", table, payload);
            handler.current(payload);
          },
        )
        .subscribe((status, err) => {
          dlog("subscribe status", channelName, status, err?.message ?? "");
        });
    })();

    return () => {
      cancelled = true;
      if (channelRef) {
        dlog("unsubscribe");
        supabase.removeChannel(channelRef);
      }
    };
  }, [table, filter]);
}

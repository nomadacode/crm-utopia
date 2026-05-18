"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Subscribes to any change that could affect the conversations list (new
 * message, new lead classification, contact mutation like archive/bot toggle/
 * escalation, or tag assignment) and triggers a debounced router.refresh().
 * One channel with multiple .on() handlers keeps the WebSocket footprint low.
 */
export function ListRefresher() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    function scheduleRefresh() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 500);
    }

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          supabase.realtime.setAuth(data.session.access_token);
        }
      } catch (err) {
        console.error("[list-refresher] auth setup failed", err);
      }
      if (cancelled) return;

      channelRef = supabase
        .channel("conversations-list")
        .on(
          "postgres_changes" as never,
          { event: "INSERT", schema: "public", table: "messages" },
          scheduleRefresh,
        )
        .on(
          "postgres_changes" as never,
          { event: "INSERT", schema: "public", table: "leads" },
          scheduleRefresh,
        )
        .on(
          "postgres_changes" as never,
          { event: "UPDATE", schema: "public", table: "contacts" },
          scheduleRefresh,
        )
        .on(
          "postgres_changes" as never,
          { event: "INSERT", schema: "public", table: "contact_tags" },
          scheduleRefresh,
        )
        .on(
          "postgres_changes" as never,
          { event: "DELETE", schema: "public", table: "contact_tags" },
          scheduleRefresh,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [router]);

  return null;
}

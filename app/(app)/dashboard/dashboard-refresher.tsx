"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Refresca el dashboard cuando llegan mensajes o leads nuevos.
 * Debounced para evitar refrescos en cascada.
 */
export function DashboardRefresher() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          supabase.realtime.setAuth(data.session.access_token);
        }
      } catch (err) {
        console.error("[dashboard-refresher] auth setup failed", err);
      }
      if (cancelled) return;

      const schedule = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 1000);
      };

      channelRef = supabase
        .channel("dashboard")
        .on(
          "postgres_changes" as never,
          { event: "INSERT", schema: "public", table: "messages" },
          schedule,
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

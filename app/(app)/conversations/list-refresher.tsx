"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Subscribes to new messages and triggers a router.refresh() when one arrives,
 * so the conversations list reflects new activity without a manual reload.
 * Debounced to 500ms to avoid hammering on burst inserts.
 */
export function ListRefresher() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel("conversations-list")
      .on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 500);
        },
      )
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}

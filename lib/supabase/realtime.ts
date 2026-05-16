"use client";

import { useEffect, useRef } from "react";
import { supabaseBrowser } from "./client";

type ChangePayload<T> = {
  new: T;
  old: Partial<T>;
};

export function useRealtimeInserts<T>(
  table: string,
  filter: string | undefined,
  onInsert: (payload: ChangePayload<T>) => void,
) {
  const handler = useRef(onInsert);
  handler.current = onInsert;

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channelName = `${table}-inserts-${filter ?? "all"}`;
    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table, filter },
        (payload: ChangePayload<T>) => handler.current(payload),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
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
    const channelName = `${table}-updates-${filter ?? "all"}`;
    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table, filter },
        (payload: ChangePayload<T>) => handler.current(payload),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientNow } from "@/lib/hooks";
import type { LeadEntry, RecentLead } from "./page";

const SCORE_DOT: Record<"hot" | "warm" | "cold", string> = {
  hot: "bg-accent",
  warm: "bg-amber-400",
  cold: "bg-zinc-300",
};

const SCORE_LABEL: Record<"hot" | "warm" | "cold", string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

function formatRelative(iso: string, now: number | null): string {
  if (now == null) return "—";
  const diffMs = now - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function RecentLeadsList({ leads }: { leads: RecentLead[] }) {
  const now = useClientNow();
  return (
    <ul className="divide-y divide-border">
      {leads.map((l) => (
        <LeadRow key={l.contact_id} lead={l} now={now} />
      ))}
    </ul>
  );
}

function LeadRow({ lead, now }: { lead: RecentLead; now: number | null }) {
  const [open, setOpen] = useState(false);
  // history[0] is the current; show only older ones in the expandable
  const older = lead.history.slice(1);
  const hasHistory = older.length > 0;

  return (
    <li>
      <div className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30">
        <span
          className={cn(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            SCORE_DOT[lead.current.score],
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/conversations/${lead.contact_id}`}
              className="truncate text-sm font-medium hover:underline"
            >
              {lead.contact_name ?? lead.contact_phone}
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground tabular">
              {formatRelative(lead.current.qualified_at, now)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {lead.current.reason}
          </p>
          {hasHistory && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {open ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {older.length} clasificación{older.length === 1 ? "" : "es"} anterior{older.length === 1 ? "" : "es"}
            </button>
          )}
          {open && hasHistory && (
            <ul className="mt-2 space-y-1 border-l border-border pl-3">
              {older.map((entry: LeadEntry) => (
                <li key={entry.id} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                      SCORE_DOT[entry.score],
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {SCORE_LABEL[entry.score]}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground tabular">
                        {formatRelative(entry.qualified_at, now)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/90">
                      {entry.reason}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

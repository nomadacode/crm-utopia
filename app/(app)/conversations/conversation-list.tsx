"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ChannelIcon } from "@/components/channel-icon";
import { cn } from "@/lib/utils";
import type { Channel, Tag } from "@/lib/types";
import { BulkActionBar, type FilterKey } from "./bulk-action-bar";

export type ConversationRow = {
  id: string;
  phone: string;
  name: string | null;
  blocked: boolean;
  last_read_at: string | null;
  archived_at: string | null;
  needs_human: boolean;
  escalated_at: string | null;
  channel: Channel;
  lastMessage: string | null;
  lastAt: string | null;
  lastUserAt: string | null;
  score: "hot" | "warm" | "cold" | null;
  tags: Tag[];
};

const COLOR_CLASSES: Record<string, string> = {
  gray: "bg-zinc-200 text-zinc-700",
  lime: "bg-accent text-accent-foreground",
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  violet: "bg-violet-100 text-violet-800",
  pink: "bg-pink-100 text-pink-800",
  red: "bg-red-100 text-red-800",
  cyan: "bg-cyan-100 text-cyan-800",
};

function ScoreDot({ score }: { score: ConversationRow["score"] }) {
  if (!score) return null;
  const cls = {
    hot: "bg-accent",
    warm: "bg-amber-400",
    cold: "bg-zinc-300",
  }[score];
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}

function isUnread(row: ConversationRow): boolean {
  if (!row.lastUserAt) return false;
  if (!row.last_read_at) return true;
  return new Date(row.lastUserAt) > new Date(row.last_read_at);
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function ConversationList({
  rows,
  tags,
  filter,
  emptyMessage,
}: {
  rows: ConversationRow[];
  tags: Tag[];
  filter: FilterKey;
  emptyMessage: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const router = useRouter();

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    );
  }

  const onAfterBulkAction = useMemo(
    () => () => {
      setSelected(new Set());
      startTransition(() => router.refresh());
    },
    [router],
  );

  if (rows.length === 0) {
    return (
      <Card className="rounded-lg p-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <BulkActionBar
          selectedIds={Array.from(selected)}
          tags={tags}
          filter={filter}
          onClear={() => setSelected(new Set())}
          onAfterAction={onAfterBulkAction}
        />
      )}

      <Card className="overflow-hidden rounded-lg p-0">
        <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-3 py-2">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleAll}
            ariaLabel={allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          />
          <span className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} seleccionada${selected.size === 1 ? "" : "s"}`
              : `${rows.length} ${rows.length === 1 ? "resultado" : "resultados"}`}
          </span>
        </div>

        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const unread = isUnread(row);
            const isSelected = selected.has(row.id);
            return (
              <li
                key={row.id}
                className={cn(
                  "flex items-stretch transition-colors",
                  isSelected ? "bg-accent/10" : "hover:bg-muted/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(row.id)}
                  aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
                  className="flex items-center px-4 py-4 hover:bg-muted/40"
                >
                  <Checkbox checked={isSelected} onChange={() => toggle(row.id)} ariaLabel="" />
                </button>
                <Link
                  href={`/conversations/${row.id}`}
                  className="flex flex-1 items-center gap-4 py-4 pr-5"
                >
                  <div className="relative">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {(row.name ?? row.phone).slice(0, 2).toUpperCase()}
                    </div>
                    {unread && (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ScoreDot score={row.score} />
                      <ChannelIcon channel={row.channel} size={12} />
                      <span
                        className={`truncate text-sm ${
                          unread ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {row.name ?? row.phone}
                      </span>
                      {row.needs_human && (
                        <span
                          className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800"
                          title="Necesita atención humana"
                        >
                          🆘 humano
                        </span>
                      )}
                      {row.blocked && (
                        <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                          bloq
                        </span>
                      )}
                      {row.tags.slice(0, 2).map((t) => (
                        <span
                          key={t.id}
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            COLOR_CLASSES[t.color] ?? COLOR_CLASSES.gray
                          }`}
                        >
                          {t.name}
                        </span>
                      ))}
                      {row.tags.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{row.tags.length - 2}
                        </span>
                      )}
                    </div>
                    <div
                      className={`mt-0.5 truncate text-sm ${
                        unread ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {row.lastMessage ?? "—"}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {formatRelative(row.lastAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Checkbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <span
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel || undefined}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange();
        }
      }}
      tabIndex={0}
      className={cn(
        "flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors",
        checked || indeterminate
          ? "border-foreground bg-foreground text-background"
          : "border-foreground/30 hover:border-foreground/60",
      )}
    >
      {indeterminate ? (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
          <rect x="3" y="7" width="10" height="2" rx="1" />
        </svg>
      ) : checked ? (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.5l3 3 7-7" />
        </svg>
      ) : null}
    </span>
  );
}

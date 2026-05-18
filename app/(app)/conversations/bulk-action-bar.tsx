"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Loader2,
  Mail,
  MailOpen,
  Tags,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tag } from "@/lib/types";

export type FilterKey =
  | "unread"
  | "hot"
  | "warm"
  | "cold"
  | "archived"
  | "needs_human"
  | null;

type BulkAction =
  | "archive"
  | "unarchive"
  | "mark_read"
  | "mark_unread"
  | "tag_add";

const TAG_COLOR_DOT: Record<string, string> = {
  gray: "bg-zinc-300",
  lime: "bg-accent",
  blue: "bg-blue-400",
  amber: "bg-amber-400",
  violet: "bg-violet-400",
  pink: "bg-pink-400",
  red: "bg-red-400",
  cyan: "bg-cyan-400",
};

export function BulkActionBar({
  selectedIds,
  tags,
  filter,
  onClear,
  onAfterAction,
}: {
  selectedIds: string[];
  tags: Tag[];
  filter: FilterKey;
  onClear: () => void;
  onAfterAction: () => void;
}) {
  const [running, setRunning] = useState<BulkAction | null>(null);
  const showUnarchive = filter === "archived";

  async function run(action: BulkAction, tagId?: string) {
    setRunning(action);
    try {
      const res = await fetch("/api/conversations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          action,
          tag_id: tagId,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "No se pudo completar la acción");
        return;
      }
      toast.success(messageFor(action, selectedIds.length));
      onAfterAction();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-sm">
      <span className="px-2 text-sm font-medium">
        {selectedIds.length} seleccionada{selectedIds.length === 1 ? "" : "s"}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {showUnarchive ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => run("unarchive")}
            disabled={running !== null}
          >
            {running === "unarchive" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArchiveRestore className="h-3.5 w-3.5" />
            )}
            Desarchivar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => run("archive")}
            disabled={running !== null}
          >
            {running === "archive" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            Archivar
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => run("mark_read")}
          disabled={running !== null}
        >
          {running === "mark_read" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MailOpen className="h-3.5 w-3.5" />
          )}
          Leídas
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => run("mark_unread")}
          disabled={running !== null}
        >
          {running === "mark_unread" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          No leídas
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={running !== null || tags.length === 0}
            render={
              <Button size="sm" variant="outline">
                {running === "tag_add" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Tags className="h-3.5 w-3.5" />
                )}
                Etiquetar
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-44">
            {tags.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No hay tags. Creá uno en Ajustes.
              </div>
            ) : (
              tags.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => run("tag_add", t.id)}
                  className="flex items-center gap-2"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      TAG_COLOR_DOT[t.color] ?? TAG_COLOR_DOT.gray,
                    )}
                  />
                  {t.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          disabled={running !== null}
          aria-label="Cancelar selección"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function messageFor(action: BulkAction, count: number): string {
  const plural = count === 1 ? "" : "s";
  switch (action) {
    case "archive":
      return `${count} conversación${plural} archivada${plural}`;
    case "unarchive":
      return `${count} conversación${plural} desarchivada${plural}`;
    case "mark_read":
      return `${count} marcada${plural} como leída${plural}`;
    case "mark_unread":
      return `${count} marcada${plural} como no leída${plural}`;
    case "tag_add":
      return `Etiqueta aplicada a ${count} conversación${plural}`;
  }
}

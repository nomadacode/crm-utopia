"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tag } from "@/lib/types";

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

export function TagsPanel({
  contactId,
  initialAssigned,
  allTags,
}: {
  contactId: string;
  initialAssigned: Tag[];
  allTags: Tag[];
}) {
  const [assigned, setAssigned] = useState<Tag[]>(initialAssigned);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const available = allTags.filter((t) => !assigned.some((a) => a.id === t.id));

  async function toggleTag(tag: Tag, isAssigned: boolean) {
    setPending((p) => new Set(p).add(tag.id));
    try {
      const method = isAssigned ? "DELETE" : "POST";
      const res = await fetch(`/api/contacts/${contactId}/tags`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tag.id }),
      });
      if (res.ok) {
        setAssigned((prev) =>
          isAssigned ? prev.filter((t) => t.id !== tag.id) : [...prev, tag],
        );
      }
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(tag.id);
        return next;
      });
    }
  }

  return (
    <Card className="rounded-lg p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Tags
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Agregar tag"
        >
          <Plus className={cn("h-4 w-4 transition-transform", open && "rotate-45")} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {assigned.length === 0 && !open && (
          <p className="text-sm text-muted-foreground">Sin tags.</p>
        )}
        {assigned.map((tag) => (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag, true)}
            disabled={pending.has(tag.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              COLOR_CLASSES[tag.color] ?? COLOR_CLASSES.gray,
              pending.has(tag.id) && "opacity-50",
            )}
          >
            {tag.name}
            <X className="h-2.5 w-2.5" />
          </button>
        ))}
      </div>

      {open && (
        <div className="mt-3 border-t border-border pt-3">
          {allTags.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay tags todavía. Crealos en{" "}
              <a href="/settings/tags" className="underline">
                Ajustes → Tags
              </a>
              .
            </p>
          ) : available.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Todos los tags ya están asignados.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {available.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag, false)}
                  disabled={pending.has(tag.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium opacity-60 hover:opacity-100",
                    COLOR_CLASSES[tag.color] ?? COLOR_CLASSES.gray,
                    pending.has(tag.id) && "opacity-30",
                  )}
                >
                  <Check className="h-2.5 w-2.5" />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

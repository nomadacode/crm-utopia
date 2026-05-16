"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { TAG_COLORS, type Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

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

const COLOR_SWATCH: Record<string, string> = {
  gray: "bg-zinc-400",
  lime: "bg-accent",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
  red: "bg-red-500",
  cyan: "bg-cyan-500",
};

export function TagsManager({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("gray");
  const [saving, setSaving] = useState(false);

  async function createTag(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color }),
      });
      if (res.ok) {
        const tag = (await res.json()) as Tag;
        setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "No se pudo crear el tag");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(tag: Tag) {
    if (!confirm(`¿Eliminar el tag "${tag.name}"? Se desasigna de todos los contactos.`))
      return;
    const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
    if (res.ok) setTags((prev) => prev.filter((t) => t.id !== tag.id));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createTag} className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Nuevo tag
          </label>
          <Input
            placeholder="Nombre del tag (ej: VIP, Agencia, Cliente final)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Color
          </label>
          <div className="flex gap-1.5">
            {TAG_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "h-7 w-7 rounded-full transition-transform",
                  COLOR_SWATCH[c],
                  color === c
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                    : "opacity-70 hover:opacity-100",
                )}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <Button type="submit" disabled={!name.trim() || saving}>
          {saving ? "Creando…" : "Crear tag"}
        </Button>
      </form>

      <div className="border-t border-border pt-6">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
          Tags existentes ({tags.length})
        </h2>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no creaste ningún tag.
          </p>
        ) : (
          <ul className="space-y-2">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                    COLOR_CLASSES[tag.color] ?? COLOR_CLASSES.gray,
                  )}
                >
                  {tag.name}
                </span>
                <button
                  onClick={() => removeTag(tag)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Eliminar tag"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

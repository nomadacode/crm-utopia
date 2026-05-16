"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Tag } from "@/lib/types";

const TABS = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "No leídas" },
  { key: "hot", label: "Hot" },
  { key: "warm", label: "Warm" },
  { key: "cold", label: "Cold" },
  { key: "archived", label: "Archivadas" },
] as const;

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

export function FilterBar({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const active = params.get("filter") ?? "all";
  const activeTag = params.get("tag");
  const [search, setSearch] = useState(params.get("q") ?? "");

  function applyParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyParam("q", search.trim() || null);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSearchSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o mensaje…"
          className="pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              applyParam("q", null);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => applyParam("filter", t.key === "all" ? null : t.key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              active === t.key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
        {tags.length > 0 && (
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        )}
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() =>
              applyParam("tag", activeTag === tag.id ? null : tag.id)
            }
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity",
              COLOR_CLASSES[tag.color] ?? COLOR_CLASSES.gray,
              activeTag === tag.id ? "ring-2 ring-foreground/30" : "opacity-70 hover:opacity-100",
            )}
          >
            {tag.name}
          </button>
        ))}
      </div>
    </div>
  );
}

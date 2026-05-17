"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function LeadsFilters({
  counts,
  stages,
}: {
  counts: { all: number; hot: number; warm: number; cold: number };
  stages: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const activeScore = params.get("score") ?? "all";
  const activeStage = params.get("stage");
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

  const tabs = [
    { key: "all", label: `Todos · ${counts.all}` },
    { key: "hot", label: `🔥 Hot · ${counts.hot}` },
    { key: "warm", label: `🌤️ Warm · ${counts.warm}` },
    { key: "cold", label: `❄️ Cold · ${counts.cold}` },
  ];

  return (
    <div className="space-y-3">
      <form onSubmit={onSearchSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono, email o empresa…"
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
            aria-label="Limpiar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => applyParam("score", t.key === "all" ? null : t.key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeScore === t.key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
        {stages.length > 0 && <span className="mx-1 h-4 w-px bg-border" />}
        {stages.map((s) => (
          <button
            key={s.id}
            onClick={() => applyParam("stage", activeStage === s.id ? null : s.id)}
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity",
              activeStage === s.id
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeUpdates } from "@/lib/supabase/realtime";
import { useClientNow } from "@/lib/hooks";
import { cn } from "@/lib/utils";

type ProfileFields = {
  email: string | null;
  company: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  timeline: string | null;
  pain_points: string | null;
  main_goal: string | null;
};

type ContactRealtimePayload = ProfileFields & {
  id: string;
  profile_updated_at: string | null;
  profile_enriching_until: string | null;
};

type FieldKey = keyof ProfileFields;

const TEXTAREA_FIELDS: FieldKey[] = ["pain_points", "main_goal"];

const LABELS: Record<FieldKey, string> = {
  email: "Email",
  company: "Empresa",
  website: "Sitio web",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  timeline: "Cuándo lo necesita",
  pain_points: "Problema a resolver",
  main_goal: "Objetivo",
};

const ORDER: FieldKey[] = [
  "company",
  "email",
  "website",
  "instagram",
  "linkedin",
  "timeline",
  "main_goal",
  "pain_points",
];

const ALL_FIELDS: FieldKey[] = [
  "email",
  "company",
  "website",
  "instagram",
  "linkedin",
  "timeline",
  "pain_points",
  "main_goal",
];

export function ProfilePanel({
  contactId,
  initial,
  profileUpdatedAt,
  profileEnrichingUntil,
}: {
  contactId: string;
  initial: ProfileFields;
  profileUpdatedAt: string | null;
  profileEnrichingUntil: string | null;
}) {
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [values, setValues] = useState<ProfileFields>(initial);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(profileUpdatedAt);
  const [enrichingUntil, setEnrichingUntil] = useState<string | null>(profileEnrichingUntil);
  // Field keys that just changed via realtime — used to flash background briefly
  const [flashing, setFlashing] = useState<Set<FieldKey>>(new Set());
  const flashTimers = useRef<Map<FieldKey, ReturnType<typeof setTimeout>>>(new Map());
  // Tick every 2s so the enriching-window expiry is observed without
  // computing Date.now() during render.
  const now = useClientNow(2000);

  // Realtime: when this contact row updates, merge profile fields into local state
  useRealtimeUpdates<ContactRealtimePayload>(
    "contacts",
    `id=eq.${contactId}`,
    (payload) => {
      const incoming = payload.new;
      // Update enriching/updated_at metadata
      if (incoming.profile_enriching_until !== undefined) {
        setEnrichingUntil(incoming.profile_enriching_until);
      }
      if (incoming.profile_updated_at !== undefined) {
        setUpdatedAt(incoming.profile_updated_at);
      }
      // Merge profile fields. Skip the field currently being edited (preserve draft).
      setValues((prev) => {
        const next: ProfileFields = { ...prev };
        const changedKeys: FieldKey[] = [];
        for (const f of ALL_FIELDS) {
          if (f === editing) continue; // don't overwrite user's in-progress edit
          if (f in incoming) {
            const value = (incoming[f] ?? null) as string | null;
            if (value !== prev[f]) {
              next[f] = value;
              if (value !== null && value !== "") changedKeys.push(f);
            }
          }
        }
        // Flash recently-changed fields for 3s
        if (changedKeys.length > 0) {
          setFlashing((current) => {
            const ns = new Set(current);
            for (const k of changedKeys) ns.add(k);
            return ns;
          });
          for (const k of changedKeys) {
            const existing = flashTimers.current.get(k);
            if (existing) clearTimeout(existing);
            const t = setTimeout(() => {
              setFlashing((current) => {
                const ns = new Set(current);
                ns.delete(k);
                return ns;
              });
              flashTimers.current.delete(k);
            }, 3000);
            flashTimers.current.set(k, t);
          }
        }
        return next;
      });
    },
  );

  // Cleanup on unmount
  useEffect(() => {
    const timers = flashTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  function start(field: FieldKey) {
    setEditing(field);
    setDraft(values[field] ?? "");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const body = { [editing]: draft.trim() || null };
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setValues((prev) => ({ ...prev, [editing]: draft.trim() || null }));
        setEditing(null);
      }
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setEditing(null);
    setDraft("");
  }

  const hasAny = ORDER.some((k) => values[k]);
  const isEnriching =
    !!enrichingUntil &&
    now != null &&
    new Date(enrichingUntil).getTime() > now;

  return (
    <Card className="rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground",
              isEnriching && "animate-pulse text-accent-foreground",
            )}
          />
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Perfil del lead
          </div>
        </div>
        {isEnriching ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            UtopIA está completando…
          </span>
        ) : updatedAt ? (
          <span className="text-[10px] text-muted-foreground tabular">
            actualizado · {new Date(updatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
          </span>
        ) : null}
      </div>

      {!hasAny && !isEnriching && (
        <p className="text-xs text-muted-foreground">
          UtopIA va a ir completando estos datos automáticamente a medida que el
          cliente charle. También podés editarlos a mano tocando cada campo.
        </p>
      )}

      <dl className="space-y-2.5">
        {ORDER.map((field) => {
          const isEditing = editing === field;
          const value = values[field];
          const isTextarea = TEXTAREA_FIELDS.includes(field);
          const isFlashing = flashing.has(field);
          return (
            <div
              key={field}
              className={cn(
                "group -mx-2 rounded-md px-2 transition-colors duration-1000",
                isFlashing && "bg-accent/30",
              )}
            >
              <dt className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {LABELS[field]}
                  {isFlashing && (
                    <span className="ml-1.5 text-[9px] text-accent-foreground">
                      · ✨ recién agregado
                    </span>
                  )}
                </Label>
                {!isEditing && (
                  <button
                    onClick={() => start(field)}
                    className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                    aria-label={`Editar ${LABELS[field]}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </dt>
              <dd className="mt-1">
                {isEditing ? (
                  <div className="space-y-1.5">
                    {isTextarea ? (
                      <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={3}
                        className="text-sm"
                        autoFocus
                      />
                    ) : (
                      <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="text-sm"
                        autoFocus
                      />
                    )}
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={save} disabled={saving}>
                        <Save className="h-3 w-3" />
                        Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancel}>
                        <X className="h-3 w-3" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : value ? (
                  <p className="whitespace-pre-wrap text-sm leading-snug">{value}</p>
                ) : (
                  <button
                    onClick={() => start(field)}
                    className="text-xs italic text-muted-foreground/60 hover:text-foreground"
                  >
                    sin definir · click para agregar
                  </button>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}

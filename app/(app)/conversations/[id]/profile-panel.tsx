"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function ProfilePanel({
  contactId,
  initial,
  profileUpdatedAt,
}: {
  contactId: string;
  initial: ProfileFields;
  profileUpdatedAt: string | null;
}) {
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [values, setValues] = useState<ProfileFields>(initial);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

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

  return (
    <Card className="rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Perfil del lead
          </div>
        </div>
        {profileUpdatedAt && (
          <span className="text-[10px] text-muted-foreground tabular">
            actualizado · {new Date(profileUpdatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
          </span>
        )}
      </div>

      {!hasAny && (
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
          return (
            <div key={field} className="group">
              <dt className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {LABELS[field]}
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

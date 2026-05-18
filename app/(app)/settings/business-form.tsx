"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  type BusinessProfile,
  type ProfileField,
} from "@/lib/utopia-prompt";

type FormState = Partial<Omit<BusinessProfile, "updated_at">>;

/**
 * Generic editor for a slice of business_profile. The fields prop decides
 * which subset of the singleton row gets rendered (Negocio tab uses one
 * group, Derivación tab uses another), so a single form component covers
 * both surfaces.
 */
export function BusinessForm({
  initialProfile,
  fields,
  helpText,
}: {
  initialProfile: BusinessProfile | null;
  fields: ProfileField[];
  helpText?: string;
}) {
  const [form, setForm] = useState<FormState>(() => {
    const init: FormState = {};
    for (const { key } of fields) {
      init[key] = initialProfile?.[key] ?? "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/business-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {fields.map(({ key, label, placeholder, rows }) => {
        const id = `bp-${key}`;
        const value = (form[key] as string | null | undefined) ?? "";
        return (
          <div key={key} className="space-y-1.5">
            <Label
              htmlFor={id}
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              {label}
            </Label>
            {rows === 1 ? (
              <Input
                id={id}
                value={value}
                placeholder={placeholder}
                onChange={(e) => update(key, e.target.value)}
              />
            ) : (
              <Textarea
                id={id}
                value={value}
                placeholder={placeholder}
                rows={rows}
                onChange={(e) => update(key, e.target.value)}
                className="text-sm leading-relaxed"
              />
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        {savedAt && (
          <span className="text-xs text-muted-foreground tabular">
            ✓ Guardado · {savedAt.toLocaleTimeString("es-AR")}
          </span>
        )}
      </div>

      {helpText && (
        <p className="rounded-md bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          {helpText}
        </p>
      )}
    </div>
  );
}

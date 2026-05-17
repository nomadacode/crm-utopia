"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  BUSINESS_PROFILE_FIELDS,
  type BusinessProfile,
} from "@/lib/utopia-prompt";

type FormState = Partial<Omit<BusinessProfile, "updated_at">>;

export function BusinessForm({
  initialProfile,
}: {
  initialProfile: BusinessProfile | null;
}) {
  const [form, setForm] = useState<FormState>(() => {
    const init: FormState = {};
    for (const { key } of BUSINESS_PROFILE_FIELDS) {
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
      {BUSINESS_PROFILE_FIELDS.map(({ key, label, placeholder, rows }) => {
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
          {saving ? "Guardando…" : "Guardar información"}
        </Button>
        {savedAt && (
          <span className="text-xs text-muted-foreground tabular">
            ✓ Guardado · {savedAt.toLocaleTimeString("es-AR")}
          </span>
        )}
      </div>

      <p className="rounded-md bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Cómo se usa:</strong> esta información se
        inyecta automáticamente en cada respuesta de UtopIA. Solo aparecerá en lo que
        UtopIA dice si la conversación lo amerita (UtopIA decide cuándo es relevante
        usarla). Los campos vacíos no se envían al modelo.
      </p>
    </div>
  );
}

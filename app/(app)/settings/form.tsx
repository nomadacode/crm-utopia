"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function SettingsForm({ initialPrompt }: { initialPrompt: string }) {
  const [value, setValue] = useState(initialPrompt);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function onSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (res.ok) setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="prompt" className="text-xs uppercase tracking-wider text-muted-foreground">
          System prompt
        </Label>
        <Textarea
          id="prompt"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={14}
          className="font-mono text-sm leading-relaxed"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        {savedAt && (
          <span className="text-sm text-muted-foreground tabular">
            Guardado · {savedAt.toLocaleTimeString("es-AR")}
          </span>
        )}
      </div>
    </div>
  );
}

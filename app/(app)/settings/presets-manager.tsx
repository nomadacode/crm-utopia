"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptPreset } from "@/lib/utopia-prompt";

type Mode = { kind: "view" } | { kind: "edit"; preset: PromptPreset } | { kind: "create" };

const TEMPLATES: Record<string, { name: string; system_prompt: string }> = {
  agencia: {
    name: "Agencia",
    system_prompt: `Sos UtopIA, asistente de una agencia de marketing. Hablás en español argentino con voseo. Mensajes cortos (<30 palabras), max 2 emojis, sin markdown. Hablás con {{nombre}}. Hora actual: {{ahora}}.

Tu objetivo: detectar si el cliente busca un servicio concreto (web, redes, automatizaciones, IA). Si sí, calificar el proyecto con 2-3 preguntas (industria, deadline, presupuesto orientativo). Solo cuando hay interés real concreto, ofrecés link para agendar reunión. Nunca inventás precios.`,
  },
  ventas: {
    name: "Ventas",
    system_prompt: `Sos UtopIA, asistente comercial. Hablás en español argentino con voseo, mensajes cortos (<30 palabras), max 2 emojis, sin markdown. Estás conversando con {{nombre}}.

Tu rol: entender el problema del cliente y proponerle la solución correcta. Usás preguntas abiertas. Si ya conociste su caso ({{ultima_interaccion}} desde la última interacción), retomás el contexto. Cuando hay interés, sugerís próximos pasos concretos.`,
  },
  soporte: {
    name: "Soporte",
    system_prompt: `Sos UtopIA, asistente de soporte técnico. Hablás en español argentino con voseo, claro y empático. Mensajes cortos (<30 palabras), sin markdown, max 1 emoji.

Hablás con {{nombre}}. Tu rol: entender el problema, intentar resolverlo con preguntas guiadas o pasos básicos, y si excede tu alcance, derivar a un humano avisando que abrís un ticket. Nunca prometés tiempos de resolución específicos.`,
  },
  clinica: {
    name: "Clínica / Salud",
    system_prompt: `Sos UtopIA, asistente de una clínica. Hablás en español argentino con voseo, tono cálido y profesional. Mensajes cortos (<30 palabras), sin markdown, max 1 emoji.

Tu rol: orientar a {{nombre}} sobre turnos, especialidades disponibles, o información administrativa. NUNCA das consejos médicos, diagnósticos ni recomendaciones de medicación. Para temas médicos siempre derivás a profesional.`,
  },
  blanco: {
    name: "En blanco",
    system_prompt: `Sos UtopIA. Hablás en español argentino con voseo.

`,
  },
};

const VARIABLES = [
  { key: "nombre", desc: "Nombre del contacto (o 'cliente')" },
  { key: "telefono", desc: "Teléfono del contacto" },
  { key: "ahora", desc: "Día y hora actual (Argentina)" },
  { key: "tags", desc: "Tags asignados al contacto" },
  { key: "ultima_interaccion", desc: "Tiempo desde el último mensaje del cliente" },
];

export function PresetsManager({
  initialPresets,
}: {
  initialPresets: PromptPreset[];
}) {
  const [presets, setPresets] = useState<PromptPreset[]>(initialPresets);
  const [mode, setMode] = useState<Mode>({ kind: "view" });

  async function activate(id: string) {
    const res = await fetch(`/api/presets/${id}/activate`, { method: "POST" });
    if (res.ok) {
      setPresets((prev) =>
        prev.map((p) => ({ ...p, is_active: p.id === id })),
      );
    }
  }

  async function save(input: { id?: string; name: string; system_prompt: string }) {
    const url = input.id ? `/api/presets/${input.id}` : "/api/presets";
    const method = input.id ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: input.name, system_prompt: input.system_prompt }),
    });
    if (res.ok) {
      const updated = (await res.json()) as PromptPreset;
      setPresets((prev) => {
        const exists = prev.find((p) => p.id === updated.id);
        if (exists) return prev.map((p) => (p.id === updated.id ? updated : p));
        return [...prev, updated];
      });
      setMode({ kind: "view" });
    }
  }

  async function remove(preset: PromptPreset) {
    if (preset.is_active) {
      alert("No podés borrar el preset activo. Primero activá otro.");
      return;
    }
    if (!confirm(`¿Borrar el preset "${preset.name}"?`)) return;
    const res = await fetch(`/api/presets/${preset.id}`, { method: "DELETE" });
    if (res.ok) setPresets((prev) => prev.filter((p) => p.id !== preset.id));
  }

  if (mode.kind !== "view") {
    return (
      <PresetEditor
        initial={mode.kind === "edit" ? mode.preset : null}
        onCancel={() => setMode({ kind: "view" })}
        onSave={save}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Presets ({presets.length})
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode({ kind: "create" })}
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo preset
        </Button>
      </div>

      <ul className="space-y-2">
        {presets.map((preset) => (
          <li
            key={preset.id}
            className={cn(
              "rounded-md border bg-background px-4 py-3 transition-colors",
              preset.is_active ? "border-foreground" : "border-border",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{preset.name}</span>
                  {preset.is_active && (
                    <span className="inline-flex items-center gap-0.5 rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background">
                      <Check className="h-2.5 w-2.5" />
                      Activo
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {preset.system_prompt}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!preset.is_active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => activate(preset.id)}
                  >
                    Activar
                  </Button>
                )}
                <button
                  onClick={() => setMode({ kind: "edit", preset })}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Editar preset"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(preset)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Borrar preset"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-md bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Variables disponibles en el prompt:</p>
        <ul className="mt-1.5 space-y-0.5 tabular">
          {VARIABLES.map((v) => (
            <li key={v.key}>
              <code className="rounded bg-background px-1 py-0.5">{`{{${v.key}}}`}</code>{" "}
              · {v.desc}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PresetEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: PromptPreset | null;
  onCancel: () => void;
  onSave: (input: { id?: string; name: string; system_prompt: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? "");
  const [saving, setSaving] = useState(false);
  const isCreate = !initial;

  function applyTemplate(key: string) {
    const t = TEMPLATES[key];
    if (!t) return;
    setName(t.name);
    setSystemPrompt(t.system_prompt);
  }

  async function handleSave() {
    if (!name.trim() || !systemPrompt.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        system_prompt: systemPrompt.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">
          {isCreate ? "Nuevo preset" : `Editando: ${initial?.name}`}
        </h2>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      {isCreate && (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Empezar desde un template (opcional)
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyTemplate(key)}
              >
                {t.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Nombre
        </Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Ventas, Soporte, Clínica…"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          System prompt
        </Label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={14}
          className="font-mono text-sm leading-relaxed"
          placeholder="Definí cómo se comporta UtopIA. Podés usar {{nombre}}, {{ahora}}, etc."
        />
      </div>

      <Button onClick={handleSave} disabled={!name.trim() || !systemPrompt.trim() || saving}>
        {saving ? "Guardando…" : isCreate ? "Crear preset" : "Guardar cambios"}
      </Button>
    </div>
  );
}

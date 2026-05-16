"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PipelineStage } from "@/lib/types";

export function DealPanel({
  contactId,
  initialStageId,
  initialIndustry,
  initialDealValue,
  stages,
}: {
  contactId: string;
  initialStageId: string | null;
  initialIndustry: string | null;
  initialDealValue: number | null;
  stages: PipelineStage[];
}) {
  const [stageId, setStageId] = useState(initialStageId ?? "");
  const [industry, setIndustry] = useState(initialIndustry ?? "");
  const [dealValue, setDealValue] = useState(
    initialDealValue == null ? "" : String(initialDealValue),
  );
  const [, startTransition] = useTransition();

  function patch(body: Record<string, unknown>) {
    startTransition(async () => {
      await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    });
  }

  return (
    <Card className="rounded-lg p-5 space-y-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Negocio
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Etapa</Label>
        <select
          value={stageId}
          onChange={(e) => {
            const v = e.target.value;
            setStageId(v);
            patch({ stage_id: v || null });
          }}
          className="block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">(sin etapa)</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Industria</Label>
        <Input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          onBlur={() => patch({ industry: industry || null })}
          placeholder="Ej: Salud, E-commerce…"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Valor estimado (USD)</Label>
        <Input
          type="number"
          inputMode="decimal"
          value={dealValue}
          onChange={(e) => setDealValue(e.target.value)}
          onBlur={() => patch({ deal_value: dealValue === "" ? null : Number(dealValue) })}
          placeholder="0"
        />
      </div>
    </Card>
  );
}

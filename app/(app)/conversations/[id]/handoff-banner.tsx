"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { EscalationReason } from "@/lib/types";

const REASON_LABEL: Record<EscalationReason, string> = {
  explicit_request: "El cliente pidió hablar con un humano",
  frustration: "El cliente expresó frustración",
  manual: "Escalado manualmente desde el CRM",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function HandoffBanner({
  contactId,
  reason,
  escalatedAt,
}: {
  contactId: string;
  reason: EscalationReason;
  escalatedAt: string;
}) {
  const [resolving, setResolving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function resolve() {
    setResolving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/resolve-handoff`, {
        method: "POST",
      });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-900">
          Este contacto necesita atención humana
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          {REASON_LABEL[reason]} · escalado {timeAgo(escalatedAt)}. UtopIA quedó
          pausada hasta que marques como atendido.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={resolve}
        disabled={resolving}
        className="shrink-0 border-amber-400 bg-amber-100 hover:bg-amber-200"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {resolving ? "Resolviendo…" : "Marcar como atendido"}
      </Button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { EscalationReason } from "@/lib/types";
import { useClientNow } from "@/lib/hooks";
import { useRealtimeUpdates } from "@/lib/supabase/realtime";

const REASON_LABEL: Record<EscalationReason, string> = {
  explicit_request: "El cliente pidió hablar con un humano",
  frustration: "El cliente expresó frustración",
  manual: "Escalado manualmente desde el CRM",
  bot_initiated: "UtopIA decidió derivar — no pudo resolver la consulta",
};

function timeAgo(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

type HandoffState = {
  needs_human: boolean;
  escalation_reason: EscalationReason | null;
  escalated_at: string | null;
};

/**
 * Always mounted (regardless of current escalation state) so the realtime
 * subscription is live when the bot escalates mid-conversation. Renders null
 * when the contact doesn't need human attention.
 */
export function HandoffBanner({
  contactId,
  initial,
}: {
  contactId: string;
  initial: HandoffState;
}) {
  const [state, setState] = useState<HandoffState>(initial);
  const [resolving, setResolving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const now = useClientNow();

  useRealtimeUpdates<HandoffState>(
    "contacts",
    `id=eq.${contactId}`,
    (payload) => {
      const next = payload.new;
      setState({
        needs_human: next.needs_human ?? false,
        escalation_reason: next.escalation_reason ?? null,
        escalated_at: next.escalated_at ?? null,
      });
    },
  );

  async function resolve() {
    setResolving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/resolve-handoff`, {
        method: "POST",
      });
      if (res.ok) {
        // Hide optimistically — the realtime UPDATE will arrive shortly with
        // the same shape but this avoids waiting for the round-trip.
        setState({
          needs_human: false,
          escalation_reason: null,
          escalated_at: null,
        });
        startTransition(() => router.refresh());
      }
    } finally {
      setResolving(false);
    }
  }

  if (!state.needs_human || !state.escalation_reason || !state.escalated_at) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-900">
          Este contacto necesita atención humana
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          {REASON_LABEL[state.escalation_reason]}
          {now != null && <> · escalado {timeAgo(state.escalated_at, now)}</>}.{" "}
          UtopIA quedó pausada hasta que marques como atendido.
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

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useRealtimeInserts } from "@/lib/supabase/realtime";

type LeadScore = "hot" | "warm" | "cold";

type LeadRow = {
  contact_id: string;
  score: LeadScore;
  reason: string;
  qualified_at: string;
};

const SCORE_LABELS: Record<LeadScore, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};
const SCORE_CLASSES: Record<LeadScore, string> = {
  hot: "bg-accent",
  warm: "bg-amber-400",
  cold: "bg-zinc-300",
};

export function LeadCard({
  contactId,
  initialScore,
  initialReason,
}: {
  contactId: string;
  initialScore: LeadScore | undefined;
  initialReason: string | undefined;
}) {
  const [state, setState] = useState<{
    score: LeadScore | undefined;
    reason: string | undefined;
  }>({ score: initialScore, reason: initialReason });

  // Lead classifications are append-only: every new INSERT for this contact
  // becomes the current score. The list page sorts by qualified_at desc, but
  // the only event we can receive on a stale conversation page is a new INSERT
  // — which by definition is the latest.
  useRealtimeInserts<LeadRow>(
    "leads",
    `contact_id=eq.${contactId}`,
    (payload) => {
      setState({
        score: payload.new.score,
        reason: payload.new.reason,
      });
    },
  );

  return (
    <Card className="rounded-lg p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Lead
      </div>
      {state.score ? (
        <>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${SCORE_CLASSES[state.score]}`}
            />
            <span className="text-base font-medium">{SCORE_LABELS[state.score]}</span>
          </div>
          {state.reason && (
            <p className="mt-2 text-sm leading-snug text-muted-foreground">
              {state.reason}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Sin clasificar</p>
      )}
    </Card>
  );
}

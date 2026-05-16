import { Card } from "@/components/ui/card";

type LeadScore = "hot" | "warm" | "cold";

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
  score,
  reason,
}: {
  score: LeadScore | undefined;
  reason: string | undefined;
}) {
  return (
    <Card className="rounded-lg p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Lead
      </div>
      {score ? (
        <>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${SCORE_CLASSES[score]}`}
            />
            <span className="text-base font-medium">{SCORE_LABELS[score]}</span>
          </div>
          {reason && (
            <p className="mt-2 text-sm leading-snug text-muted-foreground">
              {reason}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Sin clasificar</p>
      )}
    </Card>
  );
}

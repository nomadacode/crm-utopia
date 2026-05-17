"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function ConversationControls({
  contactId,
  initialBlocked,
  initialBotEnabled,
  initialArchived,
  initialNeedsHuman,
}: {
  contactId: string;
  initialBlocked: boolean;
  initialBotEnabled: boolean;
  initialArchived: boolean;
  initialNeedsHuman: boolean;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [botEnabled, setBotEnabled] = useState(initialBotEnabled);
  const [archived, setArchived] = useState(initialArchived);
  const [escalating, setEscalating] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function update(patch: {
    blocked?: boolean;
    bot_enabled?: boolean;
    archived?: boolean;
  }) {
    startTransition(async () => {
      await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    });
  }

  async function escalateManually() {
    if (
      !confirm(
        "¿Marcar este contacto como 'necesita humano'? El bot quedará pausado hasta que lo resuelvas.",
      )
    )
      return;
    setEscalating(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/escalate`, {
        method: "POST",
      });
      if (res.ok) {
        setBotEnabled(false);
        startTransition(() => router.refresh());
      }
    } finally {
      setEscalating(false);
    }
  }

  return (
    <Card className="space-y-4 rounded-lg p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Controles
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="bot" className="text-sm">
          Respuestas automáticas
        </Label>
        <Switch
          id="bot"
          checked={botEnabled}
          onCheckedChange={(v) => {
            setBotEnabled(v);
            update({ bot_enabled: v });
          }}
        />
      </div>

      {!initialNeedsHuman && (
        <Button
          variant="outline"
          className="w-full"
          onClick={escalateManually}
          disabled={escalating}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {escalating ? "Escalando…" : "Escalar manualmente"}
        </Button>
      )}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          const next = !archived;
          setArchived(next);
          update({ archived: next });
        }}
      >
        {archived ? "Desarchivar conversación" : "Archivar conversación"}
      </Button>

      <Button
        variant={blocked ? "default" : "destructive"}
        className="w-full"
        onClick={() => {
          const next = !blocked;
          setBlocked(next);
          update({ blocked: next });
        }}
      >
        {blocked ? "Desbloquear contacto" : "Bloquear contacto"}
      </Button>
    </Card>
  );
}

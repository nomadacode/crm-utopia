"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ConversationControls({
  contactId,
  initialBlocked,
  initialBotEnabled,
  initialArchived,
}: {
  contactId: string;
  initialBlocked: boolean;
  initialBotEnabled: boolean;
  initialArchived: boolean;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [botEnabled, setBotEnabled] = useState(initialBotEnabled);
  const [archived, setArchived] = useState(initialArchived);
  const [, startTransition] = useTransition();

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

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
}: {
  contactId: string;
  initialBlocked: boolean;
  initialBotEnabled: boolean;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [botEnabled, setBotEnabled] = useState(initialBotEnabled);
  const [, startTransition] = useTransition();

  function update(patch: { blocked?: boolean; bot_enabled?: boolean }) {
    startTransition(async () => {
      await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    });
  }

  return (
    <Card className="space-y-4 rounded-3xl p-6">
      <h3 className="text-sm font-medium text-muted-foreground">Controles</h3>

      <div className="flex items-center justify-between">
        <Label htmlFor="bot" className="text-sm">
          Bot ON
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
        variant={blocked ? "default" : "destructive"}
        className="w-full rounded-2xl"
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

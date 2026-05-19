"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, Plus, Bell } from "lucide-react";
import type { Reminder } from "@/lib/types";
import {
  useRealtimeInserts,
  useRealtimeUpdates,
} from "@/lib/supabase/realtime";

function defaultRemindAt(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const offset = tomorrow.getTimezoneOffset() * 60_000;
  return new Date(tomorrow.getTime() - offset).toISOString().slice(0, 16);
}

export function RemindersPanel({
  contactId,
  initialReminders,
}: {
  contactId: string;
  initialReminders: Reminder[];
}) {
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [remindAt, setRemindAt] = useState(defaultRemindAt());
  const [saving, setSaving] = useState(false);

  // Pick up new reminders created from cron jobs, automations, or other
  // sessions. INSERT inserts in sorted position; UPDATE handles dismissals
  // (the dismiss endpoint sets dismissed_at instead of deleting).
  useRealtimeInserts<Reminder>(
    "reminders",
    `contact_id=eq.${contactId}`,
    (payload) => {
      setReminders((prev) =>
        prev.some((r) => r.id === payload.new.id)
          ? prev
          : [...prev, payload.new].sort((a, b) =>
              a.remind_at.localeCompare(b.remind_at),
            ),
      );
    },
  );

  useRealtimeUpdates<Reminder>(
    "reminders",
    `contact_id=eq.${contactId}`,
    (payload) => {
      const next = payload.new;
      setReminders((prev) =>
        prev.map((r) => (r.id === next.id ? { ...r, ...next } : r)),
      );
    },
  );

  async function create() {
    if (!message.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          remind_at: new Date(remindAt).toISOString(),
        }),
      });
      if (res.ok) {
        const reminder = (await res.json()) as Reminder;
        setReminders((prev) =>
          [...prev, reminder].sort((a, b) =>
            a.remind_at.localeCompare(b.remind_at),
          ),
        );
        setMessage("");
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function dismiss(id: string) {
    const res = await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    });
    if (res.ok) setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  const pending = reminders.filter((r) => !r.dismissed_at);

  return (
    <Card className="rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Recordatorios
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Crear recordatorio"
        >
          <Plus
            className={`h-4 w-4 transition-transform ${open ? "rotate-45" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div className="space-y-2 rounded-md bg-muted/40 p-3">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ej: Volver a contactar para confirmar reunión"
            rows={2}
            className="text-sm"
          />
          <Input
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={create}
            disabled={!message.trim() || saving}
            className="w-full"
          >
            {saving ? "Programando…" : "Programar"}
          </Button>
        </div>
      )}

      {pending.length === 0 && !open && (
        <p className="text-sm text-muted-foreground">Sin recordatorios pendientes.</p>
      )}

      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm"
            >
              <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="leading-snug">{r.message}</p>
                <p className="mt-0.5 text-[10px] tabular text-muted-foreground">
                  {new Date(r.remind_at).toLocaleString("es-AR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Argentina/Buenos_Aires",
                  })}
                </p>
              </div>
              <button
                onClick={() => dismiss(r.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Marcar como hecho"
                title="Marcar como hecho"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SendMessageForm({
  contactId,
  onSend,
  onFailed,
}: {
  contactId: string;
  onSend?: (content: string) => void;
  onFailed?: (content: string) => void;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    // Optimistic: clear input + show pending bubble immediately
    setValue("");
    onSend?.(trimmed);
    try {
      const res = await fetch(`/api/contacts/${contactId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("send failed", err);
        onFailed?.(trimmed);
      }
      // On success, realtime INSERT will replace the pending bubble with the real one.
    } catch (err) {
      console.error("send threw", err);
      onFailed?.(trimmed);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        placeholder="Escribir mensaje manual…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={sending}
      />
      <Button type="submit" disabled={sending}>
        Enviar
      </Button>
    </form>
  );
}

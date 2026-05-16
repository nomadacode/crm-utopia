"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SendMessageForm({ contactId }: { contactId: string }) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value.trim() }),
      });
      if (res.ok) {
        setValue("");
        router.refresh();
      } else {
        const err = await res.json();
        alert("Error: " + (err.error ?? "no se pudo enviar"));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2 border-t border-border pt-4">
      <Input
        placeholder="Escribir mensaje manual..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={sending}
        className="rounded-2xl"
      />
      <Button type="submit" disabled={sending} className="rounded-2xl">
        Enviar
      </Button>
    </form>
  );
}

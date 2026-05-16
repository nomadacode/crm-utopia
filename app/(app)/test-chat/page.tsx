"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Msg = { role: "user" | "assistant"; content: string };

export default function TestChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: value.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setValue("");
    setLoading(true);
    try {
      const res = await fetch("/api/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history }),
      });
      if (res.ok) {
        const { reply } = await res.json();
        setMessages([...history, { role: "assistant", content: reply }]);
      } else {
        setMessages([
          ...history,
          { role: "assistant", content: "(error generando respuesta)" },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Test chat</h1>
        <Badge className="rounded-full bg-accent text-accent-foreground">
          MODO TEST
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Probá a UtopIA sin gastar WhatsApp. Estos mensajes NO se guardan en la DB.
      </p>

      <Card className="flex h-[60vh] flex-col rounded-3xl p-6">
        <div className="flex-1 space-y-3 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Escribí algo abajo para empezar.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "assistant" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-3xl px-4 py-2 text-sm ${
                  m.role === "assistant"
                    ? "bg-foreground text-background"
                    : "bg-muted"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-end">
              <div className="rounded-3xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                UtopIA está escribiendo...
              </div>
            </div>
          )}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border pt-4">
          <Input
            placeholder="Hola, ¿cómo va?"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={loading}
            className="rounded-2xl"
          />
          <Button type="submit" disabled={loading} className="rounded-2xl">
            Enviar
          </Button>
        </form>
      </Card>
    </div>
  );
}

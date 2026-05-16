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
    setMessages([...history, { role: "assistant", content: "" }]);
    setValue("");
    setLoading(true);
    try {
      const res = await fetch("/api/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history }),
      });
      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: "(error generando respuesta)",
          };
          return next;
        });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        acc += decoder.decode(chunk, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Sandbox
          </p>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
            test
          </Badge>
        </div>
        <h1 className="text-3xl font-medium tracking-display">Test chat</h1>
        <p className="text-sm text-muted-foreground">
          Probá a UtopIA sin enviar nada a WhatsApp. Los mensajes no se guardan.
        </p>
      </header>

      <Card className="flex h-[60vh] flex-col overflow-hidden rounded-lg p-0">
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-5">
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
                className={`max-w-[70%] rounded-md px-3.5 py-2 text-sm leading-snug ${
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
              <div className="rounded-md bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                UtopIA está escribiendo…
              </div>
            </div>
          )}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border px-5 py-3">
          <Input
            placeholder="Hola, ¿cómo va?"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" disabled={loading}>
            Enviar
          </Button>
        </form>
      </Card>
    </div>
  );
}

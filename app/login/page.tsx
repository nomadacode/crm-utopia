"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm rounded-lg p-7">
        <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          UtopIA
        </div>
        <h1 className="text-2xl font-medium tracking-display">Entrar al CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Te mandamos un magic link a tu email.
        </p>

        {status === "sent" ? (
          <div className="mt-6 rounded-md border border-border bg-muted/50 p-3 text-sm">
            Revisá tu email. El link expira en 1 hora.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <Input
              type="email"
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              type="submit"
              disabled={status === "sending"}
              className="w-full"
            >
              {status === "sending" ? "Enviando…" : "Enviar link"}
            </Button>
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
          </form>
        )}
      </Card>
    </main>
  );
}

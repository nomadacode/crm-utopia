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
      <Card className="w-full max-w-md rounded-3xl p-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          UtopIA
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Entrar al CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Te mandamos un magic link a tu email.
        </p>

        {status === "sent" ? (
          <div className="mt-6 rounded-2xl bg-accent/40 p-4 text-sm">
            ✓ Revisá tu email. El link expira en 1 hora.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <Input
              type="email"
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-2xl"
            />
            <Button
              type="submit"
              disabled={status === "sending"}
              className="h-11 w-full rounded-2xl"
            >
              {status === "sending" ? "Enviando..." : "Enviar link"}
            </Button>
            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
          </form>
        )}
      </Card>
    </main>
  );
}

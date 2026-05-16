import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          UtopIA · WhatsApp CRM
        </div>
        <h1 className="text-4xl font-medium tracking-display sm:text-5xl">
          Tu agente de WhatsApp,
          <br />
          siempre disponible.
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Responde, califica leads y hace follow-up automático. Vos te encargás
          de cerrar.
        </p>

        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: "lg" }), "px-5")}
          >
            Entrar al panel
          </Link>
          <Link
            href="/test-chat"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-5")}
          >
            Probar UtopIA
          </Link>
        </div>
      </div>
    </main>
  );
}

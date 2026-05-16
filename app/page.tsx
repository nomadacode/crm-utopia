import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MessageCircle, Sparkles, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-8">
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            UtopIA · WhatsApp CRM
          </div>
          <h1 className="text-5xl font-semibold tracking-tight">
            Tu agente de WhatsApp,
            <br />
            siempre disponible.
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Responde, califica leads y hace follow-up automático. Vos solo te
            encargás de cerrar.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="rounded-3xl p-6">
            <MessageCircle className="mb-3 h-6 w-6" />
            <h3 className="font-semibold">Conversaciones</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Todas tus charlas en un panel.
            </p>
          </Card>
          <Card className="rounded-3xl p-6">
            <Sparkles className="mb-3 h-6 w-6" />
            <h3 className="font-semibold">Leads automáticos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Hot / Warm / Cold sin levantar un dedo.
            </p>
          </Card>
          <Card className="rounded-3xl p-6">
            <BarChart3 className="mb-3 h-6 w-6" />
            <h3 className="font-semibold">Métricas</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Dashboard con todo lo importante.
            </p>
          </Card>
        </div>

        <div className="flex justify-center gap-3">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}
          >
            Entrar al panel
          </Link>
          <Link
            href="/test-chat"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "rounded-full px-6",
            )}
          >
            Probar UtopIA
          </Link>
        </div>
      </div>
    </main>
  );
}

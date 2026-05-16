import Link from "next/link";
import { getSystemPrompt } from "@/lib/utopia-prompt";
import { SettingsForm } from "./form";
import { Card } from "@/components/ui/card";
import { Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prompt = await getSystemPrompt();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Configuración
        </p>
        <h1 className="text-3xl font-medium tracking-display">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Personalizá el prompt que define cómo responde UtopIA.
        </p>
      </header>

      <Card className="rounded-lg p-6">
        <SettingsForm initialPrompt={prompt} />
      </Card>

      <Link
        href="/settings/tags"
        className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-3">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Tags</div>
            <div className="text-xs text-muted-foreground">
              Etiquetas que asignás a los contactos para organizar la bandeja.
            </div>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Administrar →</span>
      </Link>
    </div>
  );
}

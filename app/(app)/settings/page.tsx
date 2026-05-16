import { getSystemPrompt } from "@/lib/utopia-prompt";
import { SettingsForm } from "./form";
import { Card } from "@/components/ui/card";

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
    </div>
  );
}

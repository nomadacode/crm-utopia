import { getSystemPrompt } from "@/lib/utopia-prompt";
import { SettingsForm } from "./form";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prompt = await getSystemPrompt();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Personalizá el prompt que define cómo responde UtopIA.
        </p>
      </div>
      <Card className="rounded-3xl p-6">
        <SettingsForm initialPrompt={prompt} />
      </Card>
    </div>
  );
}

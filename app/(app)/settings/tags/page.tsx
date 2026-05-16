import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { TagsManager } from "./tags-manager";
import type { Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TagsSettingsPage() {
  const sb = supabaseAdmin();
  const { data: tags } = await sb.from("tags").select("*").order("name");
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Configuración
        </p>
        <h1 className="text-3xl font-medium tracking-display">Tags</h1>
        <p className="text-sm text-muted-foreground">
          Etiquetas que podés asignar a los contactos para organizar la bandeja.
        </p>
      </header>
      <Card className="rounded-lg p-6">
        <TagsManager initialTags={(tags ?? []) as Tag[]} />
      </Card>
    </div>
  );
}

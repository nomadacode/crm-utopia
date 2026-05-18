import {
  listPresets,
  getBusinessProfile,
  BUSINESS_FIELDS,
  HANDOFF_FIELDS,
} from "@/lib/utopia-prompt";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PresetsManager } from "./presets-manager";
import { BusinessForm } from "./business-form";
import { TagsManager } from "./tags-manager";
import { SettingsTabs } from "./settings-tabs";
import type { Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sb = supabaseAdmin();
  const [presets, businessProfile, tagsRes] = await Promise.all([
    listPresets(),
    getBusinessProfile(),
    sb.from("tags").select("*").order("name"),
  ]);
  const tags = (tagsRes.data ?? []) as Tag[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Configuración
        </p>
        <h1 className="text-3xl font-medium tracking-display">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Personalizá el comportamiento de UtopIA y la información que usa para responder.
        </p>
      </header>

      <SettingsTabs
        negocio={
          <BusinessForm
            initialProfile={businessProfile}
            fields={BUSINESS_FIELDS}
            helpText="Esta información se inyecta automáticamente en cada respuesta de UtopIA. Solo aparece en lo que dice si la conversación lo amerita. Campos vacíos no se envían al modelo."
          />
        }
        personalidad={<PresetsManager initialPresets={presets} />}
        derivacion={
          <BusinessForm
            initialProfile={businessProfile}
            fields={HANDOFF_FIELDS}
            helpText="Las reglas de cuándo derivar son editables (campo de arriba). La señal técnica que el bot usa internamente para alertar al equipo está hardcodeada en el código — no se puede romper desde acá."
          />
        }
        tags={<TagsManager initialTags={tags} />}
      />
    </div>
  );
}

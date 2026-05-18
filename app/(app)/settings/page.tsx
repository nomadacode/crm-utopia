import {
  listPresets,
  getBusinessProfile,
  BUSINESS_FIELDS,
  HANDOFF_FIELDS,
} from "@/lib/utopia-prompt";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { PresetsManager } from "./presets-manager";
import { BusinessForm } from "./business-form";
import { TagsManager } from "./tags-manager";
import { SettingsTabs } from "./settings-tabs";
import { UsersManager } from "./users-manager";
import type { Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
  role: "admin" | "agent";
  is_active: boolean;
  created_at: string;
};

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  const sb = supabaseAdmin();

  const [presets, businessProfile, tagsRes, usersData] = await Promise.all([
    listPresets(),
    getBusinessProfile(),
    sb.from("tags").select("*").order("name"),
    currentUser?.role === "admin" ? loadUsersForAdmin() : Promise.resolve(null),
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
        usuarios={
          usersData && currentUser ? (
            <UsersManager
              initialUsers={usersData}
              currentUserId={currentUser.id}
            />
          ) : undefined
        }
      />
    </div>
  );
}

async function loadUsersForAdmin() {
  const sb = supabaseAdmin();
  const [profilesRes, authRes] = await Promise.all([
    sb
      .from("user_profiles")
      .select("user_id, full_name, role, is_active, created_at")
      .order("created_at", { ascending: true }),
    sb.auth.admin.listUsers({ perPage: 200 }),
  ]);
  const authById = new Map<
    string,
    { email: string; last_sign_in_at: string | null }
  >();
  for (const u of authRes.data?.users ?? []) {
    authById.set(u.id, {
      email: u.email ?? "",
      last_sign_in_at: u.last_sign_in_at ?? null,
    });
  }
  return ((profilesRes.data ?? []) as UserProfileRow[]).map((p) => ({
    user_id: p.user_id,
    email: authById.get(p.user_id)?.email ?? "",
    full_name: p.full_name,
    role: p.role,
    is_active: p.is_active,
    created_at: p.created_at,
    last_sign_in_at: authById.get(p.user_id)?.last_sign_in_at ?? null,
  }));
}

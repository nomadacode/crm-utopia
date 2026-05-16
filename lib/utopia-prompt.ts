import { supabaseAdmin } from "./supabase/admin";
import type { Contact } from "./types";

const FALLBACK_PROMPT = `Sos UtopIA, una asistente que responde por WhatsApp. Hablás siempre en español argentino con voseo. Tus mensajes son cortos (menos de 30 palabras), naturales, con como máximo 2 emojis. Nunca usás markdown ni listas ni viñetas, todo texto corrido. Nunca inventás precios ni datos falsos. Nunca pedís email. Si el usuario expresa molestia, le decís que lo derivás a un humano. La primera respuesta es siempre genérica: preguntás qué quiere lograr o en qué le podés ayudar, sin listar servicios. Solo enviás link de calendario cuando hay interés real concreto.`;

export type PromptPreset = {
  id: string;
  name: string;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getActivePreset(): Promise<PromptPreset | null> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("prompt_presets")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return data as PromptPreset | null;
}

export async function listPresets(): Promise<PromptPreset[]> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("prompt_presets")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as PromptPreset[];
}

export async function getSystemPrompt(): Promise<string> {
  const preset = await getActivePreset();
  return preset?.system_prompt ?? FALLBACK_PROMPT;
}

/** Replace {{variables}} in the prompt with values from the contact + context. */
export function applyVariables(
  prompt: string,
  contact: Pick<Contact, "name" | "phone"> & {
    tags?: string[];
    lastUserMessageAt?: string | null;
  },
  now: Date = new Date(),
): string {
  const argentinaTime = new Date(now.getTime()).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  let timeSince = "es la primera interacción";
  if (contact.lastUserMessageAt) {
    const diffMin = Math.floor(
      (now.getTime() - new Date(contact.lastUserMessageAt).getTime()) / 60000,
    );
    if (diffMin < 60) timeSince = `${diffMin} minutos`;
    else if (diffMin < 1440) timeSince = `${Math.floor(diffMin / 60)} horas`;
    else timeSince = `${Math.floor(diffMin / 1440)} días`;
  }

  const replacements: Record<string, string> = {
    nombre: contact.name ?? "cliente",
    telefono: contact.phone,
    ahora: argentinaTime,
    tags: contact.tags?.length ? contact.tags.join(", ") : "ninguno",
    ultima_interaccion: timeSince,
  };

  return prompt.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return replacements[key] ?? match;
  });
}

export async function setActivePreset(id: string): Promise<void> {
  const supabase = supabaseAdmin();
  // Two-step: clear current active, then set new (constraint allows only 1 active at a time)
  await supabase
    .from("prompt_presets")
    .update({ is_active: false })
    .eq("is_active", true);
  await supabase
    .from("prompt_presets")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function upsertPreset(
  data: { id?: string; name: string; system_prompt: string },
): Promise<PromptPreset> {
  const supabase = supabaseAdmin();
  if (data.id) {
    const { data: updated, error } = await supabase
      .from("prompt_presets")
      .update({
        name: data.name,
        system_prompt: data.system_prompt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !updated) throw error ?? new Error("update preset failed");
    return updated as PromptPreset;
  }
  const { data: created, error } = await supabase
    .from("prompt_presets")
    .insert({ name: data.name, system_prompt: data.system_prompt })
    .select("*")
    .single();
  if (error || !created) throw error ?? new Error("create preset failed");
  return created as PromptPreset;
}

export async function deletePreset(id: string): Promise<void> {
  const supabase = supabaseAdmin();
  await supabase.from("prompt_presets").delete().eq("id", id);
}

/** Backward-compat for old /api/settings/prompt route. */
export async function setSystemPrompt(value: string): Promise<void> {
  const active = await getActivePreset();
  if (!active) {
    await upsertPreset({ name: "Default", system_prompt: value });
    return;
  }
  await upsertPreset({
    id: active.id,
    name: active.name,
    system_prompt: value,
  });
}

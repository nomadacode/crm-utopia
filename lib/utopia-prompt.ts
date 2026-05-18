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

export type BusinessProfile = {
  business_name: string | null;
  description: string | null;
  services: string | null;
  prices: string | null;
  hours: string | null;
  calendar_link: string | null;
  handoff_info: string | null;
  additional_context: string | null;
  updated_at: string;
};

export const BUSINESS_PROFILE_FIELDS: Array<{
  key: keyof Omit<BusinessProfile, "updated_at">;
  label: string;
  placeholder: string;
  rows: number;
}> = [
  {
    key: "business_name",
    label: "Nombre del negocio",
    placeholder: "El nombre con el que querés que UtopIA se refiera a tu negocio",
    rows: 1,
  },
  {
    key: "description",
    label: "Descripción breve",
    placeholder:
      "Una oración corta sobre qué hace tu negocio. Ej: \"Agencia de marketing especializada en automatizaciones con IA para pymes.\"",
    rows: 2,
  },
  {
    key: "services",
    label: "Servicios que ofrecés",
    placeholder:
      "Listá tus servicios principales. Ej:\n- Diseño web y landing pages\n- Implementación de chatbots\n- Automatizaciones con n8n",
    rows: 5,
  },
  {
    key: "prices",
    label: "Precios o rangos",
    placeholder:
      "Texto libre. Ej:\nLanding page: desde USD 800\nChatbot WhatsApp: desde USD 1500 + mantenimiento mensual\n(podés decir 'a consultar' si preferís no exponer precios)",
    rows: 4,
  },
  {
    key: "hours",
    label: "Horarios de atención",
    placeholder: "Ej: Lunes a viernes 9 a 18hs (Argentina). Sábados y domingos cerrado.",
    rows: 2,
  },
  {
    key: "calendar_link",
    label: "Link de calendario / agendamiento",
    placeholder: "https://calendly.com/tu-usuario/reunion-30min",
    rows: 1,
  },
  {
    key: "handoff_info",
    label: "Qué hacer si hay que derivar a un humano",
    placeholder:
      "Ej: \"Un humano del equipo escribe en breve.\" (Si querés que UtopIA pase tu teléfono o email, escribilo acá. Si lo dejás en blanco, solo dice que un humano contacta.)",
    rows: 2,
  },
  {
    key: "additional_context",
    label: "Contexto adicional",
    placeholder:
      "Todo lo que UtopIA debería saber y no entra arriba: tono de marca, valores, palabras prohibidas, promos vigentes, FAQ, etc.",
    rows: 5,
  },
];

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

export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("business_profile")
    .select(
      "business_name, description, services, prices, hours, calendar_link, handoff_info, additional_context, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();
  return (data as BusinessProfile | null) ?? null;
}

export async function updateBusinessProfile(
  patch: Partial<Omit<BusinessProfile, "updated_at">>,
): Promise<BusinessProfile> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("business_profile")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("update business_profile failed");
  return data as BusinessProfile;
}

/** Build a human-readable context block from the business profile. */
export function formatBusinessContext(profile: BusinessProfile | null): string {
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.business_name?.trim())
    parts.push(`Nombre del negocio: ${profile.business_name.trim()}`);
  if (profile.description?.trim())
    parts.push(`Descripción: ${profile.description.trim()}`);
  if (profile.services?.trim())
    parts.push(`Servicios que ofrece:\n${profile.services.trim()}`);
  if (profile.prices?.trim())
    parts.push(`Precios:\n${profile.prices.trim()}`);
  if (profile.hours?.trim())
    parts.push(`Horarios: ${profile.hours.trim()}`);
  if (profile.calendar_link?.trim())
    parts.push(
      `Link para agendar (usalo SOLO cuando el cliente muestre interés real concreto, nunca lo ofrezcas sin que pregunten): ${profile.calendar_link.trim()}`,
    );
  if (profile.handoff_info?.trim())
    parts.push(
      `Si tenés que derivar a un humano, comunicá esto: ${profile.handoff_info.trim()}`,
    );
  if (profile.additional_context?.trim())
    parts.push(`Información adicional:\n${profile.additional_context.trim()}`);
  if (parts.length === 0) return "";
  return `INFORMACIÓN DEL NEGOCIO (usá estos datos como referencia. Nunca inventes información que no esté acá. Si el cliente pregunta algo que no está acá, decí que un humano del equipo le confirma):\n\n${parts.join("\n\n")}`;
}

/**
 * Always-on instructions for how the assistant signals it is escalating.
 * Injected into every prompt regardless of the active preset, so any handoff
 * decision flips the contact to needs_human in the CRM and notifies the team.
 * The token is stripped from the outgoing message before the customer sees it.
 */
const HANDOFF_PROTOCOL = `PROTOCOLO DE DERIVACIÓN A HUMANO (CRÍTICO — NO LO IGNORES):

Cuando vas a derivar al cliente a un humano —sea porque te lo pide, porque expresa frustración, porque no podés ayudarlo, o porque la consulta excede lo que sabés del negocio— DEBÉS terminar tu respuesta con el token literal en mayúsculas y entre dobles corchetes:

[[HANDOFF]]

Reglas:
- El token NO se le muestra al cliente: lo usa el sistema internamente para alertar al equipo.
- Incluí el token SOLO cuando realmente vas a derivar. Si solo decís "esperá un momento" o "buena pregunta", no lo pongas.
- Tu mensaje debe igualmente comunicarle al cliente, con tus palabras, que un humano lo va a contactar (no le digas "[[HANDOFF]]" ni nada parecido — usá lenguaje natural).
- Si dudás entre derivar o no, derivá (mejor que un humano confirme).`;

/**
 * Build the final system prompt: business context + active preset, with
 * per-contact variables applied.
 */
export async function buildSystemPrompt(
  contact: Pick<Contact, "name" | "phone"> & {
    tags?: string[];
    lastUserMessageAt?: string | null;
  },
): Promise<string> {
  const [presetTemplate, profile] = await Promise.all([
    getSystemPrompt(),
    getBusinessProfile(),
  ]);
  const businessBlock = formatBusinessContext(profile);
  const personalityWithVars = applyVariables(presetTemplate, contact);
  const main = businessBlock
    ? `${businessBlock}\n\n---\n\n${personalityWithVars}`
    : personalityWithVars;
  return `${main}\n\n---\n\n${HANDOFF_PROTOCOL}`;
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

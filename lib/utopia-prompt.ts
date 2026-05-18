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
  handoff_protocol: string | null;
  additional_context: string | null;
  updated_at: string;
};

export type ProfileField = {
  key: keyof Omit<BusinessProfile, "updated_at">;
  label: string;
  placeholder: string;
  rows: number;
};

export const BUSINESS_FIELDS: ProfileField[] = [
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
    key: "additional_context",
    label: "Contexto adicional",
    placeholder:
      "Todo lo que UtopIA debería saber y no entra arriba: tono de marca, valores, palabras prohibidas, promos vigentes, FAQ, etc.",
    rows: 5,
  },
];

export const HANDOFF_FIELDS: ProfileField[] = [
  {
    key: "handoff_info",
    label: "Qué le decís al cliente cuando derivás",
    placeholder:
      "Ej: \"Un humano del equipo escribe en breve.\" (Si querés que UtopIA pase tu teléfono o email, escribilo acá. Si lo dejás en blanco, solo dice que un humano contacta.)",
    rows: 2,
  },
  {
    key: "handoff_protocol",
    label: "Cuándo UtopIA debe derivar",
    placeholder:
      "Reglas que UtopIA sigue para decidir cuándo escalar a un humano. Si lo dejás vacío se usan las reglas por defecto.",
    rows: 10,
  },
];

/** Kept for backwards-compat with code that imports the combined list. */
export const BUSINESS_PROFILE_FIELDS: ProfileField[] = [
  ...BUSINESS_FIELDS,
  ...HANDOFF_FIELDS,
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
      "business_name, description, services, prices, hours, calendar_link, handoff_info, handoff_protocol, additional_context, updated_at",
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
 * Default WHEN/HOW rules used if business_profile.handoff_protocol is empty.
 * Kept in sync with the seed in migration `business_profile_handoff_protocol`
 * — that migration writes the same text on first install so it shows up
 * editable in /settings. This constant is the safety net for the case where
 * the user clears the field.
 */
export const DEFAULT_HANDOFF_RULES = `Derivá al cliente a un humano cuando:
- El cliente pide hablar con una persona / asesor / vendedor / humano explícitamente.
- El cliente expresa frustración, enojo o queja seria.
- No podés resolver la consulta con la info del negocio que tenés cargada.
- La consulta excede tu scope (temas legales, médicos, técnicos específicos, etc.).
- Detectás que el cliente está confundido después de varios intentos tuyos por aclarar.

Cuando derivás, comunicale al cliente con tus palabras (en español argentino, voseo, natural) que un humano del equipo lo va a contactar en breve. Si "Qué hacer si hay que derivar a un humano" tiene info cargada arriba, usala.

Ante la duda, derivá. Mejor que un humano confirme.`;

/**
 * Non-configurable technical contract: how the assistant signals an escalation
 * decision to the CRM. Always appended in code so the user can't accidentally
 * break the contact-flag-and-notify path by editing /settings.
 */
const HANDOFF_TOKEN_INSTRUCTION = `SEÑAL TÉCNICA DE DERIVACIÓN (no editable, no negociable):

Cuando, siguiendo las reglas anteriores, decidís derivar al cliente, tu respuesta DEBE terminar con el siguiente token literal en mayúsculas y entre dobles corchetes:

[[HANDOFF]]

- El token NO se le muestra al cliente. El sistema lo strippea antes de enviar y lo usa para marcar al contacto como "necesita humano" y avisar al equipo.
- Incluí el token SOLO cuando realmente vas a derivar.
- Tu mensaje al cliente debe igualmente comunicarle, con lenguaje natural, que va a hablar con una persona del equipo. NUNCA escribas literalmente "[[HANDOFF]]" en tu respuesta visible — el token va aparte, al final.`;

function buildHandoffSection(customRules: string | null | undefined): string {
  const rules = (customRules?.trim() ? customRules.trim() : DEFAULT_HANDOFF_RULES);
  return `PROTOCOLO DE DERIVACIÓN A HUMANO:\n\n${rules}\n\n${HANDOFF_TOKEN_INSTRUCTION}`;
}

/**
 * Build the final system prompt: business context + active preset + handoff
 * protocol, with per-contact variables applied.
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
  const handoffSection = buildHandoffSection(profile?.handoff_protocol);
  const main = businessBlock
    ? `${businessBlock}\n\n---\n\n${personalityWithVars}`
    : personalityWithVars;
  return `${main}\n\n---\n\n${handoffSection}`;
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

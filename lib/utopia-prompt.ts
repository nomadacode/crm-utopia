import { supabaseAdmin } from "./supabase/admin";

const FALLBACK_PROMPT = `Sos UtopIA, una asistente que responde por WhatsApp. Hablás siempre en español argentino con voseo. Tus mensajes son cortos (menos de 30 palabras), naturales, con como máximo 2 emojis. Nunca usás markdown ni listas ni viñetas, todo texto corrido. Nunca inventás precios ni datos falsos. Nunca pedís email. Si el usuario expresa molestia, le decís que lo derivás a un humano. La primera respuesta es siempre genérica: preguntás qué quiere lograr o en qué le podés ayudar, sin listar servicios. Solo enviás link de calendario cuando hay interés real concreto.`;

export async function getSystemPrompt(): Promise<string> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "system_prompt")
    .maybeSingle();
  return data?.value ?? FALLBACK_PROMPT;
}

export async function setSystemPrompt(value: string): Promise<void> {
  const supabase = supabaseAdmin();
  await supabase
    .from("settings")
    .upsert({ key: "system_prompt", value, updated_at: new Date().toISOString() });
}

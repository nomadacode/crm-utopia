import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hard cap on incoming message length. WhatsApp's own cap is 4096 chars; we're
 * stricter to avoid burning LLM tokens on essays/dumps.
 */
const MAX_INCOMING_LENGTH = 3000;

/**
 * Heuristic patterns that almost never appear in legitimate customer messages
 * but are common in prompt-injection / jailbreak attempts.
 */
const INJECTION_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // English jailbreaks
  { name: "ignore_previous_en", re: /\bignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|directives?)\b/i },
  { name: "system_prompt_en", re: /\b(reveal|show|print|expose|leak|dump)\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?|configuration)\b/i },
  { name: "dan_mode", re: /\b(DAN|do\s+anything\s+now)\s+mode\b/i },
  { name: "jailbreak", re: /\bjailbreak/i },
  { name: "pretend_role", re: /\b(pretend|act|behave|roleplay|simulate)\s+(you\s+(are|is|were)|as\s+(if|a))\b/i },
  // Spanish jailbreaks
  { name: "ignore_previous_es", re: /\b(ignor[aáeéó]|olvid[aáeéó]te?\s+de|dej[aá]\s+de\s+seguir)\s+(las?\s+|los?\s+|tus?\s+)?(instruccion(es)?|reglas?|prompts?|directrices?|indicacion(es)?)\s*(anterior(es)?|previa(s)?|de\s+arriba)?/i },
  { name: "system_prompt_es", re: /\b(mostr[aá]|reveláme?|dec[ií]me|comparti[íi]?)\s+(tu\s+|el\s+)?(prompt|instruccion(es)?|reglas?|configuraci[oó]n)/i },
  { name: "pretend_role_es", re: /\b(fing[ií]\s+ser|hac[eé]\s+como\s+si|act[uú]a\s+como|simul[aá]\s+ser)\b/i },
  { name: "developer_mode_es", re: /\b(modo\s+(desarrollador|admin|dios|sudo))\b/i },
  // Generic exploit markers
  { name: "special_tokens", re: /<\|im_(start|end)\|>|<\|endoftext\|>|\[INST\]|\[\/INST\]/i },
  { name: "system_role_injection", re: /\bsystem:\s*you\s+are\b/i },
  // Code injection — legitimate customers don't paste shell/SQL/scripts
  { name: "code_block_long", re: /```[\s\S]{60,}```/ },
  { name: "shell_command", re: /\b(rm\s+-rf|curl\s+-X|wget\s+http|sudo\s+\w+|chmod\s+\d{3,4})\b/i },
  { name: "sql_injection", re: /\b(drop|truncate)\s+(table|database)\b|\b1\s*=\s*1\b.*--|union\s+select\b/i },
];

export type SecurityCheck =
  | { allowed: true }
  | { allowed: false; reason: string; deflection: string };

export function checkMessageContent(content: string): SecurityCheck {
  if (content.length > MAX_INCOMING_LENGTH) {
    return {
      allowed: false,
      reason: "too_long",
      deflection:
        "Mandaste un mensaje muy largo, no logro leerlo entero. ¿Me lo resumís en pocas líneas? 😊",
    };
  }
  for (const { name, re } of INJECTION_PATTERNS) {
    if (re.test(content)) {
      return {
        allowed: false,
        reason: `injection:${name}`,
        deflection:
          "¡Hola! Soy una asistente acá para ayudarte con consultas sobre el negocio. ¿En qué te puedo dar una mano? 😊",
      };
    }
  }
  return { allowed: true };
}

/**
 * Per-contact rate limiting. Returns a deflection if the contact is spamming.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  contactId: string,
): Promise<SecurityCheck> {
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();

  const { count: lastMin } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .eq("role", "user")
    .gte("created_at", oneMinAgo);

  if ((lastMin ?? 0) >= 10) {
    return {
      allowed: false,
      reason: "rate_limit:10_per_minute",
      deflection: "",
    };
  }

  const { count: last5Min } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .eq("role", "user")
    .gte("created_at", fiveMinAgo);

  if ((last5Min ?? 0) >= 30) {
    return {
      allowed: false,
      reason: "rate_limit:30_per_5min",
      deflection: "",
    };
  }

  return { allowed: true };
}

/**
 * Global daily budget on UtopIA replies. Prevents wallet/credit drain attacks.
 */
export async function checkDailyBudget(
  supabase: SupabaseClient,
): Promise<SecurityCheck> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "assistant")
    .gte("created_at", startOfDay.toISOString());

  const budget = Number(process.env.DAILY_REPLY_BUDGET ?? 500);
  if ((count ?? 0) >= budget) {
    return {
      allowed: false,
      reason: `daily_budget_exceeded:${count}`,
      deflection:
        "¡Hola! Hoy estamos saturados de consultas. Un humano te va a contactar a la brevedad. Gracias por la paciencia 🙏",
    };
  }
  return { allowed: true };
}

/**
 * Output sanitization: strip code blocks/markdown that the model might emit,
 * and refuse responses that look like they leaked the system prompt.
 */
const SYSTEM_PROMPT_LEAK_MARKERS = [
  /REGLAS\s+IRROMPIBLES/i,
  /SEGURIDAD\s+Y\s+GUARDRAILS/i,
  /CALIDEZ\s+Y\s+CONEXI/i,
  /\bsystem\s+prompt\b/i,
];

export function sanitizeReply(reply: string): string {
  // Drop fenced code blocks
  let cleaned = reply.replace(/```[\s\S]*?```/g, "");
  // Drop inline backticks (but keep the wrapped text)
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");
  // Drop common markdown emphasis since the prompt forbids markdown anyway
  cleaned = cleaned
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1");
  cleaned = cleaned.trim();

  // If the response looks like a leak of internal guidance, replace with a safe fallback
  if (SYSTEM_PROMPT_LEAK_MARKERS.some((re) => re.test(cleaned))) {
    return "¡Hola! ¿En qué te puedo ayudar hoy? 😊";
  }

  return cleaned;
}

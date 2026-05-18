import type { LeadScore } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type Role = "system" | "user" | "assistant";
export type ChatMessage = { role: Role; content: string };

async function callOpenRouter(messages: ChatMessage[], opts?: { jsonMode?: boolean }) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://crm-utopia.vercel.app",
      "X-Title": "CRM UtopIA",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3-0324",
      messages,
      ...(opts?.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

export async function generateReply(
  systemPrompt: string,
  history: ChatMessage[],
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
  ];
  const reply = await callOpenRouter(messages);
  return reply.trim();
}

/**
 * Describe an image with a vision-capable LLM. Returns a short description.
 */
export async function describeImage(
  imageUrl: string,
  caption?: string,
): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://crm-utopia.vercel.app",
      "X-Title": "CRM UtopIA",
    },
    body: JSON.stringify({
      model: process.env.VISION_MODEL ?? "openai/gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describí brevemente (máx 30 palabras, en español argentino) qué se ve en esta imagen que mandó un cliente por WhatsApp. Si tiene texto visible, transcribilo. ${caption ? `El caption del cliente fue: "${caption}".` : ""}`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Vision call failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content?.trim() ?? "(no description)";
}

/**
 * Detect whether the customer's message needs handoff to a human.
 * Returns the kind of escalation if confidence is HIGH; "none" otherwise (fail-safe).
 */
export async function classifyHandoffNeed(
  content: string,
): Promise<{ kind: "explicit_request" | "frustration" | "none" }> {
  // Skip empty/very short messages to avoid wasting tokens
  if (!content || content.trim().length < 3) return { kind: "none" };

  try {
    const raw = await callOpenRouter(
      [
        {
          role: "system",
          content: `Analizás un mensaje de WhatsApp de un cliente a un chatbot y decidís si necesita derivación a un humano.

Devolvé ÚNICAMENTE un JSON con dos campos:
{"kind": "explicit_request" | "frustration" | "none", "confidence": "high" | "medium" | "low"}

Criterios:
- explicit_request: el cliente pide hablar con una persona/humano/asesor/operador/vendedor/agente real. Ejemplos: "quiero hablar con alguien", "pasame con un humano", "necesito una persona", "no quiero hablar con un bot".
- frustration: el cliente está claramente enojado, frustrado o quejándose. Ejemplos: "estoy harto", "esto no funciona", "quiero cancelar", "quiero un reembolso", "esto es una estafa", "no me entendés nada", "horrible servicio".
- none: cualquier otra cosa, incluyendo: preguntas normales, dudas, mensajes confusos, "no entendí", saludos, requests de info, etc.

REGLAS CRÍTICAS:
- Solo retornás explicit_request o frustration si tu confianza es ALTA. Ante CUALQUIER duda, retornás none.
- Una pregunta inocente como "¿podés repetir?" o "no entendí" es none, no frustración.
- Ser ambiguamente molesto no es suficiente, debe ser CLARAMENTE frustración o queja.
- Pedido amable de info NO es explicit_request.

Solo el JSON, sin texto adicional, sin markdown.`,
        },
        { role: "user", content },
      ],
      { jsonMode: true },
    );

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { kind: "none" };
    const parsed = JSON.parse(match[0]) as {
      kind?: string;
      confidence?: string;
    };
    if (parsed.confidence !== "high") return { kind: "none" };
    if (parsed.kind === "explicit_request" || parsed.kind === "frustration") {
      return { kind: parsed.kind };
    }
    return { kind: "none" };
  } catch (err) {
    console.error("[classifyHandoffNeed] failed, defaulting to none:", err);
    return { kind: "none" };
  }
}

/**
 * Classify sentiment of a single message. Returns positive | neutral | negative.
 */
export async function classifySentiment(
  text: string,
): Promise<"positive" | "neutral" | "negative"> {
  const raw = await callOpenRouter([
    {
      role: "system",
      content:
        'Clasificá el sentimiento del mensaje del cliente. Respondé únicamente con un JSON {"sentiment":"positive"|"neutral"|"negative"}. Sin nada más.',
    },
    { role: "user", content: text },
  ], { jsonMode: true });

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return "neutral";
  try {
    const parsed = JSON.parse(match[0]) as { sentiment?: string };
    if (parsed.sentiment === "positive") return "positive";
    if (parsed.sentiment === "negative") return "negative";
    return "neutral";
  } catch {
    return "neutral";
  }
}

export type LeadProfile = {
  email: string | null;
  company: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  timeline: string | null;
  pain_points: string | null;
  main_goal: string | null;
};

/**
 * Extract structured lead data from a conversation. Only returns fields where
 * the LLM is confident; otherwise null. Caller should merge non-null fields
 * into the existing contact record (don't overwrite existing values with null).
 */
export async function extractLeadProfile(
  history: ChatMessage[],
): Promise<LeadProfile> {
  const conversation = history
    .map((m) => `${m.role === "user" ? "Cliente" : "Asistente"}: ${m.content}`)
    .join("\n");

  const systemPrompt = `Analizás conversaciones de WhatsApp/Telegram entre un cliente y un asistente de ventas. Tu tarea es extraer información estructurada SOLO si el cliente la mencionó explícitamente o se puede inferir con ALTA confianza.

Devolvé únicamente un JSON con estos campos (todos opcionales, usá null si no hay info clara):
{
  "email": string | null,           // email del cliente si lo mencionó
  "company": string | null,         // nombre del negocio/empresa del cliente (ej: "Estudio Médico San Juan", "Pizzería Don Pepe")
  "website": string | null,         // URL del sitio web (ej: "midominio.com.ar")
  "instagram": string | null,       // handle de Instagram (ej: "@usuario") o URL
  "linkedin": string | null,        // perfil de LinkedIn
  "timeline": string | null,        // cuándo quiere implementar/comprar (texto breve, ej: "esta semana", "Q1 2027")
  "pain_points": string | null,     // problema concreto que busca resolver (1-2 oraciones)
  "main_goal": string | null        // qué quiere lograr (1-2 oraciones)
}

REGLAS:
- Si el cliente NO mencionó algo, devolvé null. NO inventes.
- Para campos de texto largo (pain_points, main_goal), resumí en español argentino, no copies palabras textuales.
- Si la información es ambigua o de baja confianza, devolvé null.
- Solo el JSON, sin markdown, sin texto adicional.`;

  try {
    const raw = await callOpenRouter(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Conversación:\n${conversation}` },
      ],
      { jsonMode: true },
    );

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return emptyProfile();
    const parsed = JSON.parse(match[0]) as Partial<LeadProfile>;
    return {
      email: cleanString(parsed.email),
      company: cleanString(parsed.company),
      website: cleanString(parsed.website),
      instagram: cleanString(parsed.instagram),
      linkedin: cleanString(parsed.linkedin),
      timeline: cleanString(parsed.timeline),
      pain_points: cleanString(parsed.pain_points),
      main_goal: cleanString(parsed.main_goal),
    };
  } catch (err) {
    console.error("[extractLeadProfile] failed", err);
    return emptyProfile();
  }
}

function emptyProfile(): LeadProfile {
  return {
    email: null,
    company: null,
    website: null,
    instagram: null,
    linkedin: null,
    timeline: null,
    pain_points: null,
    main_goal: null,
  };
}

function cleanString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

export async function classifyLead(
  history: ChatMessage[],
): Promise<{ score: LeadScore; reason: string }> {
  const classifierSystem = `Sos un clasificador de leads de una conversación de WhatsApp. Devolvé únicamente un JSON con dos campos:
- score: "hot" | "warm" | "cold"
- reason: explicación breve en español (máximo 15 palabras)

Criterios:
- HOT: interés real concreto en contratar o avanzar. Preguntó por precios, agendó o pidió reunión, dio datos de su proyecto.
- WARM: hay interés pero todavía no quiso agendar ni preguntó precios. Está explorando.
- COLD: sin interés real, spam, busca empleo, mera curiosidad, conversación trivial.

Devolvé SOLO el JSON, sin markdown, sin texto adicional.`;

  const conversation = history
    .map((m) => `${m.role === "user" ? "Cliente" : "Asistente"}: ${m.content}`)
    .join("\n");

  const raw = await callOpenRouter(
    [
      { role: "system", content: classifierSystem },
      { role: "user", content: `Conversación:\n${conversation}\n\nClasificá.` },
    ],
    { jsonMode: true },
  );

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Lead classifier returned non-JSON: ${raw}`);
  }
  const parsed = JSON.parse(match[0]) as { score: string; reason: string };
  const score = (["hot", "warm", "cold"] as const).includes(
    parsed.score as LeadScore,
  )
    ? (parsed.score as LeadScore)
    : "cold";
  return { score, reason: parsed.reason ?? "sin razón" };
}

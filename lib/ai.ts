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

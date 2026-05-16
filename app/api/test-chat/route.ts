import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/ai";
import { getSystemPrompt, applyVariables } from "@/lib/utopia-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new NextResponse("forbidden", { status: 403 });

  const { history } = (await req.json()) as { history: ChatMessage[] };
  const promptTemplate = await getSystemPrompt();
  const systemPrompt = applyVariables(promptTemplate, {
    name: "Test User",
    phone: "+test",
    tags: [],
    lastUserMessageAt: null,
  });

  const upstream = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://crm-utopia.vercel.app",
        "X-Title": "CRM UtopIA",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3-0324",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
        ],
      }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${text}` },
      { status: 502 },
    );
  }

  // Re-stream the SSE response straight to the client, parsing into plain text deltas
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // ignore non-JSON lines (OpenRouter keep-alive comments etc.)
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

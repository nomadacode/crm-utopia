import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateReply, type ChatMessage } from "@/lib/ai";
import { getSystemPrompt } from "@/lib/utopia-prompt";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new NextResponse("forbidden", { status: 403 });

  const { history } = (await req.json()) as { history: ChatMessage[] };
  const systemPrompt = await getSystemPrompt();
  const reply = await generateReply(systemPrompt, history);
  return NextResponse.json({ reply });
}

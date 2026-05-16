import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateReply, type ChatMessage } from "@/lib/ai";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getSystemPrompt } from "@/lib/utopia-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIVE_HOURS = 5 * 60 * 60 * 1000;
const TWENTY_THREE_HOURS = 23 * 60 * 60 * 1000;

function unauthorized(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth !== `Bearer ${process.env.CRON_SECRET}`;
}

// Argentina local hour (UTC-3, no DST).
function argentinaHour(): number {
  const now = new Date();
  return (now.getUTCHours() - 3 + 24) % 24;
}

export async function GET(req: NextRequest) {
  if (unauthorized(req)) return new NextResponse("forbidden", { status: 403 });

  const hour = argentinaHour();
  if (hour < 10 || hour >= 20) {
    return NextResponse.json({ ok: true, skipped: "outside_hours", hour });
  }

  const supabase = supabaseAdmin();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, phone, name, blocked, bot_enabled")
    .eq("blocked", false)
    .eq("bot_enabled", true);

  let sentCount = 0;
  const now = Date.now();

  for (const contact of contacts ?? []) {
    const { data: lastMsg } = await supabase
      .from("messages")
      .select("role, created_at")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastMsg || lastMsg.role !== "assistant") continue;
    const last = new Date(lastMsg.created_at).getTime();
    const sinceLast = now - last;
    if (sinceLast < FIVE_HOURS || sinceLast > TWENTY_THREE_HOURS) continue;

    // Avoid duplicate follow-ups: skip if last 2 messages were both assistant.
    const { data: lastTwo } = await supabase
      .from("messages")
      .select("role")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(2);
    if ((lastTwo ?? []).every((m) => m.role === "assistant")) continue;

    const { data: historyRows } = await supabase
      .from("messages")
      .select("role, content")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const history: ChatMessage[] = (historyRows ?? [])
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const systemPrompt = await getSystemPrompt();
    const followupInstruction: ChatMessage = {
      role: "user",
      content:
        "[Instrucción interna del sistema, no contestes a esto literalmente] " +
        "Pasaron unas horas sin respuesta del cliente. Mandá un follow-up breve, natural, " +
        "retomando algo de la última conversación. No saludes de nuevo. Máximo 25 palabras.",
    };

    try {
      const reply = await generateReply(systemPrompt, [
        ...history,
        followupInstruction,
      ]);
      const wamid = await sendWhatsAppMessage(contact.phone, reply);
      await supabase.from("messages").insert({
        contact_id: contact.id,
        role: "assistant",
        content: reply,
        whatsapp_message_id: wamid,
        status: "sent",
      });
      sentCount++;
    } catch (err) {
      console.error("[cron/followup] failed for", contact.phone, err);
    }
  }

  return NextResponse.json({ ok: true, sent: sentCount });
}

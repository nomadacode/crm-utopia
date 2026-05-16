import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateReply, classifyLead, type ChatMessage } from "@/lib/ai";
import { sendWhatsAppMessage, markAsRead } from "@/lib/whatsapp";
import { sendNotification } from "@/lib/resend";
import { getSystemPrompt } from "@/lib/utopia-prompt";
import type { Contact, Message } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — Meta webhook verification handshake.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// POST — Incoming WhatsApp events (messages or statuses).
export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    if (!change) return NextResponse.json({ ok: true });

    // Status update (sent → delivered → read → failed)
    if (Array.isArray(change.statuses)) {
      await handleStatuses(change.statuses);
      return NextResponse.json({ ok: true });
    }

    // Incoming user message
    if (Array.isArray(change.messages)) {
      // Respond 200 fast and process async — Meta retries if we take too long.
      handleIncoming(change).catch((err) =>
        console.error("[webhook] handleIncoming error", err),
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] error", err);
    return NextResponse.json({ ok: true });
  }
}

type StatusEvent = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
};

async function handleStatuses(statuses: StatusEvent[]) {
  const supabase = supabaseAdmin();
  for (const s of statuses) {
    await supabase
      .from("messages")
      .update({ status: s.status })
      .eq("whatsapp_message_id", s.id);
  }
}

type IncomingMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  referral?: { source_id?: string; ctwa_clid?: string };
};

type IncomingChange = {
  messages: IncomingMessage[];
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
};

async function handleIncoming(change: IncomingChange) {
  const supabase = supabaseAdmin();
  const msg = change.messages[0];
  if (!msg) return;
  if (msg.type !== "text" || !msg.text?.body) return;

  const phone = msg.from;
  const profileName = change.contacts?.[0]?.profile?.name ?? null;

  // Upsert contact
  const { data: existing } = await supabase
    .from("contacts")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  let contact: Contact;
  if (existing) {
    contact = existing as Contact;
    if (!contact.name && profileName) {
      await supabase
        .from("contacts")
        .update({ name: profileName })
        .eq("id", contact.id);
      contact.name = profileName;
    }
  } else {
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        phone,
        name: profileName,
        ad_source: msg.referral?.source_id ?? null,
        ctwa_clid: msg.referral?.ctwa_clid ?? null,
      })
      .select("*")
      .single();
    if (error || !created) throw error ?? new Error("contact insert failed");
    contact = created as Contact;
  }

  // Save user message
  await supabase.from("messages").insert({
    contact_id: contact.id,
    role: "user",
    content: msg.text.body,
    whatsapp_message_id: msg.id,
  });

  // Mark as read in WhatsApp
  markAsRead(msg.id).catch(() => {});

  // Skip auto-reply if blocked or bot disabled
  if (contact.blocked || !contact.bot_enabled) return;

  // Build history (last 20)
  const { data: historyRows } = await supabase
    .from("messages")
    .select("role, content")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const history: ChatMessage[] =
    (historyRows ?? [])
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Generate UtopIA reply
  const systemPrompt = await getSystemPrompt();
  const reply = await generateReply(systemPrompt, history);

  // Send reply via WhatsApp
  let wamid: string | null = null;
  try {
    wamid = await sendWhatsAppMessage(phone, reply);
  } catch (err) {
    console.error("[webhook] send failed", err);
    await supabase.from("messages").insert({
      contact_id: contact.id,
      role: "assistant",
      content: reply,
      status: "failed",
    });
    return;
  }

  await supabase.from("messages").insert({
    contact_id: contact.id,
    role: "assistant",
    content: reply,
    whatsapp_message_id: wamid,
    status: "sent",
  });

  // Background: lead classification after 3+ user messages
  classifyAndMaybeNotify(contact, history).catch((err) =>
    console.error("[webhook] classify failed", err),
  );
}

async function classifyAndMaybeNotify(contact: Contact, history: ChatMessage[]) {
  const userMessageCount = history.filter((m) => m.role === "user").length;
  if (userMessageCount < 3) return;

  const supabase = supabaseAdmin();
  const { score, reason } = await classifyLead(history);

  const { data: lead } = await supabase
    .from("leads")
    .insert({ contact_id: contact.id, score, reason })
    .select("*")
    .single();

  if (score === "hot" && lead) {
    const subject = `🔥 Lead HOT — ${contact.name ?? contact.phone}`;
    const html = `
      <h2>Nuevo lead caliente</h2>
      <p><strong>Contacto:</strong> ${contact.name ?? "(sin nombre)"} — ${contact.phone}</p>
      <p><strong>Razón:</strong> ${reason}</p>
      <p><a href="https://crm-utopia.vercel.app/conversations/${contact.id}">Ver conversación</a></p>
    `;
    await sendNotification(subject, html);
    await supabase.from("leads").update({ notified: true }).eq("id", lead.id);
  }
}

// Suppress unused warning — Message type is exported for downstream consumers.
export type _Message = Message;

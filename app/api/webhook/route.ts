import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  generateReply,
  classifyLead,
  classifyHandoffNeed,
  classifySentiment,
  describeImage,
  type ChatMessage,
} from "@/lib/ai";
import {
  escalateContact,
  notifyOwnerOfHandoff,
  sendHandoffAck,
} from "@/lib/handoff";
import { downloadMedia, sendWhatsAppMessage, markAsRead } from "@/lib/whatsapp";
import { sendNotification } from "@/lib/resend";
import { buildSystemPrompt } from "@/lib/utopia-prompt";
import { transcribeAudio, uploadMedia } from "@/lib/media";
import {
  checkMessageContent,
  checkRateLimit,
  checkDailyBudget,
  sanitizeReply,
} from "@/lib/security";
import type { Contact, Message } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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
  console.log("[webhook] POST received", JSON.stringify(body).slice(0, 500));
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    if (!change) {
      console.log("[webhook] no change in payload");
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(change.statuses)) {
      console.log("[webhook] status update", change.statuses.length);
      await handleStatuses(change.statuses);
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(change.messages)) {
      console.log("[webhook] incoming messages", change.messages.length);
      // Await inline — fire-and-forget gets killed by serverless before completing.
      // Meta allows up to 20s to respond, our flow takes ~5-10s.
      await handleIncoming(change);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] handler error", err);
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
  audio?: { id: string; mime_type: string };
  image?: { id: string; mime_type: string; caption?: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string };
  referral?: { source_id?: string; ctwa_clid?: string };
};

type IncomingChange = {
  messages: IncomingMessage[];
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
};

type ProcessedMessage = {
  content: string;
  mediaType: "audio" | "image" | "video" | "document" | null;
  mediaUrl: string | null;
};

async function processIncomingMessage(
  msg: IncomingMessage,
): Promise<ProcessedMessage | null> {
  if (msg.type === "text" && msg.text?.body) {
    return { content: msg.text.body, mediaType: null, mediaUrl: null };
  }
  if (msg.type === "audio" && msg.audio?.id) {
    try {
      const { blob, mimeType } = await downloadMedia(msg.audio.id);
      // Upload original for traceability
      const ext = (mimeType.split("/")[1] ?? "ogg").split(";")[0];
      const filename = `audio/${msg.id}.${ext}`;
      const publicUrl = await uploadMedia(blob, filename, mimeType).catch(() => null);
      const transcript = await transcribeAudio(blob, mimeType);
      const content = transcript
        ? `🎤 ${transcript}`
        : "🎤 [audio recibido — no se pudo transcribir]";
      return { content, mediaType: "audio", mediaUrl: publicUrl };
    } catch (err) {
      console.error("[audio] processing failed", err);
      return {
        content: "🎤 [audio recibido — error al procesar]",
        mediaType: "audio",
        mediaUrl: null,
      };
    }
  }
  if (msg.type === "image" && msg.image?.id) {
    try {
      const { blob, mimeType } = await downloadMedia(msg.image.id);
      const ext = (mimeType.split("/")[1] ?? "jpeg").split(";")[0];
      const filename = `image/${msg.id}.${ext}`;
      const publicUrl = await uploadMedia(blob, filename, mimeType);
      const description = await describeImage(publicUrl, msg.image.caption);
      const content = msg.image.caption
        ? `🖼️ ${msg.image.caption}\n${description}`
        : `🖼️ ${description}`;
      return { content, mediaType: "image", mediaUrl: publicUrl };
    } catch (err) {
      console.error("[image] processing failed", err);
      return {
        content: "🖼️ [imagen recibida — error al procesar]",
        mediaType: "image",
        mediaUrl: null,
      };
    }
  }
  // Unsupported types: just record an indicator so the conversation isn't blank
  const placeholder: Record<string, string> = {
    video: "🎥 [video recibido — formato no soportado]",
    document: "📄 [documento recibido — formato no soportado]",
  };
  if (placeholder[msg.type]) {
    return {
      content: placeholder[msg.type],
      mediaType: msg.type as "video" | "document",
      mediaUrl: null,
    };
  }
  return null;
}

async function handleIncoming(change: IncomingChange) {
  const supabase = supabaseAdmin();
  const msg = change.messages[0];
  if (!msg) {
    console.log("[handleIncoming] no message");
    return;
  }
  const processed = await processIncomingMessage(msg);
  if (!processed) {
    console.log("[handleIncoming] unsupported type, ignoring:", msg.type);
    return;
  }
  console.log(
    "[handleIncoming] from",
    msg.from,
    "type=" + msg.type,
    "content:",
    processed.content.slice(0, 80),
  );

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

  // Idempotency: skip if Meta already delivered this exact wamid before
  const { data: existingMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("whatsapp_message_id", msg.id)
    .maybeSingle();
  if (existingMsg) {
    console.log("[handleIncoming] duplicate wamid, skipping", msg.id);
    return;
  }

  // Security Layer 1: content checks (length cap + injection patterns)
  const contentCheck = checkMessageContent(processed.content);
  const flaggedReason = contentCheck.allowed ? null : contentCheck.reason;

  // Save user message (always — flagged or not, for audit trail)
  const { data: insertedUserMsg, error: insertErr } = await supabase
    .from("messages")
    .insert({
      contact_id: contact.id,
      role: "user",
      content: processed.content,
      whatsapp_message_id: msg.id,
      media_type: processed.mediaType,
      media_url: processed.mediaUrl,
      flagged_reason: flaggedReason,
    })
    .select("id")
    .single();
  if (insertErr) {
    if (insertErr.code === "23505") {
      console.log("[handleIncoming] race: another delivery already saved", msg.id);
      return;
    }
    throw insertErr;
  }

  // Mark as read in WhatsApp
  markAsRead(msg.id).catch(() => {});

  // Hard stop: blocked contacts get NO further processing (no reply, no handoff)
  if (contact.blocked) return;

  // Security Layer 2: if content was flagged, send hardcoded deflection (no LLM)
  if (!contentCheck.allowed) {
    console.warn(
      "[security] flagged message",
      contentCheck.reason,
      "from",
      contact.phone,
    );
    try {
      const wamid = await sendWhatsAppMessage(phone, contentCheck.deflection);
      await supabase.from("messages").insert({
        contact_id: contact.id,
        role: "assistant",
        content: contentCheck.deflection,
        whatsapp_message_id: wamid,
        status: "sent",
        flagged_reason: `deflection:${contentCheck.reason}`,
      });
    } catch (err) {
      console.error("[security] deflection send failed", err);
    }
    // Alert owner of suspected injection (rate-limited via the flag itself)
    if (contentCheck.reason.startsWith("injection:")) {
      after(async () => {
        try {
          await sendNotification(
            `⚠️ Posible prompt injection — ${contact.name ?? contact.phone}`,
            `<p><strong>Razón:</strong> ${contentCheck.reason}</p>
             <p><strong>Contenido:</strong></p>
             <pre style="background:#f4f4f4;padding:8px;border-radius:4px;white-space:pre-wrap">${processed.content
               .replace(/</g, "&lt;")
               .slice(0, 1000)}</pre>
             <p><a href="https://crm-utopia.vercel.app/conversations/${contact.id}">Ver conversación</a></p>`,
          );
        } catch (err) {
          console.error("[security] notify failed", err);
        }
      });
    }
    return;
  }

  // Security Layer 3: per-contact rate limit (silent — just don't reply)
  const rateCheck = await checkRateLimit(supabase, contact.id);
  if (!rateCheck.allowed) {
    console.warn("[security] rate-limited", rateCheck.reason, contact.phone);
    if (insertedUserMsg?.id) {
      await supabase
        .from("messages")
        .update({ flagged_reason: rateCheck.reason })
        .eq("id", insertedUserMsg.id);
    }
    return;
  }

  // Handoff check: only when the contact is not already escalated
  if (!contact.needs_human) {
    const handoff = await classifyHandoffNeed(processed.content);
    if (handoff.kind === "explicit_request" || handoff.kind === "frustration") {
      const reason = handoff.kind;
      console.log(
        "[handoff] escalating contact",
        contact.phone,
        "reason:",
        reason,
      );
      const { wasAlreadyEscalated } = await escalateContact(
        supabase,
        contact.id,
        reason,
      );
      if (!wasAlreadyEscalated) {
        await sendHandoffAck(supabase, contact);
        after(() =>
          notifyOwnerOfHandoff(contact, reason, processed.content),
        );
      }
      return; // Do not call the LLM for an escalated contact
    }
  }

  // Skip LLM reply if bot is paused (manually or via prior escalation that wasn't reflected
  // in this in-memory contact yet). The handoff check above already handles a fresh escalation.
  if (contact.needs_human || !contact.bot_enabled) return;

  // Security Layer 4: daily budget cap (prevents wallet drain)
  const budgetCheck = await checkDailyBudget(supabase);
  if (!budgetCheck.allowed) {
    console.warn("[security] daily budget exceeded", budgetCheck.reason);
    try {
      const wamid = await sendWhatsAppMessage(phone, budgetCheck.deflection);
      await supabase.from("messages").insert({
        contact_id: contact.id,
        role: "assistant",
        content: budgetCheck.deflection,
        whatsapp_message_id: wamid,
        status: "sent",
        flagged_reason: `deflection:${budgetCheck.reason}`,
      });
    } catch (err) {
      console.error("[security] budget deflection send failed", err);
    }
    return;
  }

  // Mark contact as "UtopIA typing..." for the realtime UI
  await supabase
    .from("contacts")
    .update({
      typing_until: new Date(Date.now() + 30_000).toISOString(),
    })
    .eq("id", contact.id);

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

  // Build final system prompt: business profile + active preset + contact variables
  const [{ data: tagRows }, { data: prevUserMsg }] = await Promise.all([
    supabase
      .from("contact_tags")
      .select("tag:tags(name)")
      .eq("contact_id", contact.id),
    supabase
      .from("messages")
      .select("created_at")
      .eq("contact_id", contact.id)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .range(1, 1)
      .maybeSingle(),
  ]);

  type TagRef = { tag: { name: string } | null };
  const contactTagNames = ((tagRows ?? []) as unknown as TagRef[])
    .map((r) => r.tag?.name)
    .filter((n): n is string => Boolean(n));

  const systemPrompt = await buildSystemPrompt({
    name: contact.name,
    phone: contact.phone,
    tags: contactTagNames,
    lastUserMessageAt: prevUserMsg?.created_at ?? null,
  });

  const rawReply = await generateReply(systemPrompt, history);
  // Security Layer 5: output sanitization (strip markdown/code, detect prompt leak)
  const reply = sanitizeReply(rawReply);

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
    await supabase
      .from("contacts")
      .update({ typing_until: null })
      .eq("id", contact.id);
    return;
  }

  await supabase.from("messages").insert({
    contact_id: contact.id,
    role: "assistant",
    content: reply,
    whatsapp_message_id: wamid,
    status: "sent",
  });

  // Clear typing indicator now that the reply is out
  await supabase
    .from("contacts")
    .update({ typing_until: null })
    .eq("id", contact.id);

  // After-response work: lead classification + sentiment
  after(async () => {
    try {
      await classifyAndMaybeNotify(contact, history);
    } catch (err) {
      console.error("[handleIncoming.after] classify failed", err);
    }
    if (insertedUserMsg?.id) {
      try {
        const sentiment = await classifySentiment(processed.content);
        await supabase
          .from("messages")
          .update({ sentiment })
          .eq("id", insertedUserMsg.id);
      } catch (err) {
        console.error("[handleIncoming.after] sentiment failed", err);
      }
    }
  });
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

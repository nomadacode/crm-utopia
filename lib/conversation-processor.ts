import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  generateReply,
  classifyLead,
  classifyHandoffNeed,
  classifySentiment,
  extractLeadProfile,
  type ChatMessage,
  type LeadProfile,
} from "@/lib/ai";
import { sendNotification } from "@/lib/resend";
import { buildSystemPrompt } from "@/lib/utopia-prompt";
import {
  checkMessageContent,
  checkRateLimit,
  checkDailyBudget,
  sanitizeReply,
} from "@/lib/security";
import {
  escalateContact,
  notifyOwnerOfHandoff,
  sendHandoffAck,
} from "@/lib/handoff";
import { sendChannelMessage } from "@/lib/channels/dispatch";
import type { Channel, Contact } from "@/lib/types";

export type ProcessedInbound = {
  channel: Channel;
  /** Channel-specific contact identifier (phone for WA, chat_id for TG). Stored in contacts.phone. */
  externalContactId: string;
  /** Channel-specific message id (wamid for WA, message_id for TG). Used for idempotency. */
  externalMessageId: string;
  /** Best-effort display name from the channel ("Alexia", "@username", etc.) */
  contactName: string | null;
  /** Final text content. For media messages, callers should embed transcript/description (e.g. "🎤 hello"). */
  content: string;
  mediaType: "audio" | "image" | "video" | "document" | null;
  mediaUrl: string | null;
  /** Optional ad referral source (WhatsApp-specific). */
  adSource?: string | null;
  ctwaClid?: string | null;
};

/**
 * Shared inbound processing pipeline. Called by every channel's webhook
 * after it parsed and pre-processed the channel-specific payload.
 *
 * Side effects: persists the user message, may save assistant reply, may
 * send a handoff ack or budget deflection, classifies lead, classifies
 * sentiment.
 */
export async function processInboundMessage(input: ProcessedInbound): Promise<void> {
  const supabase = supabaseAdmin();

  // 1) Upsert contact (scoped by channel + external id)
  const { data: existing } = await supabase
    .from("contacts")
    .select("*")
    .eq("channel", input.channel)
    .eq("phone", input.externalContactId)
    .maybeSingle();

  let contact: Contact;
  if (existing) {
    contact = existing as Contact;
    if (!contact.name && input.contactName) {
      await supabase
        .from("contacts")
        .update({ name: input.contactName })
        .eq("id", contact.id);
      contact.name = input.contactName;
    }
  } else {
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        channel: input.channel,
        phone: input.externalContactId,
        name: input.contactName,
        ad_source: input.adSource ?? null,
        ctwa_clid: input.ctwaClid ?? null,
      })
      .select("*")
      .single();
    if (error || !created) throw error ?? new Error("contact insert failed");
    contact = created as Contact;
  }

  // 2) Idempotency
  const { data: existingMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("whatsapp_message_id", input.externalMessageId)
    .maybeSingle();
  if (existingMsg) {
    console.log("[processor] duplicate external msg id, skipping", input.externalMessageId);
    return;
  }

  // 3) Security: content checks
  const contentCheck = checkMessageContent(input.content);
  const flaggedReason = contentCheck.allowed ? null : contentCheck.reason;

  const { data: insertedUserMsg, error: insertErr } = await supabase
    .from("messages")
    .insert({
      contact_id: contact.id,
      role: "user",
      content: input.content,
      whatsapp_message_id: input.externalMessageId,
      media_type: input.mediaType,
      media_url: input.mediaUrl,
      flagged_reason: flaggedReason,
      channel: input.channel,
    })
    .select("id")
    .single();
  if (insertErr) {
    if (insertErr.code === "23505") {
      console.log("[processor] race: another delivery already saved");
      return;
    }
    throw insertErr;
  }

  // 4) Blocked contact = no further action
  if (contact.blocked) return;

  // 5) Security: deflect flagged content
  if (!contentCheck.allowed) {
    console.warn("[security] flagged message", contentCheck.reason, "from", contact.phone);
    try {
      const externalId = await sendChannelMessage(
        input.channel,
        contact.phone,
        contentCheck.deflection,
      );
      await supabase.from("messages").insert({
        contact_id: contact.id,
        role: "assistant",
        content: contentCheck.deflection,
        whatsapp_message_id: externalId,
        status: "sent",
        flagged_reason: `deflection:${contentCheck.reason}`,
        channel: input.channel,
      });
    } catch (err) {
      console.error("[security] deflection send failed", err);
    }
    if (contentCheck.reason.startsWith("injection:")) {
      after(async () => {
        try {
          await sendNotification(
            `⚠️ Posible prompt injection — ${contact.name ?? contact.phone}`,
            `<p><strong>Razón:</strong> ${contentCheck.reason}</p>
             <p><strong>Contenido:</strong></p>
             <pre style="background:#f4f4f4;padding:8px;border-radius:4px;white-space:pre-wrap">${input.content
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

  // 6) Rate limit
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

  // 7) Handoff classification (only if not already escalated)
  if (!contact.needs_human) {
    const handoff = await classifyHandoffNeed(input.content);
    if (handoff.kind === "explicit_request" || handoff.kind === "frustration") {
      const reason = handoff.kind;
      console.log("[handoff] escalating", contact.phone, "reason:", reason);
      const { wasAlreadyEscalated } = await escalateContact(supabase, contact.id, reason);
      if (!wasAlreadyEscalated) {
        await sendHandoffAck(supabase, contact, input.channel);
        after(() => notifyOwnerOfHandoff(contact, reason, input.content));
      }
      return;
    }
  }

  // 8) Skip LLM reply if already escalated or manually paused
  if (contact.needs_human || !contact.bot_enabled) return;

  // 9) Daily budget
  const budgetCheck = await checkDailyBudget(supabase);
  if (!budgetCheck.allowed) {
    console.warn("[security] daily budget exceeded", budgetCheck.reason);
    try {
      const externalId = await sendChannelMessage(
        input.channel,
        contact.phone,
        budgetCheck.deflection,
      );
      await supabase.from("messages").insert({
        contact_id: contact.id,
        role: "assistant",
        content: budgetCheck.deflection,
        whatsapp_message_id: externalId,
        status: "sent",
        flagged_reason: `deflection:${budgetCheck.reason}`,
        channel: input.channel,
      });
    } catch (err) {
      console.error("[security] budget deflection send failed", err);
    }
    return;
  }

  // 10) Typing indicator
  await supabase
    .from("contacts")
    .update({ typing_until: new Date(Date.now() + 30_000).toISOString() })
    .eq("id", contact.id);

  // 11) Build history (last 20 messages)
  const { data: historyRows } = await supabase
    .from("messages")
    .select("role, content")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const history: ChatMessage[] = (historyRows ?? [])
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // 12) System prompt with business context + per-contact variables
  const [{ data: tagRows }, { data: prevUserMsg }] = await Promise.all([
    supabase.from("contact_tags").select("tag:tags(name)").eq("contact_id", contact.id),
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
  const tagNames = ((tagRows ?? []) as unknown as TagRef[])
    .map((r) => r.tag?.name)
    .filter((n): n is string => Boolean(n));

  const systemPrompt = await buildSystemPrompt({
    name: contact.name,
    phone: contact.phone,
    tags: tagNames,
    lastUserMessageAt: prevUserMsg?.created_at ?? null,
  });

  // 13) Generate + sanitize reply
  const rawReply = await generateReply(systemPrompt, history);
  const reply = sanitizeReply(rawReply);

  // 14) Send reply via the right channel
  let externalReplyId: string | null = null;
  try {
    externalReplyId = await sendChannelMessage(input.channel, contact.phone, reply);
  } catch (err) {
    console.error("[processor] reply send failed", err);
    await supabase.from("messages").insert({
      contact_id: contact.id,
      role: "assistant",
      content: reply,
      status: "failed",
      channel: input.channel,
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
    whatsapp_message_id: externalReplyId,
    status: "sent",
    channel: input.channel,
  });

  // 15) Clear typing
  await supabase
    .from("contacts")
    .update({ typing_until: null })
    .eq("id", contact.id);

  // 16) After-response background work: classify lead + sentiment + extract profile
  after(async () => {
    try {
      await classifyAndMaybeNotify(contact, history);
    } catch (err) {
      console.error("[processor.after] classify lead failed", err);
    }
    if (insertedUserMsg?.id) {
      try {
        const sentiment = await classifySentiment(input.content);
        await supabase
          .from("messages")
          .update({ sentiment })
          .eq("id", insertedUserMsg.id);
      } catch (err) {
        console.error("[processor.after] sentiment failed", err);
      }
    }
    // Lead profile enrichment — solo cuando hay suficiente contexto
    const userMsgs = history.filter((m) => m.role === "user").length;
    if (userMsgs >= 3) {
      try {
        await enrichLeadProfile(contact, history);
      } catch (err) {
        console.error("[processor.after] profile extraction failed", err);
      }
    }
  });
}

/**
 * Extract structured lead data from conversation and merge non-null fields
 * into the contact record. Never overwrites existing values with null.
 * Sets profile_enriching_until before starting so the UI can show a live indicator.
 */
async function enrichLeadProfile(
  contact: Contact,
  history: ChatMessage[],
): Promise<void> {
  const supabase = supabaseAdmin();

  // Signal "enriching now" so the UI shows the indicator
  await supabase
    .from("contacts")
    .update({
      profile_enriching_until: new Date(Date.now() + 30_000).toISOString(),
    })
    .eq("id", contact.id);

  try {
    const profile = await extractLeadProfile(history);
    const patch: Partial<Contact> & { profile_updated_at?: string; profile_enriching_until?: null } = {};
    const fields: (keyof LeadProfile)[] = [
      "email",
      "company",
      "website",
      "instagram",
      "linkedin",
      "timeline",
      "pain_points",
      "main_goal",
    ];
    for (const f of fields) {
      const value = profile[f];
      // Only update if we have a new non-null value AND the existing one is empty
      if (value && !contact[f as keyof Contact]) {
        (patch as Record<string, string>)[f] = value;
      }
    }
    if (Object.keys(patch).length > 0) {
      patch.profile_updated_at = new Date().toISOString();
    }
    // Always clear the enriching flag (whether we updated anything or not)
    patch.profile_enriching_until = null;
    await supabase.from("contacts").update(patch).eq("id", contact.id);
    console.log("[enrichLeadProfile] updated fields:", Object.keys(patch).filter((k) => k !== "profile_enriching_until"));
  } catch (err) {
    // On failure, clear the flag so the UI doesn't get stuck
    await supabase
      .from("contacts")
      .update({ profile_enriching_until: null })
      .eq("id", contact.id);
    throw err;
  }
}

async function classifyAndMaybeNotify(
  contact: Contact,
  history: ChatMessage[],
): Promise<void> {
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
      <p><strong>Canal:</strong> ${contact.channel}</p>
      <p><strong>Razón:</strong> ${reason}</p>
      <p><a href="https://crm-utopia.vercel.app/conversations/${contact.id}">Ver conversación</a></p>
    `;
    await sendNotification(subject, html);
    await supabase.from("leads").update({ notified: true }).eq("id", lead.id);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendChannelMessage } from "./channels/dispatch";
import { sendNotification } from "./resend";
import type { Channel, Contact, EscalationReason } from "./types";

const HANDOFF_ACK_MESSAGE =
  "Listo, le aviso al equipo y un humano te escribe en breve. ¡Gracias por la paciencia! 🙏";

const REASON_LABEL: Record<EscalationReason, string> = {
  explicit_request: "Pidió hablar con un humano explícitamente",
  frustration: "Expresó frustración o queja",
  manual: "Escalado manualmente desde el CRM",
  bot_initiated: "UtopIA decidió derivar a un humano",
};

/**
 * Mark a contact as needing human attention. Race-safe via conditional update —
 * only one concurrent caller will see wasAlreadyEscalated=false even if two
 * messages arrive simultaneously.
 */
export async function escalateContact(
  supabase: SupabaseClient,
  contactId: string,
  reason: EscalationReason,
): Promise<{ wasAlreadyEscalated: boolean }> {
  const { data: updated } = await supabase
    .from("contacts")
    .update({
      needs_human: true,
      escalated_at: new Date().toISOString(),
      escalation_reason: reason,
      bot_enabled: false,
    })
    .eq("id", contactId)
    .eq("needs_human", false)
    .select("id");

  return { wasAlreadyEscalated: !updated || updated.length === 0 };
}

/**
 * Resolve the handoff: bot resumes, conversation is marked as attended.
 */
export async function resolveHandoff(
  supabase: SupabaseClient,
  contactId: string,
): Promise<void> {
  await supabase
    .from("contacts")
    .update({
      needs_human: false,
      escalated_at: null,
      escalation_reason: null,
      bot_enabled: true,
    })
    .eq("id", contactId);
}

/**
 * Send a hardcoded acknowledgment to the customer (via their channel) so they
 * know the handoff was registered. Caller passes the channel.
 */
export async function sendHandoffAck(
  supabase: SupabaseClient,
  contact: Pick<Contact, "id" | "phone">,
  channel: Channel,
): Promise<void> {
  try {
    const externalId = await sendChannelMessage(
      channel,
      contact.phone,
      HANDOFF_ACK_MESSAGE,
    );
    await supabase.from("messages").insert({
      contact_id: contact.id,
      role: "assistant",
      content: HANDOFF_ACK_MESSAGE,
      whatsapp_message_id: externalId,
      status: "sent",
      flagged_reason: "handoff_ack",
      channel,
    });
  } catch (err) {
    console.error("[sendHandoffAck] send failed", err);
    await supabase.from("messages").insert({
      contact_id: contact.id,
      role: "assistant",
      content: HANDOFF_ACK_MESSAGE,
      status: "failed",
      flagged_reason: "handoff_ack",
      channel,
    });
  }
}

/**
 * Email the workspace owner that a contact needs human attention.
 */
export async function notifyOwnerOfHandoff(
  contact: Pick<Contact, "id" | "name" | "phone">,
  reason: EscalationReason,
  lastMessage: string,
): Promise<void> {
  const displayName = contact.name ?? contact.phone;
  const subject = `🆘 ${displayName} pidió hablar con vos`;
  const escapedMessage = lastMessage
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 1000);
  const html = `
    <h2>Un contacto necesita atención humana</h2>
    <p><strong>Contacto:</strong> ${displayName} — ${contact.phone}</p>
    <p><strong>Razón:</strong> ${REASON_LABEL[reason]}</p>
    <p><strong>Último mensaje:</strong></p>
    <blockquote style="border-left:3px solid #ccc;padding:8px 12px;margin:8px 0;background:#fafafa;white-space:pre-wrap">${escapedMessage}</blockquote>
    <p><strong>UtopIA quedó pausada</strong> para este contacto. El cliente recibió un mensaje confirmando que un humano lo va a contactar.</p>
    <p><a href="https://crm-utopia.vercel.app/conversations/${contact.id}" style="display:inline-block;background:#000;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Abrir conversación</a></p>
  `;
  try {
    await sendNotification(subject, html);
  } catch (err) {
    console.error("[notifyOwnerOfHandoff] resend failed", err);
  }
}

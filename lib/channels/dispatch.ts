import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendTelegramMessage } from "./telegram";
import type { Channel } from "@/lib/types";

/**
 * Channel-aware outbound message sender. Returns the external message id
 * (wamid for WhatsApp, telegram message_id stringified, etc.) on success.
 */
export async function sendChannelMessage(
  channel: Channel,
  recipient: string,
  text: string,
): Promise<string> {
  if (channel === "telegram") {
    const result = await sendTelegramMessage(recipient, text);
    return result.messageId;
  }
  // Default / fallback: WhatsApp
  return sendWhatsAppMessage(recipient, text);
}

export function externalIdField(channel: Channel): "whatsapp_message_id" {
  // We reuse the existing whatsapp_message_id column to store any external
  // message id, since it serves the same role (idempotency + correlation).
  // Renaming would be a bigger migration; keep simple.
  void channel;
  return "whatsapp_message_id";
}

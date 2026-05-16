const GRAPH = "https://graph.facebook.com/v21.0";

function endpoint(path: string) {
  return `${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/${path}`;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// Dev-mode workaround: Meta's allowlist for Argentine numbers stores them
// with the legacy "15" mobile prefix (e.g. 54351152333263), but webhooks
// arrive with the WhatsApp "9" prefix (e.g. 5493512333263). The allowlist
// check rejects the "9" form. Once the app is published, both work.
// Format: "wa_id=outbound_format,wa_id=outbound_format"
function applyRecipientOverride(phone: string): string {
  const raw = process.env.WHATSAPP_RECIPIENT_OVERRIDES;
  if (!raw) return phone;
  for (const pair of raw.split(",")) {
    const [from, to] = pair.split("=").map((s) => s.trim());
    if (from === phone && to) return to;
  }
  return phone;
}

export async function sendWhatsAppMessage(
  to: string,
  text: string,
): Promise<string> {
  to = applyRecipientOverride(to);
  const res = await fetch(endpoint("messages"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp send failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { messages: Array<{ id: string }> };
  return data.messages[0].id;
}

export async function markAsRead(messageId: string): Promise<void> {
  await fetch(endpoint("messages"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
}

/**
 * Download a media file by Meta media id.
 * Two-step: first GET media metadata (returns URL), then GET the binary with auth.
 */
export async function downloadMedia(
  mediaId: string,
): Promise<{ blob: Blob; mimeType: string }> {
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!metaRes.ok) {
    throw new Error(
      `WhatsApp media metadata failed (${metaRes.status}): ${await metaRes.text()}`,
    );
  }
  const meta = (await metaRes.json()) as { url: string; mime_type: string };

  const binRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!binRes.ok) {
    throw new Error(`WhatsApp media binary failed (${binRes.status})`);
  }
  const blob = await binRes.blob();
  return { blob, mimeType: meta.mime_type };
}

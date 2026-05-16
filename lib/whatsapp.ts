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

export async function sendWhatsAppMessage(
  to: string,
  text: string,
): Promise<string> {
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

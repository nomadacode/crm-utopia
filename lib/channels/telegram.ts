/**
 * Telegram Bot API wrapper.
 * Docs: https://core.telegram.org/bots/api
 *
 * Setup:
 * 1. Open Telegram, talk to @BotFather, /newbot, name + username → get TOKEN
 * 2. Set TELEGRAM_BOT_TOKEN env var
 * 3. POST {base}/setWebhook?url=https://your-app/api/telegram/webhook&secret_token=...
 */

const TELEGRAM_API = "https://api.telegram.org";

function botBase(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return `${TELEGRAM_API}/bot${token}`;
}

export type TelegramSendResult = { messageId: string };

/**
 * Send a text message to a Telegram chat. chatId is what we store in
 * contacts.phone for telegram contacts.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<TelegramSendResult> {
  const res = await fetch(`${botBase()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      // Telegram supports Markdown / HTML but we send plain text to match
      // UtopIA's existing "no markdown" rule.
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Telegram send failed (${res.status}): ${await res.text()}`,
    );
  }
  const data = (await res.json()) as {
    ok: boolean;
    result?: { message_id: number };
    description?: string;
  };
  if (!data.ok || !data.result) {
    throw new Error(`Telegram returned not-ok: ${data.description ?? "?"}`);
  }
  return { messageId: String(data.result.message_id) };
}

/**
 * Show "..." typing indicator. Telegram clears it automatically after 5 seconds
 * or when the next message arrives.
 */
export async function sendTelegramTyping(chatId: string): Promise<void> {
  await fetch(`${botBase()}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {});
}

/**
 * Download a Telegram file by file_id. Two-step: getFile to get path, then GET the binary.
 */
export async function downloadTelegramFile(
  fileId: string,
): Promise<{ blob: Blob; mimeType: string; suggestedName: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const metaRes = await fetch(`${botBase()}/getFile?file_id=${fileId}`);
  if (!metaRes.ok) {
    throw new Error(
      `Telegram getFile failed (${metaRes.status}): ${await metaRes.text()}`,
    );
  }
  const meta = (await metaRes.json()) as {
    ok: boolean;
    result?: { file_path: string };
    description?: string;
  };
  if (!meta.ok || !meta.result?.file_path) {
    throw new Error(`Telegram getFile not-ok: ${meta.description ?? "?"}`);
  }
  const filePath = meta.result.file_path;
  const fileRes = await fetch(`${TELEGRAM_API}/file/bot${token}/${filePath}`);
  if (!fileRes.ok) {
    throw new Error(`Telegram file fetch failed (${fileRes.status})`);
  }
  const blob = await fileRes.blob();
  // Telegram doesn't always set content-type on the file proxy. Infer from extension.
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const mimeByExt: Record<string, string> = {
    oga: "audio/ogg",
    ogg: "audio/ogg",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const mimeType = fileRes.headers.get("content-type") ?? mimeByExt[ext] ?? "application/octet-stream";
  const suggestedName = filePath.split("/").pop() ?? `file.${ext || "bin"}`;
  return { blob, mimeType, suggestedName };
}

/**
 * Configure the webhook URL on the Telegram side. Idempotent — call once at deploy.
 */
export async function setTelegramWebhook(
  url: string,
  secretToken?: string,
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`${botBase()}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secretToken,
      allowed_updates: ["message", "edited_message"],
      drop_pending_updates: false,
    }),
  });
  return res.json();
}

// ---------- Update parsing ----------

export type TelegramIncoming = {
  chatId: string;
  messageId: string;
  from: { id: number; firstName: string | null; lastName: string | null; username: string | null };
  text: string | null;
  voice?: { fileId: string; mimeType: string };
  audio?: { fileId: string; mimeType: string };
  photo?: { fileId: string; caption?: string };
  document?: { fileId: string; fileName: string };
};

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramPhotoSize = { file_id: string; width: number; height: number };

type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number };
  text?: string;
  caption?: string;
  voice?: { file_id: string; mime_type: string };
  audio?: { file_id: string; mime_type: string };
  photo?: TelegramPhotoSize[];
  document?: { file_id: string; file_name?: string };
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

export function parseTelegramUpdate(
  update: TelegramUpdate,
): TelegramIncoming | null {
  const msg = update.message ?? update.edited_message;
  if (!msg) return null;

  // Largest photo
  const photo = msg.photo?.length
    ? msg.photo.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b))
    : undefined;

  return {
    chatId: String(msg.chat.id),
    messageId: String(msg.message_id),
    from: {
      id: msg.from?.id ?? 0,
      firstName: msg.from?.first_name ?? null,
      lastName: msg.from?.last_name ?? null,
      username: msg.from?.username ?? null,
    },
    text: msg.text ?? msg.caption ?? null,
    voice: msg.voice
      ? { fileId: msg.voice.file_id, mimeType: msg.voice.mime_type }
      : undefined,
    audio: msg.audio
      ? { fileId: msg.audio.file_id, mimeType: msg.audio.mime_type }
      : undefined,
    photo: photo
      ? { fileId: photo.file_id, caption: msg.caption }
      : undefined,
    document: msg.document
      ? { fileId: msg.document.file_id, fileName: msg.document.file_name ?? "document" }
      : undefined,
  };
}

export function displayNameFromTelegram(from: TelegramIncoming["from"]): string | null {
  const parts = [from.firstName, from.lastName].filter(Boolean) as string[];
  if (parts.length) return parts.join(" ");
  return from.username ?? null;
}

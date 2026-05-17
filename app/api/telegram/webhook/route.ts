import { NextRequest, NextResponse } from "next/server";
import {
  parseTelegramUpdate,
  downloadTelegramFile,
  displayNameFromTelegram,
  type TelegramUpdate,
  type TelegramIncoming,
} from "@/lib/channels/telegram";
import { transcribeAudio, uploadMedia } from "@/lib/media";
import { describeImage } from "@/lib/ai";
import {
  processInboundMessage,
  type ProcessedInbound,
} from "@/lib/conversation-processor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Telegram webhook. Telegram POSTs updates here. Optional secret token
 * verification via X-Telegram-Bot-Api-Secret-Token header.
 */
export async function POST(req: NextRequest) {
  // Optional secret token verification (set in setWebhook + TELEGRAM_WEBHOOK_SECRET env)
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expectedSecret) {
      console.warn("[tg-webhook] bad secret token");
      return new NextResponse("forbidden", { status: 403 });
    }
  }

  let body: TelegramUpdate;
  try {
    body = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }
  console.log("[tg-webhook] update", JSON.stringify(body).slice(0, 500));

  try {
    const incoming = parseTelegramUpdate(body);
    if (!incoming) return NextResponse.json({ ok: true });

    const processed = await processTelegramMessage(incoming);
    if (!processed) {
      console.log("[tg-webhook] unsupported message, ignoring");
      return NextResponse.json({ ok: true });
    }

    const input: ProcessedInbound = {
      channel: "telegram",
      externalContactId: incoming.chatId,
      externalMessageId: incoming.messageId,
      contactName: displayNameFromTelegram(incoming.from),
      content: processed.content,
      mediaType: processed.mediaType,
      mediaUrl: processed.mediaUrl,
    };

    await processInboundMessage(input);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tg-webhook] handler error", err);
    return NextResponse.json({ ok: true });
  }
}

type TGProcessed = {
  content: string;
  mediaType: "audio" | "image" | "video" | "document" | null;
  mediaUrl: string | null;
};

async function processTelegramMessage(
  incoming: TelegramIncoming,
): Promise<TGProcessed | null> {
  // Text only (most common)
  if (incoming.text && !incoming.voice && !incoming.audio && !incoming.photo) {
    return { content: incoming.text, mediaType: null, mediaUrl: null };
  }

  // Voice note or audio
  if (incoming.voice || incoming.audio) {
    const media = incoming.voice ?? incoming.audio!;
    try {
      const { blob, mimeType, suggestedName } = await downloadTelegramFile(media.fileId);
      const ext = suggestedName.split(".").pop() ?? "ogg";
      const filename = `audio/tg-${incoming.messageId}.${ext}`;
      const publicUrl = await uploadMedia(blob, filename, mimeType).catch(() => null);
      const transcript = await transcribeAudio(blob, mimeType);
      const content = transcript
        ? `🎤 ${transcript}`
        : "🎤 [audio recibido — no se pudo transcribir]";
      return { content, mediaType: "audio", mediaUrl: publicUrl };
    } catch (err) {
      console.error("[tg-webhook] audio failed", err);
      return {
        content: "🎤 [audio recibido — error al procesar]",
        mediaType: "audio",
        mediaUrl: null,
      };
    }
  }

  // Photo
  if (incoming.photo) {
    try {
      const { blob, mimeType, suggestedName } = await downloadTelegramFile(
        incoming.photo.fileId,
      );
      const ext = suggestedName.split(".").pop() ?? "jpg";
      const filename = `image/tg-${incoming.messageId}.${ext}`;
      const publicUrl = await uploadMedia(blob, filename, mimeType);
      const description = await describeImage(publicUrl, incoming.photo.caption);
      const content = incoming.photo.caption
        ? `🖼️ ${incoming.photo.caption}\n${description}`
        : `🖼️ ${description}`;
      return { content, mediaType: "image", mediaUrl: publicUrl };
    } catch (err) {
      console.error("[tg-webhook] image failed", err);
      return {
        content: "🖼️ [imagen recibida — error al procesar]",
        mediaType: "image",
        mediaUrl: null,
      };
    }
  }

  // Document — placeholder for now
  if (incoming.document) {
    return {
      content: `📄 [documento recibido: ${incoming.document.fileId}]`,
      mediaType: "document",
      mediaUrl: null,
    };
  }

  return null;
}

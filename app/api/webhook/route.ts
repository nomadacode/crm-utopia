import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { describeImage } from "@/lib/ai";
import { downloadMedia, markAsRead } from "@/lib/whatsapp";
import { transcribeAudio, uploadMedia } from "@/lib/media";
import {
  processInboundMessage,
  type ProcessedInbound,
} from "@/lib/conversation-processor";
import type { Message } from "@/lib/types";

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
  // WhatsApp no está configurado todavía (no hay WABA). Mantenemos esta ruta
  // pública inerte hasta conectar credenciales. Al habilitar WhatsApp, reemplazar
  // este guard por la verificación de la firma X-Hub-Signature-256 de Meta.
  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    return new NextResponse("not found", { status: 404 });
  }

  const body = await req.json();
  console.log("[wa-webhook] POST", JSON.stringify(body).slice(0, 500));
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    if (!change) return NextResponse.json({ ok: true });

    if (Array.isArray(change.statuses)) {
      await handleStatuses(change.statuses);
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(change.messages)) {
      await handleIncoming(change);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[wa-webhook] handler error", err);
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

async function handleIncoming(change: IncomingChange) {
  const msg = change.messages[0];
  if (!msg) return;

  // Process channel-specific media to produce text content for the LLM
  const processed = await processWhatsAppMessage(msg);
  if (!processed) {
    console.log("[wa-webhook] unsupported type, ignoring:", msg.type);
    return;
  }

  const profileName = change.contacts?.[0]?.profile?.name ?? null;

  // Mark read (fire-and-forget)
  markAsRead(msg.id).catch(() => {});

  const input: ProcessedInbound = {
    channel: "whatsapp",
    externalContactId: msg.from,
    externalMessageId: msg.id,
    contactName: profileName,
    content: processed.content,
    mediaType: processed.mediaType,
    mediaUrl: processed.mediaUrl,
    adSource: msg.referral?.source_id ?? null,
    ctwaClid: msg.referral?.ctwa_clid ?? null,
  };

  await processInboundMessage(input);
}

type WAProcessed = {
  content: string;
  mediaType: "audio" | "image" | "video" | "document" | null;
  mediaUrl: string | null;
};

async function processWhatsAppMessage(
  msg: IncomingMessage,
): Promise<WAProcessed | null> {
  if (msg.type === "text" && msg.text?.body) {
    return { content: msg.text.body, mediaType: null, mediaUrl: null };
  }
  if (msg.type === "audio" && msg.audio?.id) {
    try {
      const { blob, mimeType } = await downloadMedia(msg.audio.id);
      const ext = (mimeType.split("/")[1] ?? "ogg").split(";")[0];
      const filename = `audio/${msg.id}.${ext}`;
      const publicUrl = await uploadMedia(blob, filename, mimeType).catch(() => null);
      const transcript = await transcribeAudio(blob, mimeType);
      const content = transcript
        ? `🎤 ${transcript}`
        : "🎤 [audio recibido — no se pudo transcribir]";
      return { content, mediaType: "audio", mediaUrl: publicUrl };
    } catch (err) {
      console.error("[wa-webhook] audio failed", err);
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
      console.error("[wa-webhook] image failed", err);
      return {
        content: "🖼️ [imagen recibida — error al procesar]",
        mediaType: "image",
        mediaUrl: null,
      };
    }
  }
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

// Keep type export to satisfy downstream consumers
export type _Message = Message;

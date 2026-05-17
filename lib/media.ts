import { supabaseAdmin } from "./supabase/admin";

const STORAGE_BUCKET = "whatsapp-media";

/**
 * Upload a blob to Supabase Storage and return the public URL.
 */
export async function uploadMedia(
  blob: Blob,
  filename: string,
  mimeType: string,
): Promise<string> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, blob, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Whisper accepts only: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm.
 * Any other extension is rejected with 400 invalid_request_error.
 */
const WHISPER_EXTS = new Set([
  "flac", "m4a", "mp3", "mp4", "mpeg", "mpga", "oga", "ogg", "wav", "webm",
]);

function pickWhisperExtension(mimeType: string): string {
  const raw = mimeType.toLowerCase();
  // Direct subtype after slash, stripping codec/parameters
  const sub = raw.split("/")[1]?.split(";")[0]?.trim() ?? "";
  if (WHISPER_EXTS.has(sub)) return sub;
  // Common synonyms / parent-types
  if (raw.includes("ogg") || raw.includes("opus")) return "ogg";
  if (raw.includes("mpeg") || raw.includes("mp3")) return "mp3";
  if (raw.includes("mp4") || raw.includes("m4a") || raw.includes("aac")) return "m4a";
  if (raw.includes("wav") || raw.includes("wave")) return "wav";
  if (raw.includes("webm")) return "webm";
  if (raw.includes("flac")) return "flac";
  // WhatsApp + Telegram voice notes are OGG OPUS — safe default
  return "ogg";
}

/**
 * Transcribe an audio blob with OpenAI Whisper.
 * Requires OPENAI_API_KEY in env. Returns empty string if not configured.
 */
export async function transcribeAudio(
  blob: Blob,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[transcribeAudio] OPENAI_API_KEY not set, skipping");
    return "";
  }
  const ext = pickWhisperExtension(mimeType);
  const formData = new FormData();
  formData.append("file", blob, `audio.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("language", "es");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Whisper failed (${res.status}, mime=${mimeType}, ext=${ext}): ${text}`,
    );
  }
  const data = (await res.json()) as { text: string };
  return data.text.trim();
}

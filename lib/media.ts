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
  const formData = new FormData();
  // Whisper accepts ogg/oga/m4a/mp3/wav/webm — WhatsApp typically sends audio/ogg
  const ext = mimeType.split("/")[1]?.split(";")[0] ?? "ogg";
  formData.append("file", blob, `audio.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("language", "es");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Whisper failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { text: string };
  return data.text.trim();
}

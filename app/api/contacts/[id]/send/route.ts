import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sbSession = await supabaseServer();
  const {
    data: { user },
  } = await sbSession.auth.getUser();
  if (!user) return new NextResponse("forbidden", { status: 403 });

  const { id } = await params;
  const { content } = (await req.json()) as { content: string };
  if (!content?.trim())
    return NextResponse.json({ error: "empty" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: contact } = await sb
    .from("contacts")
    .select("phone")
    .eq("id", id)
    .maybeSingle();
  if (!contact)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const wamid = await sendWhatsAppMessage(contact.phone, content);
    await sb.from("messages").insert({
      contact_id: id,
      role: "assistant",
      content,
      whatsapp_message_id: wamid,
      status: "sent",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

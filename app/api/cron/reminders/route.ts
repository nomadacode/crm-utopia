import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth !== `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (unauthorized(req)) return new NextResponse("forbidden", { status: 403 });

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  type DueReminder = {
    id: string;
    contact_id: string;
    message: string;
    remind_at: string;
    contact: { name: string | null; phone: string } | null;
  };

  const { data } = await supabase
    .from("reminders")
    .select(
      "id, contact_id, message, remind_at, contact:contacts(name, phone)",
    )
    .lte("remind_at", now)
    .is("dismissed_at", null)
    .order("remind_at", { ascending: true })
    .limit(50);

  const due = (data ?? []) as unknown as DueReminder[];
  if (due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  for (const r of due) {
    const name = r.contact?.name ?? r.contact?.phone ?? "(contacto)";
    const subject = `⏰ Recordatorio — ${name}`;
    const html = `
      <h2>Recordatorio de UtopIA</h2>
      <p><strong>Contacto:</strong> ${name} — ${r.contact?.phone ?? ""}</p>
      <p><strong>Nota:</strong> ${r.message}</p>
      <p><a href="https://crm-utopia.vercel.app/conversations/${r.contact_id}">Abrir conversación</a></p>
    `;
    try {
      await sendNotification(subject, html);
      await supabase
        .from("reminders")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", r.id);
      sent++;
    } catch (err) {
      console.error("[cron/reminders] send failed", r.id, err);
    }
  }
  return NextResponse.json({ ok: true, sent });
}

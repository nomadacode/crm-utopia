import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function requireAuth() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const { id } = await params;
  const { dismissed } = (await req.json()) as { dismissed?: boolean };
  const admin = supabaseAdmin();
  const { error } = await admin
    .from("reminders")
    .update({ dismissed_at: dismissed ? new Date().toISOString() : null })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const { id } = await params;
  const admin = supabaseAdmin();
  const { error } = await admin.from("reminders").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

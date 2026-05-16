import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function requireAuth() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const { id } = await params;
  const { tag_id } = (await req.json()) as { tag_id: string };
  if (!tag_id) return NextResponse.json({ error: "tag_id required" }, { status: 400 });
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("contact_tags")
    .upsert({ contact_id: id, tag_id }, { ignoreDuplicates: true });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const { id } = await params;
  const { tag_id } = (await req.json()) as { tag_id: string };
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("contact_tags")
    .delete()
    .eq("contact_id", id)
    .eq("tag_id", tag_id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

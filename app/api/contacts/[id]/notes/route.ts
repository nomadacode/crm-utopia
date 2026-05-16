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
  const { content } = (await req.json()) as { content: string };
  if (!content?.trim())
    return NextResponse.json({ error: "empty" }, { status: 400 });
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("contact_notes")
    .insert({ contact_id: id, content: content.trim() })
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

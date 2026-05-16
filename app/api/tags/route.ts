import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TAG_COLORS } from "@/lib/types";

export const runtime = "nodejs";

async function requireAuth() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const sb = supabaseAdmin();
  const { data } = await sb.from("tags").select("*").order("name");
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const { name, color } = (await req.json()) as { name: string; color?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const safeColor = TAG_COLORS.includes(color as never) ? color : "gray";
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("tags")
    .insert({ name: name.trim(), color: safeColor })
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

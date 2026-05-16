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
  const { message, remind_at } = (await req.json()) as {
    message: string;
    remind_at: string;
  };
  if (!message?.trim() || !remind_at) {
    return NextResponse.json(
      { error: "message and remind_at required" },
      { status: 400 },
    );
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("reminders")
    .insert({
      contact_id: id,
      message: message.trim(),
      remind_at,
    })
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

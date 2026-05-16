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
  const body = (await req.json()) as Partial<{
    blocked: boolean;
    bot_enabled: boolean;
  }>;
  const update: Record<string, boolean> = {};
  if (typeof body.blocked === "boolean") update.blocked = body.blocked;
  if (typeof body.bot_enabled === "boolean") update.bot_enabled = body.bot_enabled;

  const sb = supabaseAdmin();
  const { error } = await sb.from("contacts").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

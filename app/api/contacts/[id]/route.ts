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
    archived: boolean;
    mark_read: boolean;
    stage_id: string | null;
    deal_value: number | null;
    industry: string | null;
  }>;
  const update: Record<string, boolean | string | number | null> = {};
  if (typeof body.blocked === "boolean") update.blocked = body.blocked;
  if (typeof body.bot_enabled === "boolean")
    update.bot_enabled = body.bot_enabled;
  if (typeof body.archived === "boolean")
    update.archived_at = body.archived ? new Date().toISOString() : null;
  if (body.mark_read) update.last_read_at = new Date().toISOString();
  if ("stage_id" in body) update.stage_id = body.stage_id ?? null;
  if ("deal_value" in body)
    update.deal_value = body.deal_value == null ? null : Number(body.deal_value);
  if ("industry" in body) update.industry = body.industry ?? null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }
  const sb = supabaseAdmin();
  const { error } = await sb.from("contacts").update(update).eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

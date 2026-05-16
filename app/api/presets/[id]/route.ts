import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { deletePreset, upsertPreset } from "@/lib/utopia-prompt";

export const runtime = "nodejs";

async function requireAuth() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const { id } = await params;
  const { name, system_prompt } = (await req.json()) as {
    name: string;
    system_prompt: string;
  };
  const preset = await upsertPreset({
    id,
    name: name.trim(),
    system_prompt: system_prompt.trim(),
  });
  return NextResponse.json(preset);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const { id } = await params;
  await deletePreset(id);
  return NextResponse.json({ ok: true });
}

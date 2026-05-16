import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { listPresets, upsertPreset } from "@/lib/utopia-prompt";

export const runtime = "nodejs";

async function requireAuth() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const presets = await listPresets();
  return NextResponse.json(presets);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const { name, system_prompt } = (await req.json()) as {
    name: string;
    system_prompt: string;
  };
  if (!name?.trim() || !system_prompt?.trim()) {
    return NextResponse.json(
      { error: "name and system_prompt required" },
      { status: 400 },
    );
  }
  const preset = await upsertPreset({
    name: name.trim(),
    system_prompt: system_prompt.trim(),
  });
  return NextResponse.json(preset);
}

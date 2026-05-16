import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { setActivePreset } from "@/lib/utopia-prompt";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const { id } = await params;
  await setActivePreset(id);
  return NextResponse.json({ ok: true });
}

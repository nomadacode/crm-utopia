import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { setSystemPrompt } from "@/lib/utopia-prompt";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new NextResponse("forbidden", { status: 403 });

  const { value } = (await req.json()) as { value: string };
  if (typeof value !== "string" || !value.trim()) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }
  await setSystemPrompt(value);
  return NextResponse.json({ ok: true });
}

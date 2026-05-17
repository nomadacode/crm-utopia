import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  getBusinessProfile,
  updateBusinessProfile,
  type BusinessProfile,
} from "@/lib/utopia-prompt";

export const runtime = "nodejs";

async function requireAuth() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const profile = await getBusinessProfile();
  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return new NextResponse("forbidden", { status: 403 });
  const body = (await req.json()) as Partial<BusinessProfile>;
  const allowed = [
    "business_name",
    "description",
    "services",
    "prices",
    "hours",
    "calendar_link",
    "handoff_info",
    "additional_context",
  ] as const;
  const patch: Partial<BusinessProfile> = {};
  for (const key of allowed) {
    if (key in body) {
      const value = (body[key] as string | null | undefined) ?? null;
      patch[key] = typeof value === "string" ? value.trim() || null : value;
    }
  }
  const updated = await updateBusinessProfile(patch);
  return NextResponse.json(updated);
}

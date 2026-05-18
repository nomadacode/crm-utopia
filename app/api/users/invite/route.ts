import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

type Body = {
  email: string;
  role: "admin" | "agent";
  full_name?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite a user by email. Supabase Auth creates the auth.users row immediately
 * and sends a magic-link email; on click, the on_auth_user_created trigger
 * inserts a default 'agent' user_profile. We follow up with an upsert so the
 * admin's chosen role wins even if the trigger races first.
 */
export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = (await req.json()) as Partial<Body>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role === "admin" || body.role === "agent" ? body.role : null;
  const fullName =
    typeof body.full_name === "string" ? body.full_name.trim() || null : null;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
  });
  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo enviar la invitación" },
      { status: 500 },
    );
  }

  // Upsert the profile so admin-chosen role overrides the trigger's default.
  const { error: profileError } = await sb
    .from("user_profiles")
    .upsert(
      { user_id: data.user.id, role, full_name: fullName, is_active: true },
      { onConflict: "user_id" },
    );
  if (profileError) {
    return NextResponse.json(
      { error: `Invitado pero falló asignar rol: ${profileError.message}` },
      { status: 500 },
    );
  }

  await logAudit({
    actorId: admin.id,
    action: "user.invite",
    entityType: "user",
    entityId: data.user.id,
    metadata: { email, role },
  });

  return NextResponse.json({
    ok: true,
    user: {
      user_id: data.user.id,
      email,
      role,
      full_name: fullName,
    },
  });
}

import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export type UserListItem = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "agent";
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

/**
 * List every user with their profile (role / is_active) and auth metadata
 * (email / last sign in). Admin only. Auth.users isn't exposed via the public
 * schema so we go through the admin API; both queries run in parallel and
 * are joined by user_id in JS.
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const sb = supabaseAdmin();
  const [profilesRes, authRes] = await Promise.all([
    sb
      .from("user_profiles")
      .select("user_id, full_name, role, is_active, created_at")
      .order("created_at", { ascending: true }),
    sb.auth.admin.listUsers({ perPage: 200 }),
  ]);

  if (profilesRes.error) {
    return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });
  }
  if (authRes.error) {
    return NextResponse.json({ error: authRes.error.message }, { status: 500 });
  }

  const authById = new Map<
    string,
    { email: string; last_sign_in_at: string | null }
  >();
  for (const u of authRes.data.users) {
    authById.set(u.id, {
      email: u.email ?? "",
      last_sign_in_at: u.last_sign_in_at ?? null,
    });
  }

  const users: UserListItem[] = (profilesRes.data ?? []).map((p) => ({
    user_id: p.user_id,
    email: authById.get(p.user_id)?.email ?? "",
    full_name: p.full_name,
    role: p.role,
    is_active: p.is_active,
    created_at: p.created_at,
    last_sign_in_at: authById.get(p.user_id)?.last_sign_in_at ?? null,
  }));

  return NextResponse.json({ users });
}

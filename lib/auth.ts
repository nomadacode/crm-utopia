import "server-only";
import { supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";

export type UserRole = "admin" | "agent";

export type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  is_active: boolean;
};

/**
 * Resolve the user for the current request: validates the auth cookie via
 * Supabase, then loads their role from user_profiles. Returns null when
 * unauthenticated; never throws. Use requireUser/requireAdmin when you need
 * to gate an action.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  // Read role with the service-role client so RLS doesn't hide it from
  // a freshly-signed-up user before policies are evaluated.
  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, full_name, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    role: (profile?.role ?? "agent") as UserRole,
    full_name: profile?.full_name ?? null,
    // Default to true so a freshly-signed-up user whose profile hasn't been
    // inserted yet by the trigger isn't accidentally locked out.
    is_active: profile?.is_active ?? true,
  };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Unauthenticated", 401);
  if (!user.is_active) throw new AuthError("Account deactivated", 403);
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AuthError("Admin role required", 403);
  return user;
}

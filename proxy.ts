import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/login",
  "/api/webhook",
  "/api/telegram",
  "/api/auth/callback",
  "/api/cron",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes((user.email ?? "").toLowerCase())) {
    return new NextResponse("403 — Email no autorizado", { status: 403 });
  }

  // Soft-revoke: admins can flip is_active=false in user_profiles to lock a
  // user out without deleting their auth row (preserves audit trail). The
  // RLS policy on user_profiles lets the authenticated role read its own row.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.is_active === false) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "deactivated");
    // Clear the session before redirecting so the user has to log in again
    // even if an admin re-activates them.
    await supabase.auth.signOut();
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};

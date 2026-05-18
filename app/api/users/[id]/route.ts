import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

type PatchBody = {
  role?: "admin" | "agent";
  is_active?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = (await req.json()) as Partial<PatchBody>;
  const patch: { role?: "admin" | "agent"; is_active?: boolean } = {};
  if (body.role === "admin" || body.role === "agent") {
    patch.role = body.role;
  }
  if (typeof body.is_active === "boolean") {
    patch.is_active = body.is_active;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  // Self-protection: don't let the admin lock themselves out by demoting or
  // deactivating their own user. If they want to leave, another admin has to
  // promote first.
  if (id === admin.id) {
    if (patch.role === "agent") {
      return NextResponse.json(
        { error: "No podés quitarte el rol admin a vos mismo" },
        { status: 400 },
      );
    }
    if (patch.is_active === false) {
      return NextResponse.json(
        { error: "No podés desactivar tu propia cuenta" },
        { status: 400 },
      );
    }
  }

  const sb = supabaseAdmin();
  const { data: updated, error } = await sb
    .from("user_profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", id)
    .select("user_id, role, is_active, full_name")
    .single();
  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo actualizar" },
      { status: 500 },
    );
  }

  if (patch.role) {
    await logAudit({
      actorId: admin.id,
      action: "user.role_change",
      entityType: "user",
      entityId: id,
      metadata: { new_role: patch.role },
    });
  }
  if (patch.is_active === false) {
    await logAudit({
      actorId: admin.id,
      action: "user.remove",
      entityType: "user",
      entityId: id,
    });
  }

  return NextResponse.json({ ok: true, user: updated });
}

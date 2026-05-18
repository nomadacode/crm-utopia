import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AuthError, requireUser } from "@/lib/auth";
import { logAudit, type AuditAction } from "@/lib/audit";

export const runtime = "nodejs";

type BulkAction =
  | "archive"
  | "unarchive"
  | "mark_read"
  | "mark_unread"
  | "tag_add"
  | "tag_remove";

type Body = {
  ids: string[];
  action: BulkAction;
  tag_id?: string;
};

const ACTION_TO_AUDIT: Record<BulkAction, AuditAction> = {
  archive: "contact.archive",
  unarchive: "contact.unarchive",
  mark_read: "contact.mark_read",
  mark_unread: "contact.mark_unread",
  tag_add: "contact.tag_add",
  tag_remove: "contact.tag_remove",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = (await req.json()) as Partial<Body>;
  const ids = Array.isArray(body.ids) ? body.ids.filter((s) => typeof s === "string" && UUID_RE.test(s)) : [];
  const action = body.action;
  const tagId = typeof body.tag_id === "string" ? body.tag_id : undefined;

  if (!action || !(action in ACTION_TO_AUDIT)) {
    return NextResponse.json(
      { error: "invalid action" },
      { status: 400 },
    );
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "no ids" }, { status: 400 });
  }
  if ((action === "tag_add" || action === "tag_remove") && (!tagId || !UUID_RE.test(tagId))) {
    return NextResponse.json(
      { error: "tag_id required for tag actions" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();

  let dbError: string | null = null;
  switch (action) {
    case "archive": {
      const { error } = await sb
        .from("contacts")
        .update({ archived_at: nowIso })
        .in("id", ids);
      dbError = error?.message ?? null;
      break;
    }
    case "unarchive": {
      const { error } = await sb
        .from("contacts")
        .update({ archived_at: null })
        .in("id", ids);
      dbError = error?.message ?? null;
      break;
    }
    case "mark_read": {
      const { error } = await sb
        .from("contacts")
        .update({ last_read_at: nowIso })
        .in("id", ids);
      dbError = error?.message ?? null;
      break;
    }
    case "mark_unread": {
      const { error } = await sb
        .from("contacts")
        .update({ last_read_at: null })
        .in("id", ids);
      dbError = error?.message ?? null;
      break;
    }
    case "tag_add": {
      const rows = ids.map((contact_id) => ({
        contact_id,
        tag_id: tagId!,
      }));
      const { error } = await sb
        .from("contact_tags")
        .upsert(rows, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
      dbError = error?.message ?? null;
      break;
    }
    case "tag_remove": {
      const { error } = await sb
        .from("contact_tags")
        .delete()
        .in("contact_id", ids)
        .eq("tag_id", tagId!);
      dbError = error?.message ?? null;
      break;
    }
  }

  if (dbError) {
    return NextResponse.json({ error: dbError }, { status: 500 });
  }

  // Audit: one row per contact so per-contact history queries are cheap.
  const auditAction = ACTION_TO_AUDIT[action];
  const metadata = tagId ? { tag_id: tagId } : undefined;
  await Promise.all(
    ids.map((id) =>
      logAudit({
        actorId: user.id,
        action: auditAction,
        entityType: "contact",
        entityId: id,
        metadata,
      }),
    ),
  );

  return NextResponse.json({ ok: true, count: ids.length });
}

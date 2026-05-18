import "server-only";
import { supabaseAdmin } from "./supabase/admin";

export type AuditAction =
  // Contacts / conversations
  | "contact.archive"
  | "contact.unarchive"
  | "contact.mark_read"
  | "contact.mark_unread"
  | "contact.tag_add"
  | "contact.tag_remove"
  | "contact.escalate"
  | "contact.resolve_handoff"
  | "contact.profile_update"
  // Leads / pipeline
  | "lead.classify"
  | "lead.stage_change"
  // Messages
  | "message.send"
  // Users
  | "user.invite"
  | "user.role_change"
  | "user.remove";

export type AuditEntity = "contact" | "lead" | "message" | "user";

type LogArgs = {
  actorId: string | null;
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Append a row to audit_log. Always uses the service-role client so writes
 * succeed regardless of RLS. Failures are logged to console rather than
 * thrown — never block the underlying action because audit failed.
 */
export async function logAudit(args: LogArgs): Promise<void> {
  const sb = supabaseAdmin();
  const { error } = await sb.from("audit_log").insert({
    actor_id: args.actorId,
    action: args.action,
    entity_type: args.entityType,
    entity_id: args.entityId ?? null,
    metadata: args.metadata ?? null,
  });
  if (error) {
    console.error("[audit] failed to write log entry", {
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      error: error.message,
    });
  }
}

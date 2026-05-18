import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ConversationControls } from "./controls";
import { ConversationView } from "./conversation-view";
import { LeadCard } from "./lead-card";
import { TagsPanel } from "./tags-panel";
import { NotesPanel } from "./notes-panel";
import { RemindersPanel } from "./reminders-panel";
import { DealPanel } from "./deal-panel";
import { HandoffBanner } from "./handoff-banner";
import { InfoPanel } from "./info-panel";
import { ProfilePanel } from "./profile-panel";
import type {
  Channel,
  ContactNote,
  EscalationReason,
  Message,
  PipelineStage,
  Reminder,
  Tag,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: contact } = await sb
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!contact) notFound();

  // Mark as read on open (fire-and-forget, before fetching messages)
  void sb
    .from("contacts")
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", id);

  const [
    { data: messages },
    { data: lead },
    { data: allTags },
    { data: assignedTags },
    { data: notes },
    { data: pendingReminders },
    { data: stages },
  ] = await Promise.all([
    sb
      .from("messages")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: true }),
    sb
      .from("leads")
      .select("score, reason, qualified_at")
      .eq("contact_id", id)
      .order("qualified_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("tags").select("*").order("name"),
    sb
      .from("contact_tags")
      .select("tag:tags(id, name, color, created_at)")
      .eq("contact_id", id),
    sb
      .from("contact_notes")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    sb
      .from("reminders")
      .select("*")
      .eq("contact_id", id)
      .is("dismissed_at", null)
      .order("remind_at", { ascending: true }),
    sb.from("pipeline_stages").select("*").order("position"),
  ]);

  type TagRow = { tag: Tag | null };
  const initialTags: Tag[] = ((assignedTags ?? []) as unknown as TagRow[])
    .map((r) => r.tag)
    .filter((t): t is Tag => t !== null);

  const panelChildren = (
    <>
      <LeadCard
        score={lead?.score as "hot" | "warm" | "cold" | undefined}
        reason={lead?.reason}
      />
      <ProfilePanel
        contactId={contact.id}
        initial={{
          email: contact.email ?? null,
          company: contact.company ?? null,
          website: contact.website ?? null,
          instagram: contact.instagram ?? null,
          linkedin: contact.linkedin ?? null,
          timeline: contact.timeline ?? null,
          pain_points: contact.pain_points ?? null,
          main_goal: contact.main_goal ?? null,
        }}
        profileUpdatedAt={contact.profile_updated_at ?? null}
        profileEnrichingUntil={contact.profile_enriching_until ?? null}
      />
      <DealPanel
        contactId={contact.id}
        initialStageId={contact.stage_id}
        initialIndustry={contact.industry}
        initialDealValue={contact.deal_value}
        stages={(stages ?? []) as PipelineStage[]}
      />
      <TagsPanel
        contactId={contact.id}
        initialAssigned={initialTags}
        allTags={(allTags ?? []) as Tag[]}
      />
      <RemindersPanel
        contactId={contact.id}
        initialReminders={(pendingReminders ?? []) as Reminder[]}
      />
      <NotesPanel
        contactId={contact.id}
        initialNotes={(notes ?? []) as ContactNote[]}
      />
      <ConversationControls
        contactId={contact.id}
        initialBlocked={contact.blocked}
        initialBotEnabled={contact.bot_enabled}
        initialArchived={contact.archived_at != null}
        initialNeedsHuman={contact.needs_human}
      />
    </>
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-6xl flex-col gap-3 md:h-[calc(100vh-4rem)]">
      <HandoffBanner
        contactId={contact.id}
        initial={{
          needs_human: contact.needs_human,
          escalation_reason:
            (contact.escalation_reason as EscalationReason | null) ?? null,
          escalated_at: contact.escalated_at,
        }}
      />

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="flex flex-col overflow-hidden rounded-lg p-0">
          <ConversationView
            initialContact={{
              id: contact.id,
              phone: contact.phone,
              name: contact.name,
              typing_until: contact.typing_until,
              channel: (contact.channel ?? "whatsapp") as Channel,
            }}
            initialMessages={(messages ?? []) as Message[]}
          />
        </Card>
        <InfoPanel>{panelChildren}</InfoPanel>
      </div>
    </div>
  );
}

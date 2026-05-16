import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ConversationControls } from "./controls";
import { ConversationView } from "./conversation-view";
import { LeadCard } from "./lead-card";
import type { Message } from "@/lib/types";

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

  const { data: messages } = await sb
    .from("messages")
    .select("*")
    .eq("contact_id", id)
    .order("created_at", { ascending: true });

  const { data: lead } = await sb
    .from("leads")
    .select("score, reason, qualified_at")
    .eq("contact_id", id)
    .order("qualified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto grid h-[calc(100vh-4rem)] max-w-6xl grid-cols-[1fr_280px] gap-6">
      <Card className="flex flex-col overflow-hidden rounded-lg p-0">
        <ConversationView
          initialContact={{
            id: contact.id,
            phone: contact.phone,
            name: contact.name,
            typing_until: contact.typing_until,
          }}
          initialMessages={(messages ?? []) as Message[]}
        />
      </Card>

      <div className="space-y-4">
        <LeadCard
          score={lead?.score as "hot" | "warm" | "cold" | undefined}
          reason={lead?.reason}
        />
        <ConversationControls
          contactId={contact.id}
          initialBlocked={contact.blocked}
          initialBotEnabled={contact.bot_enabled}
        />
      </div>
    </div>
  );
}

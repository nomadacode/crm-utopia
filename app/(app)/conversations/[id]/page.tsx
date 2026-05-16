import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ConversationControls } from "./controls";
import { SendMessageForm } from "./send-form";

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
    <div className="grid h-[calc(100vh-4rem)] grid-cols-[1fr_320px] gap-6">
      <Card className="flex flex-col rounded-3xl p-6">
        <header className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-semibold">
              {contact.name ?? contact.phone}
            </h1>
            <p className="text-sm text-muted-foreground">{contact.phone}</p>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto py-6">
          {(messages ?? []).map((m) => (
            <Bubble key={m.id} role={m.role} content={m.content} createdAt={m.created_at} />
          ))}
          {(messages?.length ?? 0) === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Sin mensajes todavía.
            </p>
          )}
        </div>

        <SendMessageForm contactId={contact.id} />
      </Card>

      <div className="space-y-4">
        <Card className="rounded-3xl p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Lead</h3>
          {lead ? (
            <>
              <div className="mt-1 text-2xl font-semibold">
                {lead.score === "hot" && "🔥 Hot"}
                {lead.score === "warm" && "🌤️ Warm"}
                {lead.score === "cold" && "❄️ Cold"}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{lead.reason}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Sin clasificar</p>
          )}
        </Card>

        <ConversationControls
          contactId={contact.id}
          initialBlocked={contact.blocked}
          initialBotEnabled={contact.bot_enabled}
        />
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  createdAt,
}: {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}) {
  const mine = role === "assistant";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-3xl px-4 py-2 ${
          mine
            ? "bg-foreground text-background"
            : "bg-muted text-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm">{content}</div>
        <div className={`mt-1 text-[10px] opacity-60`}>
          {new Date(createdAt).toLocaleString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}

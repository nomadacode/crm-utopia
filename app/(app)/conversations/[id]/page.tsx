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

  const scoreLabels: Record<"hot" | "warm" | "cold", string> = {
    hot: "Hot",
    warm: "Warm",
    cold: "Cold",
  };
  const scoreClasses: Record<"hot" | "warm" | "cold", string> = {
    hot: "bg-accent",
    warm: "bg-amber-400",
    cold: "bg-zinc-300",
  };
  const leadScore = lead?.score as "hot" | "warm" | "cold" | undefined;
  const scoreLabel = leadScore ? scoreLabels[leadScore] : null;
  const scoreClass = leadScore ? scoreClasses[leadScore] : null;

  return (
    <div className="mx-auto grid h-[calc(100vh-4rem)] max-w-6xl grid-cols-[1fr_280px] gap-6">
      <Card className="flex flex-col overflow-hidden rounded-lg p-0">
        <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {(contact.name ?? contact.phone).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {contact.name ?? contact.phone}
            </div>
            <div className="truncate text-xs text-muted-foreground tabular">
              {contact.phone}
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-6">
          {(messages ?? []).map((m) => (
            <Bubble
              key={m.id}
              role={m.role}
              content={m.content}
              createdAt={m.created_at}
            />
          ))}
          {(messages?.length ?? 0) === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Sin mensajes todavía.
            </p>
          )}
        </div>

        <div className="border-t border-border px-5 py-3">
          <SendMessageForm contactId={contact.id} />
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-lg p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Lead
          </div>
          {lead && scoreLabel ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${scoreClass}`}
                />
                <span className="text-base font-medium">{scoreLabel}</span>
              </div>
              <p className="mt-2 text-sm leading-snug text-muted-foreground">
                {lead.reason}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Sin clasificar</p>
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
        className={`max-w-[70%] rounded-md px-3.5 py-2 ${
          mine
            ? "bg-foreground text-background"
            : "bg-muted text-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-snug">
          {content}
        </div>
        <div className="mt-1 text-[10px] tabular opacity-60">
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

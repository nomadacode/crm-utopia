import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  phone: string;
  name: string | null;
  blocked: boolean;
  lastMessage: string | null;
  lastAt: string | null;
  score: "hot" | "warm" | "cold" | null;
};

async function getConversations(): Promise<Row[]> {
  const supabase = supabaseAdmin();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, phone, name, blocked")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!contacts) return [];

  const ids = contacts.map((c) => c.id);

  const [{ data: lastMsgs }, { data: lastLeads }] = await Promise.all([
    supabase
      .from("messages")
      .select("contact_id, content, created_at")
      .in("contact_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("contact_id, score, qualified_at")
      .in("contact_id", ids)
      .order("qualified_at", { ascending: false }),
  ]);

  const lastByContact = new Map<string, { content: string; created_at: string }>();
  for (const m of lastMsgs ?? []) {
    if (!lastByContact.has(m.contact_id))
      lastByContact.set(m.contact_id, {
        content: m.content,
        created_at: m.created_at,
      });
  }
  const scoreByContact = new Map<string, "hot" | "warm" | "cold">();
  for (const l of lastLeads ?? []) {
    if (!scoreByContact.has(l.contact_id))
      scoreByContact.set(l.contact_id, l.score);
  }

  return contacts.map((c) => ({
    id: c.id,
    phone: c.phone,
    name: c.name,
    blocked: c.blocked,
    lastMessage: lastByContact.get(c.id)?.content ?? null,
    lastAt: lastByContact.get(c.id)?.created_at ?? null,
    score: scoreByContact.get(c.id) ?? null,
  }));
}

function scoreBadge(score: Row["score"]) {
  if (score === "hot")
    return (
      <Badge className="rounded-full bg-accent text-accent-foreground">
        🔥 Hot
      </Badge>
    );
  if (score === "warm")
    return <Badge className="rounded-full bg-amber-200 text-amber-900">🌤️ Warm</Badge>;
  if (score === "cold")
    return <Badge className="rounded-full bg-muted text-muted-foreground">❄️ Cold</Badge>;
  return null;
}

export default async function ConversationsPage() {
  const rows = await getConversations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Conversaciones
        </h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "contacto" : "contactos"}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="rounded-3xl p-12 text-center text-muted-foreground">
          Todavía no hay conversaciones. Mandá un &quot;Hola&quot; al WhatsApp
          configurado para arrancar.
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Link key={row.id} href={`/conversations/${row.id}`}>
              <Card className="flex items-center gap-4 rounded-3xl p-4 transition-colors hover:bg-muted/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted font-semibold">
                  {(row.name ?? row.phone).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {row.name ?? row.phone}
                    </span>
                    {row.blocked && (
                      <Badge variant="destructive" className="rounded-full">
                        bloqueado
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {row.lastMessage ?? "—"}
                  </div>
                </div>
                <div>{scoreBadge(row.score)}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

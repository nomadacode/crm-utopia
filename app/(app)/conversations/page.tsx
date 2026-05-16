import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ListRefresher } from "./list-refresher";

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

function ScoreDot({ score }: { score: Row["score"] }) {
  if (!score) return null;
  const cls = {
    hot: "bg-accent",
    warm: "bg-amber-400",
    cold: "bg-zinc-300",
  }[score];
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default async function ConversationsPage() {
  const rows = await getConversations();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <ListRefresher />
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Bandeja
        </p>
        <h1 className="text-3xl font-medium tracking-display">Conversaciones</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "contacto" : "contactos"}
        </p>
      </header>

      {rows.length === 0 ? (
        <Card className="rounded-lg p-12 text-center text-sm text-muted-foreground">
          Sin conversaciones todavía. Mandá un mensaje al WhatsApp configurado.
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-lg p-0">
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/conversations/${row.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {(row.name ?? row.phone).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ScoreDot score={row.score} />
                      <span className="truncate text-sm font-medium">
                        {row.name ?? row.phone}
                      </span>
                      {row.blocked && (
                        <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                          bloq
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {row.lastMessage ?? "—"}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {formatRelative(row.lastAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

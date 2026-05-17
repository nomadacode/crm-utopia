import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type DashboardData = {
  totalContacts: number;
  messagesWeek: number;
  hot: number;
  warm: number;
  cold: number;
  needsHuman: number;
  recentLeads: RecentLead[];
  recentConversations: RecentConv[];
};

type RecentLead = {
  id: string;
  score: "hot" | "warm" | "cold";
  reason: string;
  qualified_at: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string;
};

type RecentConv = {
  contact_id: string;
  name: string | null;
  phone: string;
  last_message: string;
  last_at: string;
};

async function getData(): Promise<DashboardData> {
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    contactsRes,
    messagesRes,
    leadsRes,
    needsHumanRes,
    recentLeadsRes,
    recentMsgsRes,
  ] = await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase.from("leads").select("score").gte("qualified_at", since),
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("needs_human", true),
      supabase
        .from("leads")
        .select(
          "id, score, reason, qualified_at, contact_id, contact:contacts(name, phone)",
        )
        .order("qualified_at", { ascending: false })
        .limit(5),
      supabase
        .from("messages")
        .select(
          "contact_id, content, created_at, contact:contacts(name, phone)",
        )
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const leads = leadsRes.data ?? [];
  type RecentLeadRow = {
    id: string;
    score: "hot" | "warm" | "cold";
    reason: string;
    qualified_at: string;
    contact_id: string;
    contact: { name: string | null; phone: string } | null;
  };
  const recentLeads: RecentLead[] = (
    (recentLeadsRes.data ?? []) as unknown as RecentLeadRow[]
  ).map((l) => ({
    id: l.id,
    score: l.score,
    reason: l.reason,
    qualified_at: l.qualified_at,
    contact_id: l.contact_id,
    contact_name: l.contact?.name ?? null,
    contact_phone: l.contact?.phone ?? "",
  }));

  const seen = new Set<string>();
  type RecentMsgRow = {
    contact_id: string;
    content: string;
    created_at: string;
    contact: { name: string | null; phone: string } | null;
  };
  const recentConversations: RecentConv[] = [];
  for (const m of (recentMsgsRes.data ?? []) as unknown as RecentMsgRow[]) {
    if (seen.has(m.contact_id)) continue;
    seen.add(m.contact_id);
    recentConversations.push({
      contact_id: m.contact_id,
      name: m.contact?.name ?? null,
      phone: m.contact?.phone ?? "",
      last_message: m.content,
      last_at: m.created_at,
    });
    if (recentConversations.length >= 5) break;
  }

  return {
    totalContacts: contactsRes.count ?? 0,
    messagesWeek: messagesRes.count ?? 0,
    hot: leads.filter((l) => l.score === "hot").length,
    warm: leads.filter((l) => l.score === "warm").length,
    cold: leads.filter((l) => l.score === "cold").length,
    needsHuman: needsHumanRes.count ?? 0,
    recentLeads,
    recentConversations,
  };
}

export default async function DashboardPage() {
  const d = await getData();

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Resumen
        </p>
        <h1 className="text-3xl font-medium tracking-display">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Últimos 7 días — métricas y actividad reciente.
        </p>
      </header>

      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-6">
        <Metric label="Contactos" value={d.totalContacts} />
        <Metric label="Mensajes" value={d.messagesWeek} />
        <Metric label="Hot" value={d.hot} dot="hot" />
        <Metric label="Warm" value={d.warm} dot="warm" />
        <Metric label="Cold" value={d.cold} dot="cold" />
        <Link
          href="/conversations?filter=needs_human"
          className="block bg-card px-6 py-5 transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>🆘 Humano</span>
          </div>
          <div className="mt-2 text-3xl font-medium tabular tracking-display">
            {d.needsHuman}
          </div>
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Leads recientes" empty={d.recentLeads.length === 0}>
          <ul className="divide-y divide-border">
            {d.recentLeads.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/conversations/${l.contact_id}`}
                  className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                >
                  <ScoreDot score={l.score} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {l.contact_name ?? l.contact_phone}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular">
                        {formatRelative(l.qualified_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {l.reason}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Conversaciones recientes"
          empty={d.recentConversations.length === 0}
        >
          <ul className="divide-y divide-border">
            {d.recentConversations.map((c) => (
              <li key={c.contact_id}>
                <Link
                  href={`/conversations/${c.contact_id}`}
                  className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                >
                  <Avatar name={c.name ?? c.phone} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {c.name ?? c.phone}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular">
                        {formatRelative(c.last_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {c.last_message}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot?: "hot" | "warm" | "cold";
}) {
  return (
    <div className="bg-card px-6 py-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {dot && <ScoreDot score={dot} size="sm" />}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-3xl font-medium tabular tracking-display">
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <Card className="overflow-hidden rounded-lg p-0">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      {empty ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Sin actividad todavía.
        </p>
      ) : (
        children
      )}
    </Card>
  );
}

function ScoreDot({
  score,
  size = "md",
}: {
  score: "hot" | "warm" | "cold";
  size?: "sm" | "md";
}) {
  const cls = {
    hot: "bg-accent",
    warm: "bg-amber-400",
    cold: "bg-zinc-300",
  }[score];
  const sz = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2 mt-1.5";
  return <span className={`${sz} ${cls} inline-block shrink-0 rounded-full`} />;
}

function Avatar({ name }: { name: string }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
      {initials}
    </div>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

import { Suspense } from "react";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { DashboardRefresher } from "./dashboard-refresher";
import { RecentLeadsList } from "./recent-leads";

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
  responseTimes: ResponseTimeStats;
};

type ResponseTimeStats = {
  bot_count: number;
  bot_median_seconds: number | null;
  bot_p95_seconds: number | null;
  bot_within_5min_pct: number | null;
  human_count: number;
  human_median_seconds: number | null;
  human_p95_seconds: number | null;
  human_within_5min_pct: number | null;
};

export type LeadEntry = {
  id: string;
  score: "hot" | "warm" | "cold";
  reason: string;
  qualified_at: string;
};

export type RecentLead = {
  contact_id: string;
  contact_name: string | null;
  contact_phone: string;
  current: LeadEntry;
  history: LeadEntry[]; // newest first; current is history[0]
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
    responseTimeRes,
  ] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("leads")
      .select("contact_id, score, qualified_at")
      .gte("qualified_at", since)
      .order("qualified_at", { ascending: false }),
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
      .limit(100),
    supabase
      .from("messages")
      .select(
        "contact_id, content, created_at, contact:contacts(name, phone)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.rpc("response_time_metrics", { p_since: since }),
  ]);

  // Dedupe lead classifications by contact: keep only the latest within the
  // window. A single contact can be classified multiple times during a
  // conversation; the dashboard counters track distinct contacts, not events.
  type LeadCountRow = {
    contact_id: string;
    score: "hot" | "warm" | "cold";
    qualified_at: string;
  };
  const latestByContact = new Map<string, "hot" | "warm" | "cold">();
  for (const l of (leadsRes.data ?? []) as LeadCountRow[]) {
    if (!latestByContact.has(l.contact_id)) {
      latestByContact.set(l.contact_id, l.score);
    }
  }
  const latestScores = Array.from(latestByContact.values());

  // Group leads by contact_id. Latest classification per contact = "current";
  // older ones go into history. Show up to 5 unique contacts.
  type RawLeadRow = {
    id: string;
    score: "hot" | "warm" | "cold";
    reason: string;
    qualified_at: string;
    contact_id: string;
    contact: { name: string | null; phone: string } | null;
  };
  const rawRows = (recentLeadsRes.data ?? []) as unknown as RawLeadRow[];
  const groupedByContact = new Map<string, RecentLead>();
  for (const r of rawRows) {
    const entry: LeadEntry = {
      id: r.id,
      score: r.score,
      reason: r.reason,
      qualified_at: r.qualified_at,
    };
    const existing = groupedByContact.get(r.contact_id);
    if (existing) {
      existing.history.push(entry);
    } else {
      groupedByContact.set(r.contact_id, {
        contact_id: r.contact_id,
        contact_name: r.contact?.name ?? null,
        contact_phone: r.contact?.phone ?? "",
        current: entry,
        history: [entry],
      });
    }
  }
  // Take top 5 unique contacts (already ordered by latest qualified_at)
  const recentLeads: RecentLead[] = Array.from(groupedByContact.values()).slice(0, 5);

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

  // The RPC returns a single row; supabase-js wraps it in an array.
  type RawResponseRow = {
    bot_count: number | string | null;
    bot_median_seconds: string | number | null;
    bot_p95_seconds: string | number | null;
    bot_within_5min_pct: string | number | null;
    human_count: number | string | null;
    human_median_seconds: string | number | null;
    human_p95_seconds: string | number | null;
    human_within_5min_pct: string | number | null;
  };
  const rawRt = ((responseTimeRes.data ?? []) as RawResponseRow[])[0];
  // Postgres numeric comes over the wire as a string; coerce.
  const numOrNull = (v: string | number | null | undefined): number | null => {
    if (v == null) return null;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : null;
  };
  const responseTimes: ResponseTimeStats = {
    bot_count: Number(rawRt?.bot_count ?? 0),
    bot_median_seconds: numOrNull(rawRt?.bot_median_seconds),
    bot_p95_seconds: numOrNull(rawRt?.bot_p95_seconds),
    bot_within_5min_pct: numOrNull(rawRt?.bot_within_5min_pct),
    human_count: Number(rawRt?.human_count ?? 0),
    human_median_seconds: numOrNull(rawRt?.human_median_seconds),
    human_p95_seconds: numOrNull(rawRt?.human_p95_seconds),
    human_within_5min_pct: numOrNull(rawRt?.human_within_5min_pct),
  };

  return {
    totalContacts: contactsRes.count ?? 0,
    messagesWeek: messagesRes.count ?? 0,
    hot: latestScores.filter((s) => s === "hot").length,
    warm: latestScores.filter((s) => s === "warm").length,
    cold: latestScores.filter((s) => s === "cold").length,
    needsHuman: needsHumanRes.count ?? 0,
    recentLeads,
    recentConversations,
    responseTimes,
  };
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <DashboardRefresher />
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Resumen
        </p>
        <h1 className="text-3xl font-medium tracking-display">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Últimos 7 días — métricas y actividad reciente.
        </p>
      </header>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const d = await getData();

  return (
    <>
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Contactos" value={d.totalContacts} />
        <Metric label="Mensajes" value={d.messagesWeek} />
        <Metric label="Hot" value={d.hot} dot="hot" />
        <Metric label="Warm" value={d.warm} dot="warm" />
        <Metric label="Cold" value={d.cold} dot="cold" />
        <Link
          href="/conversations?filter=needs_human"
          className="block bg-card px-4 py-4 transition-colors hover:bg-muted/40 sm:px-6 sm:py-5"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>🆘 Humano</span>
          </div>
          <div className="mt-2 text-2xl font-medium tabular tracking-display sm:text-3xl">
            {d.needsHuman}
          </div>
        </Link>
      </section>

      <ResponseTimeSection stats={d.responseTimes} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Leads recientes" empty={d.recentLeads.length === 0}>
          <RecentLeadsList leads={d.recentLeads} />
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
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-10">
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2 bg-card px-4 py-5">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-7 w-12 rounded bg-muted" />
          </div>
        ))}
      </section>
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b border-border px-5 py-3">
          <div className="h-4 w-40 rounded bg-muted" />
        </div>
        <div className="space-y-2 px-5 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 flex-1 rounded bg-muted/70" />
              <div className="h-3 w-12 rounded bg-muted" />
              <div className="h-3 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
          >
            <div className="border-b border-border px-5 py-3">
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
            <ul className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, j) => (
                <li key={j} className="flex items-start gap-3 px-5 py-3">
                  <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 rounded bg-muted" />
                    <div className="h-3 w-52 rounded bg-muted/70" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
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
    <div className="bg-card px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {dot && <ScoreDot score={dot} size="sm" />}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-medium tabular tracking-display sm:text-3xl">
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

function ResponseTimeSection({ stats }: { stats: ResponseTimeStats }) {
  const hasAny = stats.bot_count > 0 || stats.human_count > 0;
  return (
    <Card className="overflow-hidden rounded-lg p-0">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-medium">Tiempo de respuesta</h2>
      </div>
      {!hasAny ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay suficientes respuestas para medir.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2.5 font-medium"></th>
                <th className="px-3 py-2.5 font-medium">UtopIA</th>
                <th className="px-3 py-2.5 font-medium">Humano</th>
              </tr>
            </thead>
            <tbody>
              <ResponseTimeRow
                label="Mediano"
                bot={formatDuration(stats.bot_median_seconds)}
                human={formatDuration(stats.human_median_seconds)}
              />
              <ResponseTimeRow
                label="P95"
                bot={formatDuration(stats.bot_p95_seconds)}
                human={formatDuration(stats.human_p95_seconds)}
              />
              <ResponseTimeRow
                label="Respondidos en <5 min"
                bot={formatPercent(stats.bot_within_5min_pct)}
                human={formatPercent(stats.human_within_5min_pct)}
              />
              <ResponseTimeRow
                label="Total respuestas"
                bot={stats.bot_count.toString()}
                human={stats.human_count.toString()}
              />
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ResponseTimeRow({
  label,
  bot,
  human,
}: {
  label: string;
  bot: string;
  human: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-5 py-3 text-sm text-muted-foreground">{label}</td>
      <td className="px-3 py-3 text-sm font-medium tabular">{bot}</td>
      <td className="px-3 py-3 text-sm font-medium tabular">{human}</td>
    </tr>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const totalMin = Math.floor(seconds / 60);
  const remSec = Math.round(seconds % 60);
  if (totalMin < 60) {
    return remSec > 0 && totalMin < 10 ? `${totalMin}m ${remSec}s` : `${totalMin}m`;
  }
  const totalHr = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  if (totalHr < 24) {
    return remMin > 0 ? `${totalHr}h ${remMin}m` : `${totalHr}h`;
  }
  const totalDay = Math.floor(totalHr / 24);
  const remHr = totalHr % 24;
  return remHr > 0 ? `${totalDay}d ${remHr}h` : `${totalDay}d`;
}

function formatPercent(pct: number | null): string {
  if (pct == null) return "—";
  // Hide the decimal when it's a clean integer (e.g. "100%" vs "100.0%")
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
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

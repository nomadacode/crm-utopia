import { Suspense } from "react";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ChannelIcon } from "@/components/channel-icon";
import { ListRefresher } from "./list-refresher";
import { FilterBar } from "./filter-bar";
import type { Channel, Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

type FilterKey =
  | "unread"
  | "hot"
  | "warm"
  | "cold"
  | "archived"
  | "needs_human"
  | null;

type Row = {
  id: string;
  phone: string;
  name: string | null;
  blocked: boolean;
  last_read_at: string | null;
  archived_at: string | null;
  needs_human: boolean;
  escalated_at: string | null;
  channel: Channel;
  lastMessage: string | null;
  lastAt: string | null;
  lastUserAt: string | null;
  score: "hot" | "warm" | "cold" | null;
  tags: Tag[];
};

const COLOR_CLASSES: Record<string, string> = {
  gray: "bg-zinc-200 text-zinc-700",
  lime: "bg-accent text-accent-foreground",
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  violet: "bg-violet-100 text-violet-800",
  pink: "bg-pink-100 text-pink-800",
  red: "bg-red-100 text-red-800",
  cyan: "bg-cyan-100 text-cyan-800",
};

type ContactSummary = {
  contact_id: string;
  last_message_content: string | null;
  last_message_at: string | null;
  last_user_at: string | null;
  latest_score: "hot" | "warm" | "cold" | null;
  latest_score_reason: string | null;
  latest_qualified_at: string | null;
};

async function getConversations(opts: {
  query?: string;
  filter?: FilterKey;
  tagId?: string;
}): Promise<Row[]> {
  const supabase = supabaseAdmin();

  let q = supabase
    .from("contacts")
    .select(
      "id, phone, name, blocked, last_read_at, archived_at, needs_human, escalated_at, channel",
    )
    .order("needs_human", { ascending: false })
    .order("escalated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (opts.filter === "archived") {
    q = q.not("archived_at", "is", null);
  } else {
    q = q.is("archived_at", null);
  }

  if (opts.query) {
    const term = `%${opts.query}%`;
    q = q.or(`name.ilike.${term},phone.ilike.${term}`);
  }

  const { data: contacts } = await q;
  if (!contacts || contacts.length === 0) return [];

  let ids = contacts.map((c) => c.id);

  // Filter by tag if specified
  if (opts.tagId) {
    const { data: tagged } = await supabase
      .from("contact_tags")
      .select("contact_id")
      .eq("tag_id", opts.tagId)
      .in("contact_id", ids);
    const allowed = new Set((tagged ?? []).map((t) => t.contact_id));
    ids = ids.filter((id) => allowed.has(id));
    if (ids.length === 0) return [];
  }

  const [{ data: summaryRows }, { data: contactTags }] = await Promise.all([
    supabase.rpc("contacts_summary", { p_contact_ids: ids }),
    supabase
      .from("contact_tags")
      .select("contact_id, tag:tags(id, name, color, created_at)")
      .in("contact_id", ids),
  ]);

  const summaryByContact = new Map<string, ContactSummary>();
  for (const row of (summaryRows ?? []) as ContactSummary[]) {
    summaryByContact.set(row.contact_id, row);
  }
  const tagsByContact = new Map<string, Tag[]>();
  type TagJoin = {
    contact_id: string;
    tag: Tag | null;
  };
  for (const row of (contactTags ?? []) as unknown as TagJoin[]) {
    if (!row.tag) continue;
    const arr = tagsByContact.get(row.contact_id) ?? [];
    arr.push(row.tag);
    tagsByContact.set(row.contact_id, arr);
  }

  const allowedIds = new Set(ids);
  let rows: Row[] = contacts
    .filter((c) => allowedIds.has(c.id))
    .map((c) => {
      const summary = summaryByContact.get(c.id);
      return {
        id: c.id,
        phone: c.phone,
        name: c.name,
        blocked: c.blocked,
        last_read_at: c.last_read_at,
        archived_at: c.archived_at,
        needs_human: c.needs_human,
        escalated_at: c.escalated_at,
        channel: (c.channel ?? "whatsapp") as Channel,
        lastMessage: summary?.last_message_content ?? null,
        lastAt: summary?.last_message_at ?? null,
        lastUserAt: summary?.last_user_at ?? null,
        score: summary?.latest_score ?? null,
        tags: tagsByContact.get(c.id) ?? [],
      };
    });

  // Full-text search in messages content
  if (opts.query) {
    const lc = opts.query.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(lc) ||
        r.phone.toLowerCase().includes(lc) ||
        (r.lastMessage ?? "").toLowerCase().includes(lc),
    );
  }

  // Filter by score / unread
  if (opts.filter === "hot" || opts.filter === "warm" || opts.filter === "cold") {
    rows = rows.filter((r) => r.score === opts.filter);
  }
  if (opts.filter === "unread") {
    rows = rows.filter((r) => {
      if (!r.lastUserAt) return false;
      if (!r.last_read_at) return true;
      return new Date(r.lastUserAt) > new Date(r.last_read_at);
    });
  }
  if (opts.filter === "needs_human") {
    rows = rows.filter((r) => r.needs_human);
  }

  return rows;
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

function isUnread(row: Row): boolean {
  if (!row.lastUserAt) return false;
  if (!row.last_read_at) return true;
  return new Date(row.lastUserAt) > new Date(row.last_read_at);
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

type Search = {
  q?: string;
  filter?: string;
  tag?: string;
};

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const filter = (sp.filter ?? null) as FilterKey;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ListRefresher />
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Bandeja
        </p>
        <h1 className="text-3xl font-medium tracking-display">Conversaciones</h1>
      </header>

      <Suspense
        key={`${sp.q ?? ""}|${filter ?? ""}|${sp.tag ?? ""}`}
        fallback={<ConversationsSkeleton />}
      >
        <ConversationsContent
          query={sp.q}
          filter={filter}
          tagId={sp.tag}
        />
      </Suspense>
    </div>
  );
}

async function ConversationsContent({
  query,
  filter,
  tagId,
}: {
  query?: string;
  filter: FilterKey;
  tagId?: string;
}) {
  const sb = supabaseAdmin();
  const [{ data: tags }, rows] = await Promise.all([
    sb.from("tags").select("*").order("name"),
    getConversations({ query, filter, tagId }),
  ]);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? "resultado" : "resultados"}
      </p>
      <FilterBar tags={(tags ?? []) as Tag[]} />

      {rows.length === 0 ? (
        <Card className="rounded-lg p-12 text-center text-sm text-muted-foreground">
          {query || filter || tagId
            ? "Sin resultados para los filtros aplicados."
            : "Sin conversaciones todavía. Mandá un mensaje al WhatsApp configurado."}
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-lg p-0">
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const unread = isUnread(row);
              return (
                <li key={row.id}>
                  <Link
                    href={`/conversations/${row.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="relative">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {(row.name ?? row.phone).slice(0, 2).toUpperCase()}
                      </div>
                      {unread && (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ScoreDot score={row.score} />
                        <ChannelIcon channel={row.channel} size={12} />
                        <span
                          className={`truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}
                        >
                          {row.name ?? row.phone}
                        </span>
                        {row.needs_human && (
                          <span
                            className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800"
                            title="Necesita atención humana"
                          >
                            🆘 humano
                          </span>
                        )}
                        {row.blocked && (
                          <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                            bloq
                          </span>
                        )}
                        {row.tags.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${COLOR_CLASSES[t.color] ?? COLOR_CLASSES.gray}`}
                          >
                            {t.name}
                          </span>
                        ))}
                        {row.tags.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{row.tags.length - 2}
                          </span>
                        )}
                      </div>
                      <div
                        className={`mt-0.5 truncate text-sm ${unread ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {row.lastMessage ?? "—"}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular">
                      {formatRelative(row.lastAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

function ConversationsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="h-9 w-full rounded bg-muted/60" />
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <ul className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 rounded bg-muted" />
                <div className="h-3 w-64 rounded bg-muted/70" />
              </div>
              <div className="h-3 w-10 rounded bg-muted" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

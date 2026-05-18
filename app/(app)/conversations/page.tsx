import { Suspense } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ListRefresher } from "./list-refresher";
import { FilterBar } from "./filter-bar";
import { ConversationList, type ConversationRow } from "./conversation-list";
import { type FilterKey } from "./bulk-action-bar";
import type { Channel, Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

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
}): Promise<ConversationRow[]> {
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
  let rows: ConversationRow[] = contacts
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

  const hasFilters = Boolean(query || filter || tagId);
  const emptyMessage = hasFilters
    ? "Sin resultados para los filtros aplicados."
    : "Sin conversaciones todavía. Mandá un mensaje al WhatsApp configurado.";

  return (
    <>
      <FilterBar tags={(tags ?? []) as Tag[]} />
      <ConversationList
        rows={rows}
        tags={(tags ?? []) as Tag[]}
        filter={filter}
        emptyMessage={emptyMessage}
      />
    </>
  );
}

function ConversationsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
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

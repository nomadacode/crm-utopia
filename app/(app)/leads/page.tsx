import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ChannelIcon } from "@/components/channel-icon";
import { LeadsFilters } from "./filters";
import type { Channel } from "@/lib/types";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  channel: Channel;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  industry: string | null;
  deal_value: number | null;
  stage_id: string | null;
  stage_name: string | null;
  stage_color: string;
  score: "hot" | "warm" | "cold" | null;
  score_reason: string | null;
  qualified_at: string | null;
  needs_human: boolean;
  last_activity_at: string;
};

type Search = {
  q?: string;
  score?: string;
  stage?: string;
};

const SCORE_DOT: Record<"hot" | "warm" | "cold", string> = {
  hot: "bg-accent",
  warm: "bg-amber-400",
  cold: "bg-zinc-300",
};
const SCORE_LABEL: Record<"hot" | "warm" | "cold", string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};
const STAGE_BADGE: Record<string, string> = {
  gray: "bg-zinc-100 text-zinc-700",
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  violet: "bg-violet-100 text-violet-800",
  lime: "bg-accent text-accent-foreground",
  red: "bg-red-100 text-red-800",
};

async function getLeads(opts: Search): Promise<{
  rows: LeadRow[];
  counts: { all: number; hot: number; warm: number; cold: number };
}> {
  const sb = supabaseAdmin();
  // 1) Fetch contacts that have at least one lead classification
  // We do this in two queries because Supabase v1 doesn't easily do this with joins.
  // Step A: contacts (unarchived, unblocked).
  let q = sb
    .from("contacts")
    .select(
      "id, channel, name, phone, email, company, industry, deal_value, stage_id, created_at",
    )
    .is("archived_at", null);
  if (opts.q) {
    const term = `%${opts.q}%`;
    q = q.or(
      `name.ilike.${term},phone.ilike.${term},email.ilike.${term},company.ilike.${term}`,
    );
  }
  const { data: contacts } = await q.order("created_at", { ascending: false }).limit(500);
  if (!contacts || contacts.length === 0) {
    return { rows: [], counts: { all: 0, hot: 0, warm: 0, cold: 0 } };
  }
  const ids = contacts.map((c) => c.id);

  // Step B: latest lead per contact + needs_human + last message timestamp + stages.
  // The summary RPC returns one row per contact computed via DISTINCT ON in
  // Postgres, so we avoid streaming the full message/lead history.
  type ContactSummary = {
    contact_id: string;
    last_message_content: string | null;
    last_message_at: string | null;
    last_user_at: string | null;
    latest_score: "hot" | "warm" | "cold" | null;
    latest_score_reason: string | null;
    latest_qualified_at: string | null;
  };

  const [summaryRes, contactsExtra, stagesRes] = await Promise.all([
    sb.rpc("contacts_summary", { p_contact_ids: ids }),
    sb.from("contacts").select("id, needs_human").in("id", ids),
    sb.from("pipeline_stages").select("id, name, color"),
  ]);

  const summaryByContact = new Map<string, ContactSummary>();
  for (const row of (summaryRes.data ?? []) as ContactSummary[]) {
    summaryByContact.set(row.contact_id, row);
  }
  const needsHumanByContact = new Map<string, boolean>();
  for (const c of contactsExtra.data ?? []) {
    needsHumanByContact.set(c.id, c.needs_human);
  }
  const stageById = new Map<string, { name: string; color: string }>();
  for (const s of stagesRes.data ?? []) {
    stageById.set(s.id, { name: s.name, color: s.color });
  }

  let rows: LeadRow[] = contacts.map((c) => {
    const summary = summaryByContact.get(c.id);
    const stage = c.stage_id ? stageById.get(c.stage_id) : null;
    return {
      id: c.id,
      channel: (c.channel ?? "whatsapp") as Channel,
      name: c.name,
      phone: c.phone,
      email: c.email,
      company: c.company,
      industry: c.industry,
      deal_value: c.deal_value,
      stage_id: c.stage_id,
      stage_name: stage?.name ?? null,
      stage_color: stage?.color ?? "gray",
      score: summary?.latest_score ?? null,
      score_reason: summary?.latest_score_reason ?? null,
      qualified_at: summary?.latest_qualified_at ?? null,
      needs_human: needsHumanByContact.get(c.id) ?? false,
      last_activity_at:
        summary?.last_message_at ?? c.created_at,
    };
  });

  // Filter: by default we show contacts WITH at least one classification.
  // Without that filter the list is just "contacts", which we already have at /conversations.
  rows = rows.filter((r) => r.score !== null);

  const counts = {
    all: rows.length,
    hot: rows.filter((r) => r.score === "hot").length,
    warm: rows.filter((r) => r.score === "warm").length,
    cold: rows.filter((r) => r.score === "cold").length,
  };

  if (opts.score === "hot" || opts.score === "warm" || opts.score === "cold") {
    rows = rows.filter((r) => r.score === opts.score);
  }
  if (opts.stage) {
    rows = rows.filter((r) => r.stage_id === opts.stage);
  }

  // Sort: needs_human first, then by latest activity
  rows.sort((a, b) => {
    if (a.needs_human !== b.needs_human) return a.needs_human ? -1 : 1;
    return b.last_activity_at.localeCompare(a.last_activity_at);
  });

  return { rows, counts };
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const { rows, counts } = await getLeads(sp);
  const sb = supabaseAdmin();
  const { data: stages } = await sb
    .from("pipeline_stages")
    .select("id, name, position")
    .order("position");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Negocio
        </p>
        <h1 className="text-3xl font-medium tracking-display">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {counts.all} {counts.all === 1 ? "lead" : "leads"} clasificados ·{" "}
          🔥 {counts.hot} hot · 🌤️ {counts.warm} warm · ❄️ {counts.cold} cold
        </p>
      </header>

      <LeadsFilters
        counts={counts}
        stages={(stages ?? []).map((s) => ({ id: s.id, name: s.name }))}
      />

      {rows.length === 0 ? (
        <Card className="rounded-lg p-12 text-center text-sm text-muted-foreground">
          {sp.q || sp.score || sp.stage
            ? "Sin leads que coincidan con los filtros."
            : "Todavía no hay leads clasificados. Aparecen acá una vez que UtopIA detecta interés tras 3+ mensajes del cliente."}
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-lg p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Contacto</th>
                  <th className="px-4 py-2.5 font-medium">Score</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Empresa</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Etapa</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Valor</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/conversations/${row.id}`}
                        className="block min-w-0"
                      >
                        <div className="flex items-center gap-1.5">
                          <ChannelIcon channel={row.channel} size={11} />
                          <span className="truncate text-sm font-medium">
                            {row.name ?? row.phone}
                          </span>
                          {row.needs_human && (
                            <span className="rounded-sm bg-amber-100 px-1 text-[9px] font-medium uppercase tracking-wider text-amber-800">
                              🆘
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground tabular">
                          {row.email ?? row.phone}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {row.score && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${SCORE_DOT[row.score]}`}
                          />
                          <span className="text-xs">{SCORE_LABEL[row.score]}</span>
                        </div>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                      <div className="truncate">{row.company ?? "—"}</div>
                      {row.industry && (
                        <div className="truncate text-[11px] text-muted-foreground/80">
                          {row.industry}
                        </div>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {row.stage_name && (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_BADGE[row.stage_color] ?? STAGE_BADGE.gray}`}
                        >
                          {row.stage_name}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-sm tabular lg:table-cell">
                      {row.deal_value
                        ? `$${row.deal_value.toLocaleString("es-AR")}`
                        : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-xs tabular text-muted-foreground sm:table-cell">
                      {new Date(row.last_activity_at).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

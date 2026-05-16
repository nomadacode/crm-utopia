import { supabaseAdmin } from "@/lib/supabase/admin";
import { KanbanBoard } from "./kanban-board";
import type { PipelineStage } from "@/lib/types";

export const dynamic = "force-dynamic";

export type KanbanCard = {
  id: string;
  name: string | null;
  phone: string;
  stage_id: string | null;
  deal_value: number | null;
  industry: string | null;
  score: "hot" | "warm" | "cold" | null;
};

async function getKanbanData() {
  const sb = supabaseAdmin();
  const [{ data: stages }, { data: contacts }] = await Promise.all([
    sb.from("pipeline_stages").select("*").order("position"),
    sb
      .from("contacts")
      .select("id, name, phone, stage_id, deal_value, industry")
      .is("archived_at", null)
      .eq("blocked", false)
      .order("created_at", { ascending: false }),
  ]);

  const ids = (contacts ?? []).map((c) => c.id);
  const { data: leads } =
    ids.length > 0
      ? await sb
          .from("leads")
          .select("contact_id, score, qualified_at")
          .in("contact_id", ids)
          .order("qualified_at", { ascending: false })
      : { data: [] };

  const scoreByContact = new Map<string, "hot" | "warm" | "cold">();
  for (const l of leads ?? []) {
    if (!scoreByContact.has(l.contact_id))
      scoreByContact.set(l.contact_id, l.score);
  }

  const cards: KanbanCard[] = (contacts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    stage_id: c.stage_id,
    deal_value: c.deal_value,
    industry: c.industry,
    score: scoreByContact.get(c.id) ?? null,
  }));

  return {
    stages: (stages ?? []) as PipelineStage[],
    cards,
  };
}

export default async function PipelinePage() {
  const { stages, cards } = await getKanbanData();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Negocio
        </p>
        <h1 className="text-3xl font-medium tracking-display">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          {cards.length} {cards.length === 1 ? "contacto activo" : "contactos activos"} ·
          Arrastrá tarjetas entre etapas para moverlas.
        </p>
      </header>
      <KanbanBoard stages={stages} cards={cards} />
    </div>
  );
}

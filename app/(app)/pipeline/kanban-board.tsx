"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { PipelineStage } from "@/lib/types";
import type { KanbanCard } from "./page";

const STAGE_COLOR: Record<string, string> = {
  gray: "border-zinc-200 bg-zinc-50",
  blue: "border-blue-200 bg-blue-50",
  amber: "border-amber-200 bg-amber-50",
  violet: "border-violet-200 bg-violet-50",
  lime: "border-lime-200 bg-lime-50",
  red: "border-red-200 bg-red-50",
};

const STAGE_DOT: Record<string, string> = {
  gray: "bg-zinc-400",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  lime: "bg-lime-500",
  red: "bg-red-500",
};

const SCORE_DOT: Record<string, string> = {
  hot: "bg-accent",
  warm: "bg-amber-400",
  cold: "bg-zinc-300",
};

export function KanbanBoard({
  stages,
  cards: initialCards,
}: {
  stages: PipelineStage[];
  cards: KanbanCard[];
}) {
  const [cards, setCards] = useState<KanbanCard[]>(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const cardsByStage = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const stage of stages) map.set(stage.id, []);
    const unassigned: KanbanCard[] = [];
    for (const card of cards) {
      if (card.stage_id && map.has(card.stage_id)) {
        map.get(card.stage_id)!.push(card);
      } else {
        unassigned.push(card);
      }
    }
    return { map, unassigned };
  }, [stages, cards]);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const cardId = String(active.id);
    const targetStageId = String(over.id);
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.stage_id === targetStageId) return;

    // Optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, stage_id: targetStageId } : c)),
    );

    try {
      const res = await fetch(`/api/contacts/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: targetStageId }),
      });
      if (!res.ok) throw new Error("revert");
    } catch {
      // Revert
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, stage_id: card.stage_id } : c)),
      );
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageCards = cardsByStage.map.get(stage.id) ?? [];
          return (
            <Column
              key={stage.id}
              stage={stage}
              cards={stageCards}
              activeId={activeId}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeCard && <CardView card={activeCard} dragging />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  cards,
  activeId,
}: {
  stage: PipelineStage;
  cards: KanbanCard[];
  activeId: string | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  const totalValue = cards.reduce((sum, c) => sum + (c.deal_value ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border ${
        STAGE_COLOR[stage.color] ?? STAGE_COLOR.gray
      } ${isOver ? "ring-2 ring-foreground/30" : ""}`}
    >
      <header className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[stage.color] ?? STAGE_DOT.gray}`}
          />
          <span className="text-sm font-medium">{stage.name}</span>
          <span className="text-xs text-muted-foreground tabular">
            {cards.length}
          </span>
        </div>
        {totalValue > 0 && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground tabular">
            ${totalValue.toLocaleString("es-AR")}
          </span>
        )}
      </header>
      <div className="flex-1 space-y-2 p-2 min-h-[200px]">
        {cards.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground/70">
            Vacío
          </p>
        ) : (
          cards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              isDragging={activeId === card.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  card,
  isDragging,
}: {
  card: KanbanCard;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: card.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <CardView card={card} hidden={isDragging} />
    </div>
  );
}

function CardView({
  card,
  dragging,
  hidden,
}: {
  card: KanbanCard;
  dragging?: boolean;
  hidden?: boolean;
}) {
  return (
    <Link
      href={`/conversations/${card.id}`}
      onClick={(e) => dragging && e.preventDefault()}
      className={`block cursor-grab rounded-md border border-border bg-card p-3 transition-shadow ${
        dragging ? "shadow-lg cursor-grabbing" : "hover:shadow-sm"
      } ${hidden ? "opacity-30" : ""}`}
    >
      <div className="flex items-center gap-2">
        {card.score && (
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${SCORE_DOT[card.score]}`}
          />
        )}
        <span className="truncate text-sm font-medium">
          {card.name ?? card.phone}
        </span>
      </div>
      {card.industry && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {card.industry}
        </p>
      )}
      {card.deal_value != null && card.deal_value > 0 && (
        <p className="mt-1.5 text-[11px] font-medium tabular">
          ${card.deal_value.toLocaleString("es-AR")}
        </p>
      )}
    </Link>
  );
}

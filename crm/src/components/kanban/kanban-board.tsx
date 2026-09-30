"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Flame, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDuration } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { useStatusChanger } from "@/components/leads/status-control";
import { CallbackBadge } from "@/components/callbacks/callback-badge";

export interface KanbanStatus {
  id: string;
  name: string;
  color: string;
  kind: string;
  total: number;
}
export interface KanbanCard {
  id: string;
  statusId: string;
  name: string;
  phone: string | null;
  manager: string | null;
  destination: string | null;
  createdAt: string;
  isRepeat: boolean;
  overdueMin: number | null;
  source: string;
  callbackAt: string | null;
}

function Card({ card, dragging }: { card: KanbanCard; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 text-sm shadow-xs",
        card.overdueMin !== null && "border-red-300 bg-red-50",
        dragging && "rotate-2 shadow-lg",
      )}
    >
      <div className="flex items-start gap-1.5">
        <Link href={`/leads/${card.id}`} className="flex-1 font-medium hover:underline" onPointerDown={(e) => e.stopPropagation()}>
          {card.name}
        </Link>
        {card.isRepeat && <Repeat className="size-3.5 text-amber-600" aria-label="Повторное обращение" />}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{prettyPhone(card.phone)}</div>
      {card.destination && <div className="mt-1 text-xs">✈ {card.destination}</div>}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{card.manager ?? "не назначен"}</span>
        <span>{formatDateTime(card.createdAt).slice(0, 10)}</span>
      </div>
      {card.callbackAt && <CallbackBadge at={card.callbackAt} className="mt-1.5 flex w-fit" />}
      {card.overdueMin !== null && (
        <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
          <Flame className="size-3" /> ждёт {formatDuration(card.overdueMin)}
        </div>
      )}
    </div>
  );
}

function DraggableCard({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn("cursor-grab touch-none", isDragging && "opacity-30")}>
      <Card card={card} />
    </div>
  );
}

function Column({ status, cards }: { status: KanbanStatus; cards: KanbanCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100/80">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: status.color }} />
        <span className="flex-1 text-sm font-semibold">{status.name}</span>
        <span className="rounded-full bg-card px-2 text-xs text-muted-foreground">{status.total}</span>
      </div>
      <div ref={setNodeRef} className={cn("flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0", isOver && "rounded-b-xl bg-sky-100/70")}>
        {cards.map((c) => (
          <DraggableCard key={c.id} card={c} />
        ))}
        {status.total > cards.length && <div className="py-1 text-center text-xs text-muted-foreground">и ещё {status.total - cards.length}…</div>}
      </div>
    </div>
  );
}

export function KanbanBoard({
  statuses,
  cards: initial,
  reasons,
  rate,
}: {
  statuses: KanbanStatus[];
  cards: KanbanCard[];
  reasons: { id: string; name: string }[];
  rate: number;
}) {
  const [cards, setCards] = useState(initial);
  const [active, setActive] = useState<KanbanCard | null>(null);
  const { change, dialogs } = useStatusChanger({ reasons, rate });
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // новые данные с сервера после revalidate
  useEffect(() => setCards(initial), [initial]);

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const card = cards.find((c) => c.id === e.active.id);
    const target = statuses.find((s) => s.id === e.over?.id);
    if (!card || !target || card.statusId === target.id) return;
    const prevStatus = card.statusId;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, statusId: target.id, overdueMin: null, callbackAt: target.kind === "CALLBACK" ? c.callbackAt : null } : c)));
    change(card.id, target, (ok) => {
      if (!ok) setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, statusId: prevStatus, overdueMin: card.overdueMin } : c)));
    });
  }

  const counts = new Map<string, number>();
  for (const c of cards) counts.set(c.statusId, (counts.get(c.statusId) ?? 0) + 1);
  const initialCounts = new Map<string, number>();
  for (const c of initial) initialCounts.set(c.statusId, (initialCounts.get(c.statusId) ?? 0) + 1);

  return (
    <>
      <DndContext id={dndId} sensors={sensors} onDragStart={(e) => setActive(cards.find((c) => c.id === e.active.id) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <div className="flex h-[calc(100vh-170px)] gap-3 overflow-x-auto pb-3">
          {statuses.map((s) => (
            <Column
              key={s.id}
              // итог = всего на сервере + разница от локальных перемещений
              status={{ ...s, total: s.total + (counts.get(s.id) ?? 0) - (initialCounts.get(s.id) ?? 0) }}
              cards={cards.filter((c) => c.statusId === s.id)}
            />
          ))}
        </div>
        <DragOverlay>{active ? <Card card={active} dragging /> : null}</DragOverlay>
      </DndContext>
      {dialogs}
    </>
  );
}

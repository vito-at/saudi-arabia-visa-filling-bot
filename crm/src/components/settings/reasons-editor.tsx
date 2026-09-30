"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deleteReasonAction, moveReasonAction, saveReasonAction } from "@/app/(app)/settings/actions";
import { useRun } from "./use-run";

export interface ReasonView {
  id: string;
  name: string;
  isActive: boolean;
  leads: number;
}

function Row({ r, first, last }: { r: ReasonView; first: boolean; last: boolean }) {
  const { pending, run } = useRun();
  const [name, setName] = useState(r.name);
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border bg-card p-2", !r.isActive && "opacity-60")}>
      <div className="flex flex-col">
        <button className="text-muted-foreground disabled:opacity-30 cursor-pointer" disabled={first || pending} onClick={() => run(() => moveReasonAction(r.id, -1))} title="Выше">
          <ArrowUp className="size-3.5" />
        </button>
        <button className="text-muted-foreground disabled:opacity-30 cursor-pointer" disabled={last || pending} onClick={() => run(() => moveReasonAction(r.id, 1))} title="Ниже">
          <ArrowDown className="size-3.5" />
        </button>
      </div>
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
      <span className="w-20 text-right text-xs text-muted-foreground">{r.leads} лидов</span>
      <Button size="sm" disabled={name === r.name || pending} onClick={() => run(() => saveReasonAction({ id: r.id, name, isActive: r.isActive }), "Сохранено")}>
        Сохранить
      </Button>
      <Button size="icon-sm" variant="ghost" title={r.isActive ? "Скрыть из списка" : "Показывать"} onClick={() => run(() => saveReasonAction({ id: r.id, name: r.name, isActive: !r.isActive }))}>
        {r.isActive ? <Eye /> : <EyeOff />}
      </Button>
      <Button size="icon-sm" variant="ghost" title="Удалить" onClick={() => run(() => deleteReasonAction(r.id))}>
        <Trash2 className="text-red-600" />
      </Button>
    </div>
  );
}

export function ReasonsEditor({ reasons }: { reasons: ReasonView[] }) {
  const { pending, run } = useRun();
  const [name, setName] = useState("");
  return (
    <div className="space-y-2">
      {reasons.map((r, i) => (
        <Row key={`${r.id}-${r.name}-${r.isActive}`} r={r} first={i === 0} last={i === reasons.length - 1} />
      ))}
      <div className="flex gap-2 rounded-lg border border-dashed p-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Новая причина отказа" />
        <Button disabled={!name.trim() || pending} onClick={() => run(() => saveReasonAction({ name }), "Добавлено", () => setName(""))}>
          <Plus /> Добавить
        </Button>
      </div>
    </div>
  );
}

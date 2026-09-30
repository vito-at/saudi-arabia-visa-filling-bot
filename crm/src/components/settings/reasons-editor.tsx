"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deleteReasonAction, moveReasonAction, saveReasonAction } from "@/app/(app)/settings/actions";
import { useRun } from "./use-run";
import { useI18n } from "@/i18n/client";

export interface ReasonView {
  id: string;
  name: string;
  isActive: boolean;
  leads: number;
}

function Row({ r, first, last }: { r: ReasonView; first: boolean; last: boolean }) {
  const { pending, run } = useRun();
  const { t } = useI18n();
  const [name, setName] = useState(r.name);
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border bg-card p-2", !r.isActive && "opacity-60")}>
      <div className="flex flex-col">
        <button className="text-muted-foreground disabled:opacity-30 cursor-pointer" disabled={first || pending} onClick={() => run(() => moveReasonAction(r.id, -1))} title={t("editor.up")}>
          <ArrowUp className="size-3.5" />
        </button>
        <button className="text-muted-foreground disabled:opacity-30 cursor-pointer" disabled={last || pending} onClick={() => run(() => moveReasonAction(r.id, 1))} title={t("editor.down")}>
          <ArrowDown className="size-3.5" />
        </button>
      </div>
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
      <span className="w-20 text-right text-xs text-muted-foreground">{t("editor.leadsCount", { n: r.leads })}</span>
      <Button size="sm" disabled={name === r.name || pending} onClick={() => run(() => saveReasonAction({ id: r.id, name, isActive: r.isActive }), t("common.saved"))}>
        {t("common.save")}
      </Button>
      <Button size="icon-sm" variant="ghost" title={r.isActive ? t("editor.hide") : t("editor.show")} onClick={() => run(() => saveReasonAction({ id: r.id, name: r.name, isActive: !r.isActive }))}>
        {r.isActive ? <Eye /> : <EyeOff />}
      </Button>
      <Button size="icon-sm" variant="ghost" title={t("common.delete")} onClick={() => run(() => deleteReasonAction(r.id))}>
        <Trash2 className="text-red-600" />
      </Button>
    </div>
  );
}

export function ReasonsEditor({ reasons }: { reasons: ReasonView[] }) {
  const { pending, run } = useRun();
  const { t } = useI18n();
  const [name, setName] = useState("");
  return (
    <div className="space-y-2">
      {reasons.map((r, i) => (
        <Row key={`${r.id}-${r.name}-${r.isActive}`} r={r} first={i === 0} last={i === reasons.length - 1} />
      ))}
      <div className="flex gap-2 rounded-lg border border-dashed p-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("editor.newReasonPh")} />
        <Button disabled={!name.trim() || pending} onClick={() => run(() => saveReasonAction({ name }), t("editor.added"), () => setName(""))}>
          <Plus /> {t("common.add")}
        </Button>
      </div>
    </div>
  );
}

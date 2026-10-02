"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { SPECIAL_STATUS_KINDS } from "@/lib/constants";
import { statusKindLabel } from "@/i18n/labels";
import { useI18n } from "@/i18n/client";
import { deleteStatusAction, moveStatusAction, saveStatusAction } from "@/app/(app)/settings/actions";
import { useRun } from "./use-run";

type Kind = "NEW" | "IN_PROGRESS" | "CALLBACK" | "WON" | "LOST" | "OTHER";
export interface StatusView {
  id: string;
  name: string;
  color: string;
  kind: Kind;
  isSystem: boolean;
  leads: number;
}

function Row({ s, all, first, last }: { s: StatusView; all: StatusView[]; first: boolean; last: boolean }) {
  const { pending, run } = useRun();
  const { t } = useI18n();
  const [name, setName] = useState(s.name);
  const [color, setColor] = useState(s.color);
  const [kind, setKind] = useState<Kind>(s.kind);
  const dirty = name !== s.name || color !== s.color || kind !== s.kind;
  const [moveTo, setMoveTo] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <div className="flex flex-col">
          <button className="text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer" disabled={first || pending} onClick={() => run(() => moveStatusAction(s.id, -1))} title={t("editor.up")}>
            <ArrowUp className="size-3.5" />
          </button>
          <button className="text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer" disabled={last || pending} onClick={() => run(() => moveStatusAction(s.id, 1))} title={t("editor.down")}>
            <ArrowDown className="size-3.5" />
          </button>
        </div>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 cursor-pointer rounded border bg-card p-1" aria-label={t("editor.color")} />
        <Input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" />
        <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as Kind)} disabled={s.isSystem} className="w-full sm:w-48">
          {(["NEW", "IN_PROGRESS", "CALLBACK", "WON", "LOST", "OTHER"] as Kind[])
            .filter((k) => s.isSystem || !SPECIAL_STATUS_KINDS.includes(k))
            .map((k) => (
              <option key={k} value={k}>
                {statusKindLabel(t, k)}
              </option>
            ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground sm:w-20 sm:text-right">{t("editor.leadsCount", { n: s.leads })}</span>
        <Button size="sm" disabled={!dirty || pending} onClick={() => run(() => saveStatusAction({ id: s.id, name, color, kind }), t("editor.statusSaved"))}>
          {t("common.save")}
        </Button>
        {s.isSystem ? (
          <span title={t("editor.systemStatus")} className="px-2 text-muted-foreground">
            <Lock className="size-4" />
          </span>
        ) : (
          <Button size="icon-sm" variant="ghost" title={t("common.delete")} onClick={() => (s.leads ? setAskDelete(!askDelete) : run(() => deleteStatusAction(s.id, ""), t("editor.statusDeleted")))}>
            <Trash2 className="text-red-600" />
          </Button>
        )}
      </div>
      {askDelete && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm sm:pl-8">
          <span>{t("editor.moveLeads", { n: s.leads })}</span>
          <NativeSelect className="w-full sm:w-60" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            <option value="">{t("editor.chooseStatus")}</option>
            {all
              .filter((o) => o.id !== s.id && o.kind !== "WON" && o.kind !== "LOST")
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </NativeSelect>
          <Button size="sm" variant="destructive" disabled={!moveTo || pending} onClick={() => run(() => deleteStatusAction(s.id, moveTo), t("editor.statusDeleted"))}>
            {t("editor.deleteStatus")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function StatusesEditor({ statuses }: { statuses: StatusView[] }) {
  const { pending, run } = useRun();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0ea5e9");
  return (
    <div className="space-y-2">
      {statuses.map((s, i) => (
        <Row key={`${s.id}-${s.name}-${s.color}-${s.kind}`} s={s} all={statuses} first={i === 0} last={i === statuses.length - 1} />
      ))}
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 cursor-pointer rounded border bg-card p-1" aria-label={t("editor.color")} />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("editor.newStatusPh")} className="min-w-0 flex-1" />
        <Button disabled={!name.trim() || pending} onClick={() => run(() => saveStatusAction({ name, color, kind: "OTHER" }), t("editor.statusAdded"), () => setName(""))}>
          <Plus /> {t("common.add")}
        </Button>
      </div>
      <p className="pt-2 text-xs text-muted-foreground">
        {t("editor.statusesHint")}
      </p>
    </div>
  );
}

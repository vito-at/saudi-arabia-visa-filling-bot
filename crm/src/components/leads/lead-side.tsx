"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { DealDialog } from "@/components/deals/deal-dialog";
import { formatDate, formatMoney, toInputDate } from "@/lib/format";
import { calcProfit } from "@/lib/money";
import { assignManagerAction, takeLeadAction } from "@/app/(app)/leads/actions";
import { deleteDealAction } from "@/app/(app)/deals/actions";

export function ManagerControl({ leadId, managerId, managers }: { leadId: string; managerId: string | null; managers: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <NativeSelect
      value={managerId ?? ""}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          const res = await assignManagerAction([leadId], e.target.value || null);
          if (!res.ok) toast.error(res.error);
          else toast.success("Ответственный изменён");
        })
      }
    >
      <option value="">— Не назначен —</option>
      {managers.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </NativeSelect>
  );
}

export function TakeButton({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await takeLeadAction(leadId);
          if (!res.ok) toast.error(res.error);
          else toast.success("Лид взят в работу");
        })
      }
    >
      Взять в работу
    </Button>
  );
}

export interface DealItem {
  id: string;
  product: string;
  amount: number;
  cost: number;
  currency: "UZS" | "USD";
  paidAt: string;
  manager: string | null;
}

export function DealsPanel({ leadId, deals, rate, canDelete }: { leadId: string; deals: DealItem[]; rate: number; canDelete: boolean }) {
  const [editing, setEditing] = useState<DealItem | "new" | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {deals.map((d) => {
        const profit = calcProfit(d.amount, d.cost);
        return (
          <div key={d.id} className="group rounded-lg border p-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="flex-1 font-medium">{d.product}</div>
              <button className="opacity-0 group-hover:opacity-100 text-muted-foreground cursor-pointer" title="Редактировать" onClick={() => setEditing(d)}>
                <Pencil className="size-3.5" />
              </button>
              {canDelete && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 cursor-pointer"
                  title="Удалить"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Удалить сделку?")) return;
                    start(async () => {
                      const res = await deleteDealAction(d.id);
                      if (!res.ok) toast.error(res.error);
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Продажа</div>
                <div className="font-medium">{formatMoney(d.amount, d.currency)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Себестоимость</div>
                <div>{formatMoney(d.cost, d.currency)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Прибыль</div>
                <div className={profit < 0 ? "font-medium text-red-600" : "font-medium text-emerald-700"}>{formatMoney(profit, d.currency)}</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Оплата {formatDate(d.paidAt)}
              {d.manager && ` · ${d.manager}`}
            </div>
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="w-full" onClick={() => setEditing("new")}>
        <Plus /> Добавить сделку
      </Button>
      {editing && (
        <DealDialog
          open
          onOpenChange={(v) => !v && setEditing(null)}
          leadId={leadId}
          rate={rate}
          deal={
            editing === "new"
              ? undefined
              : { id: editing.id, amount: String(editing.amount), cost: String(editing.cost), currency: editing.currency, paidAt: toInputDate(editing.paidAt), product: editing.product }
          }
        />
      )}
    </div>
  );
}

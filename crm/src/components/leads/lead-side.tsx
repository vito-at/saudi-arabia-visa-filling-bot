"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { DealDialog } from "@/components/deals/deal-dialog";
import { formatDate, formatMoney, toInputDate } from "@/lib/format";
import { calcProfit } from "@/lib/money";
import { assignManagerAction, deleteLeadAction, takeLeadAction } from "@/app/(app)/leads/actions";
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

/** Удаление лида с подтверждением (кнопка показывается только администратору) */
export function DeleteLeadButton({ leadId, name, deals, fromMeta }: { leadId: string; name: string; deals: number; fromMeta: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
        <Trash2 /> Удалить
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Удалить лид?" description={`«${name}» будет удалён без возможности восстановления.`}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Вместе с лидом удалятся комментарии, история и задачи{deals ? `, а также сделки (${deals}) — они пропадут из отчётов` : ""}.</li>
            <li>Если у клиента нет других обращений, клиент тоже будет удалён.</li>
            {fromMeta && <li>Лид из Meta больше не будет загружаться при синхронизации.</li>}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Если это спам или нецелевое обращение, можно не удалять, а перевести в «Отказ» с причиной — тогда он останется в отчёте по рекламе.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteLeadAction(leadId);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(res.data?.clientDeleted ? "Лид и клиент удалены" : "Лид удалён");
                  setOpen(false);
                  router.push("/leads");
                })
              }
            >
              {pending ? "Удаление…" : "Удалить лид"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

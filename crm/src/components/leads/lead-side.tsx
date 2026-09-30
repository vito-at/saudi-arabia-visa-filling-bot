"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { DealDialog } from "@/components/deals/deal-dialog";
import { formatDate, toInputDate } from "@/lib/format";
import { calcProfit } from "@/lib/money";
import { assignManagerAction, deleteLeadAction, takeLeadAction } from "@/app/(app)/leads/actions";
import { deleteDealAction } from "@/app/(app)/deals/actions";
import { useI18n } from "@/i18n/client";

export function ManagerControl({ leadId, managerId, managers }: { leadId: string; managerId: string | null; managers: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <NativeSelect
      value={managerId ?? ""}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          const res = await assignManagerAction([leadId], e.target.value || null);
          if (!res.ok) toast.error(res.error);
          else toast.success(t("lead.ownerChanged"));
        })
      }
    >
      <option value="">{t("common.notAssignedOption")}</option>
      {managers.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </NativeSelect>
  );
}

export function TakeButton({ leadId }: { leadId: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await takeLeadAction(leadId);
          if (!res.ok) toast.error(res.error);
          else toast.success(t("leads.taken"));
        })
      }
    >
      {t("leads.takeInWork")}
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
  const { t, f } = useI18n();
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
              <button className="opacity-0 group-hover:opacity-100 text-muted-foreground cursor-pointer" title={t("common.edit")} onClick={() => setEditing(d)}>
                <Pencil className="size-3.5" />
              </button>
              {canDelete && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 cursor-pointer"
                  title={t("common.delete")}
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(t("deal.deleteConfirm"))) return;
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
                <div className="text-muted-foreground">{t("deal.sale")}</div>
                <div className="font-medium">{f.money(d.amount, d.currency)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("deal.cost")}</div>
                <div>{f.money(d.cost, d.currency)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("deal.profit")}</div>
                <div className={profit < 0 ? "font-medium text-red-600" : "font-medium text-emerald-700"}>{f.money(profit, d.currency)}</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {t("deal.paid", { date: formatDate(d.paidAt) })}
              {d.manager && ` · ${d.manager}`}
            </div>
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="w-full" onClick={() => setEditing("new")}>
        <Plus /> {t("deal.add")}
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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
        <Trash2 /> {t("leadDelete.button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("leadDelete.title")} description={t("leadDelete.description", { name })}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("leadDelete.what")}</li>
            {deals > 0 && <li>{t("leadDelete.deals", { n: deals })}</li>}
            <li>{t("leadDelete.client")}</li>
            {fromMeta && <li>{t("leadDelete.meta")}</li>}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">{t("leadDelete.hint")}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteLeadAction(leadId);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(res.data?.clientDeleted ? t("leadDelete.doneClient") : t("leadDelete.done"));
                  setOpen(false);
                  router.push("/leads");
                })
              }
            >
              {pending ? t("leadDelete.deleting") : t("leadDelete.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

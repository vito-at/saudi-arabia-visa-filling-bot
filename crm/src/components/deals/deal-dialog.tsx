"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { toInputDate } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import { calcProfit, convertCost, convertRevenue } from "@/lib/money";
import { createDealAction, updateDealAction, type DealInput } from "@/app/(app)/deals/actions";
import { useCostRate, useIsAdmin } from "@/components/layout/role-context";

export interface DealDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  /** если задан — после сохранения лид переводится в «Продано» */
  wonStatusId?: string | null;
  /** курс продажи $; себестоимость пересчитывается по курсу покупки $ из контекста */
  rate: number;
  deal?: { id: string } & DealInput;
  onSaved?: () => void;
}

const parse = (s: string) => Number(String(s).replace(/\s/g, "").replace(",", ".")) || 0;

export function DealDialog({ open, onOpenChange, leadId, wonStatusId, rate, deal, onSaved }: DealDialogProps) {
  const [form, setForm] = useState<DealInput>(
    deal ?? { amount: "", cost: "", currency: "USD", paidAt: toInputDate(new Date()), product: "" },
  );
  const { t, f } = useI18n();
  const [pending, start] = useTransition();
  // менеджер указывает только сумму продажи — себестоимость вносит администратор
  const isAdmin = useIsAdmin();
  const costRate = useCostRate() || rate;
  const set = (k: keyof DealInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const profit = calcProfit(parse(form.amount), parse(form.cost));
  const other = form.currency === "USD" ? "UZS" : "USD";
  // прибыль в другой валюте: выручка по минимуму, себестоимость по максимуму
  const profitOther = rate > 0 ? convertRevenue(parse(form.amount), form.currency, other, { sale: rate, cost: costRate }) - convertCost(parse(form.cost), form.currency, other, { sale: rate, cost: costRate }) : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = deal ? await updateDealAction(deal.id, form) : await createDealAction(leadId, form, wonStatusId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(deal ? t("deal.updated") : wonStatusId ? t("deal.savedWon") : t("deal.added"));
      onSaved?.();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={deal ? t("deal.editTitle") : t("deal.title")} description={wonStatusId ? t("deal.wonHint") : undefined}>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("deal.product")} className="sm:col-span-2">
            <Textarea rows={2} value={form.product} onChange={set("product")} placeholder={t("deal.productPh")} required />
          </Field>
          <Field label={t("deal.amount")}>
            <Input value={form.amount} onChange={set("amount")} inputMode="decimal" required />
          </Field>
          {isAdmin && (
            <Field label={t("deal.cost")} hint={t("deal.costHint")}>
              <Input value={form.cost} onChange={set("cost")} inputMode="decimal" />
            </Field>
          )}
          <Field label={t("deal.currency")}>
            <NativeSelect value={form.currency} onChange={set("currency")}>
              <option value="USD">{t("currency.USD")}</option>
              <option value="UZS">{t("currency.UZS")}</option>
            </NativeSelect>
          </Field>
          <Field label={t("deal.paidAt")}>
            <Input type="date" value={form.paidAt} onChange={set("paidAt")} required />
          </Field>
          {!isAdmin && <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground sm:col-span-2">{t("deal.costByAdmin")}</p>}
          {isAdmin && (
          <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("deal.profit")}</span>
              <b className={profit < 0 ? "text-red-600" : "text-emerald-700"}>{f.money(profit, form.currency)}</b>
            </div>
            {rate > 0 && (
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{t("deal.inOther", { cur: other })}</span>
                <span>{f.money(profitOther, other)}</span>
              </div>
            )}
          </div>
          )}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

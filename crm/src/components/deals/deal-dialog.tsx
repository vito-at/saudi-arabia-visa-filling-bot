"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { formatMoney, toInputDate } from "@/lib/format";
import { calcProfit, convert } from "@/lib/money";
import { createDealAction, updateDealAction, type DealInput } from "@/app/(app)/deals/actions";

export interface DealDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  /** если задан — после сохранения лид переводится в «Продано» */
  wonStatusId?: string | null;
  rate: number;
  deal?: { id: string } & DealInput;
  onSaved?: () => void;
}

const parse = (s: string) => Number(String(s).replace(/\s/g, "").replace(",", ".")) || 0;

export function DealDialog({ open, onOpenChange, leadId, wonStatusId, rate, deal, onSaved }: DealDialogProps) {
  const [form, setForm] = useState<DealInput>(
    deal ?? { amount: "", cost: "", currency: "USD", paidAt: toInputDate(new Date()), product: "" },
  );
  const [pending, start] = useTransition();
  const set = (k: keyof DealInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const profit = calcProfit(parse(form.amount), parse(form.cost));
  const other = form.currency === "USD" ? "UZS" : "USD";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = deal ? await updateDealAction(deal.id, form) : await createDealAction(leadId, form, wonStatusId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(deal ? "Сделка обновлена" : wonStatusId ? "Сделка сохранена, лид — «Продано»" : "Сделка добавлена");
      onSaved?.();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={deal ? "Редактирование сделки" : "Сделка"} description={wonStatusId ? "Заполните сделку, чтобы перевести лид в «Продано»" : undefined}>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <Field label="Продукт *" className="col-span-2">
            <Textarea rows={2} value={form.product} onChange={set("product")} placeholder="Тур в Дубай, 7 ночей, 2 взрослых" required />
          </Field>
          <Field label="Сумма продажи *">
            <Input value={form.amount} onChange={set("amount")} inputMode="decimal" required />
          </Field>
          <Field label="Себестоимость" hint="Оплата поставщику / туроператору">
            <Input value={form.cost} onChange={set("cost")} inputMode="decimal" />
          </Field>
          <Field label="Валюта">
            <NativeSelect value={form.currency} onChange={set("currency")}>
              <option value="USD">USD ($)</option>
              <option value="UZS">UZS (сум)</option>
            </NativeSelect>
          </Field>
          <Field label="Дата оплаты *">
            <Input type="date" value={form.paidAt} onChange={set("paidAt")} required />
          </Field>
          <div className="col-span-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Прибыль</span>
              <b className={profit < 0 ? "text-red-600" : "text-emerald-700"}>{formatMoney(profit, form.currency)}</b>
            </div>
            {rate > 0 && (
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>В {other} по текущему курсу</span>
                <span>{formatMoney(convert(profit, form.currency, other, rate), other)}</span>
              </div>
            )}
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

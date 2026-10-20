"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { savePlanAction } from "@/app/(app)/reports/actions";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export interface PlanRowView {
  userId: string;
  name: string;
  plan: { leads: number | null; sales: number | null; profit: number | null };
  fact: { leads: number; sales: number; profitUsd: number; profitSalary: number; revenueUsd: number; revenueSalary: number };
  done: { leads: number | null; sales: number | null; profit: number | null };
  planMet: boolean;
  ratePct: number;
  commission: number;
  base: number;
  total: number;
  currency: "UZS" | "USD";
  terms: { base: number; currency: "UZS" | "USD"; pct: number; bonusPct: number; from: "REVENUE" | "PROFIT" };
}

/** Факт / план с полоской выполнения: зелёная — план выполнен, оранжевая — нет */
function Progress({ fact, plan, done, money }: { fact: number; plan: number | null; done: number | null; money?: boolean }) {
  const { f } = useI18n();
  const show = (n: number) => (money ? f.money(n, "USD") : formatNumber(n));
  return (
    <div className="min-w-28">
      <div className="whitespace-nowrap tabular-nums">
        <b>{show(fact)}</b>
        {plan !== null && <span className="text-muted-foreground"> / {show(plan)}</span>}
      </div>
      {done !== null && (
        <div className="mt-1 flex items-center gap-1.5">
          <div className="h-1.5 w-16 rounded-full bg-muted">
            <div className={cn("h-1.5 rounded-full", done >= 1 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${Math.min(100, done * 100)}%` }} />
          </div>
          <span className={cn("text-[11px] tabular-nums", done >= 1 ? "text-emerald-700" : "text-muted-foreground")}>{formatPercent(done, 0)}</span>
        </div>
      )}
    </div>
  );
}

function EditDialog({ row, month, onClose }: { row: PlanRowView; month: string; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const s = (v: number | null) => (v === null ? "" : String(v));
  const [v, setV] = useState({
    leads: s(row.plan.leads),
    sales: s(row.plan.sales),
    profit: s(row.plan.profit),
    salaryBase: String(row.terms.base),
    salaryCurrency: row.terms.currency,
    commissionPct: String(row.terms.pct),
    planBonusPct: String(row.terms.bonusPct),
    commissionFrom: row.terms.from,
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await savePlanAction({ userId: row.userId, month, ...v });
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("common.saved"));
      onClose();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("plans.editTitle", { name: row.name })}>
        <form onSubmit={save} className="space-y-4">
          <div className="text-sm font-semibold">{t("plans.planFor", { month })}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("plans.leads")}>
              <Input type="number" min={0} value={v.leads} onChange={set("leads")} />
            </Field>
            <Field label={t("plans.sales")}>
              <Input type="number" min={0} value={v.sales} onChange={set("sales")} />
            </Field>
            <Field label={t("plans.profitUsd")}>
              <Input inputMode="decimal" value={v.profit} onChange={set("profit")} />
            </Field>
          </div>
          <div className="text-sm font-semibold">{t("plans.salaryTerms")}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={t("plans.base")}>
              <Input inputMode="decimal" value={v.salaryBase} onChange={set("salaryBase")} />
            </Field>
            <Field label={t("deal.currency")}>
              <NativeSelect value={v.salaryCurrency} onChange={set("salaryCurrency")}>
                <option value="UZS">{t("currency.UZS")}</option>
                <option value="USD">{t("currency.USD")}</option>
              </NativeSelect>
            </Field>
            <Field label={t("plans.pct")}>
              <Input inputMode="decimal" value={v.commissionPct} onChange={set("commissionPct")} />
            </Field>
            <Field label={t("plans.from")}>
              <NativeSelect value={v.commissionFrom} onChange={set("commissionFrom")}>
                <option value="REVENUE">{t("plans.fromRevenue")}</option>
                <option value="PROFIT">{t("plans.fromProfit")}</option>
              </NativeSelect>
            </Field>
            <Field label={t("plans.bonusPct")}>
              <Input inputMode="decimal" value={v.planBonusPct} onChange={set("planBonusPct")} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">{t("plans.termsHint")}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
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

export function PlansTable({ rows, month, editable }: { rows: PlanRowView[]; month: string; editable: boolean }) {
  const { t, f } = useI18n();
  const [edit, setEdit] = useState<PlanRowView | null>(null);
  if (!rows.length) return <div className="p-5 text-sm text-muted-foreground">{t("plans.empty")}</div>;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t("rt.managers.manager")}</th>
              <th className="px-3 py-2 font-medium">{t("plans.leads")}</th>
              <th className="px-3 py-2 font-medium">{t("plans.sales")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("plans.revenueUsd")}</th>
              <th className="px-3 py-2 font-medium">{t("plans.profitUsd")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("plans.rate")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("plans.commission")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("plans.base")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("plans.total")}</th>
              {editable && <th />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-3 py-3">
                  <Progress fact={r.fact.leads} plan={r.plan.leads} done={r.done.leads} />
                </td>
                <td className="px-3 py-3">
                  <Progress fact={r.fact.sales} plan={r.plan.sales} done={r.done.sales} />
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{f.money(r.fact.revenueUsd, "USD")}</td>
                <td className="px-3 py-3">
                  <Progress fact={r.fact.profitUsd} plan={r.plan.profit} done={r.done.profit} money />
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatNumber(r.ratePct, 1)}%
                  <div className="text-[11px] text-muted-foreground">{r.terms.from === "PROFIT" ? t("plans.ofProfit") : t("plans.ofRevenue")}</div>
                  {r.planMet && r.terms.bonusPct > 0 && <div className="text-[11px] text-emerald-700">{t("plans.bonusOn")}</div>}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{f.money(r.commission, r.currency)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-muted-foreground">{f.money(r.base, r.currency)}</td>
                <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{f.money(r.total, r.currency)}</td>
                {editable && (
                  <td className="pr-3">
                    <Button size="icon-sm" variant="ghost" title={t("common.edit")} onClick={() => setEdit(r)}>
                      <Pencil />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <EditDialog row={edit} month={month} onClose={() => setEdit(null)} />}
    </>
  );
}

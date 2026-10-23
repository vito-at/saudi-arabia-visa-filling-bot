"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { HandCoins, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { addSalaryPayoutAction, deleteSalaryPayoutAction, savePlanAction } from "@/app/(app)/reports/actions";
import { formatDate, formatNumber, formatPercent, toInputDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export interface PlanRowView {
  userId: string;
  name: string;
  isActive?: boolean;
  plan: { leads: number | null; sales: number | null; profit: number | null };
  fact: { leads: number; sales: number; profitUsd: number; profitSalary: number; revenueUsd: number; revenueSalary: number; flightProfitSalary: number; flightCommission: number; pendingCost?: number };
  done: { leads: number | null; sales: number | null; profit: number | null };
  planMet: boolean;
  ratePct: number;
  commission: number;
  base: number;
  total: number;
  currency: "UZS" | "USD";
  terms: { base: number; currency: "UZS" | "USD"; pct: number; bonusPct: number; from: "REVENUE" | "PROFIT" };
  termsSince: string | null;
  tracked: boolean;
  countedFrom: string | null;
  paid: number;
  left: number;
  payouts: { id: string; amount: number; currency?: "UZS" | "USD"; paidAt: string; note: string | null }[];
}

/** Выплаты зарплаты за месяц: список и новая выплата (по умолчанию — весь остаток) */
function PayDialog({ row, month, onClose }: { row: PlanRowView; month: string; onClose: () => void }) {
  const { t, f } = useI18n();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ amount: row.left > 0 ? String(row.left) : "", paidAt: toInputDate(new Date()), note: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await addSalaryPayoutAction({ userId: row.userId, month, currency: row.currency, ...v });
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("plans.payoutSaved"));
      onClose();
    });
  }
  const remove = (id: string) =>
    start(async () => {
      if (!confirm(t("plans.payoutDeleteConfirm"))) return;
      const res = await deleteSalaryPayoutAction(id);
      if (!res.ok) return void toast.error(res.error);
      onClose();
    });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("plans.payTitle", { name: row.name, month })}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-xs text-muted-foreground">{t("plans.total")}</div>
              <div className="font-semibold tabular-nums">{f.money(row.total, row.currency)}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-xs text-muted-foreground">{t("plans.paid")}</div>
              <div className="font-semibold tabular-nums">{f.money(row.paid, row.currency)}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-xs text-muted-foreground">{t("plans.left")}</div>
              <div className={cn("font-semibold tabular-nums", row.left > 0 ? "text-amber-600" : "text-emerald-600")}>{f.money(row.left, row.currency)}</div>
            </div>
          </div>
          {row.payouts.length > 0 && (
            <ul className="divide-y rounded-lg border text-sm">
              {row.payouts.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-24 text-muted-foreground">{formatDate(p.paidAt)}</span>
                  <span className="font-medium tabular-nums">{f.money(p.amount, p.currency ?? row.currency)}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.note}</span>
                  <Button size="icon-sm" variant="ghost" title={t("common.delete")} disabled={pending} onClick={() => remove(p.id)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("plans.payoutAmount", { currency: t(`currency.${row.currency}`) })}>
                <Input inputMode="decimal" value={v.amount} onChange={set("amount")} required />
              </Field>
              <Field label={t("plans.payoutDate")}>
                <Input type="date" value={v.paidAt} onChange={set("paidAt")} />
              </Field>
            </div>
            <Field label={t("plans.payoutNote")}>
              <Input value={v.note} onChange={set("note")} maxLength={300} placeholder={t("plans.payoutNotePh")} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {t("plans.payoutAdd")}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
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
          <div>
            <div className="text-sm font-semibold">{t("plans.salaryTerms", { month })}</div>
            <div className="text-xs text-muted-foreground">{row.termsSince ? t("plans.termsSince", { month: row.termsSince }) : t("plans.termsAlways")}</div>
          </div>
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
  const [pay, setPay] = useState<PlanRowView | null>(null);
  if (!rows.length) return <div className="p-5 text-sm text-muted-foreground">{t("plans.empty")}</div>;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
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
              <th className="px-3 py-2 text-right font-medium">{t("plans.total")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("plans.paid")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("plans.left")}</th>
              {editable && <th />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className="px-4 py-3 font-medium">
                  {r.name}
                  {r.isActive === false && <div className="text-[11px] font-normal text-muted-foreground">{t("plans.inactive")}</div>}
                </td>
                <td className="px-3 py-3">
                  <Progress fact={r.fact.leads} plan={r.plan.leads} done={r.done.leads} />
                </td>
                <td className="px-3 py-3">
                  <Progress fact={r.fact.sales} plan={r.plan.sales} done={r.done.sales} />
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{f.money(r.fact.revenueUsd, "USD")}</td>
                <td className="px-3 py-3">
                  <Progress fact={r.fact.profitUsd} plan={r.plan.profit} done={r.done.profit} money />
                  {!!r.fact.pendingCost && <div className="mt-1 text-[11px] text-amber-600">{t("plans.pendingCost", { n: r.fact.pendingCost })}</div>}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatNumber(r.ratePct, 1)}%
                  <div className="text-[11px] text-muted-foreground">{r.terms.from === "PROFIT" ? t("plans.ofProfit") : t("plans.ofRevenue")}</div>
                  {r.planMet && r.terms.bonusPct > 0 && <div className="text-[11px] text-emerald-700">{t("plans.bonusOn")}</div>}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                  {f.money(r.commission, r.currency)}
                  {r.fact.flightCommission !== 0 && <div className="text-[11px] text-muted-foreground">{t("plans.flightPart", { sum: f.money(r.fact.flightCommission, r.currency) })}</div>}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-muted-foreground">{f.money(r.base, r.currency)}</td>
                <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                  {r.tracked ? f.money(r.total, r.currency) : <span className="text-xs font-normal text-muted-foreground">{t("plans.notTracked")}</span>}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-muted-foreground">{r.tracked || r.paid ? f.money(r.paid, r.currency) : "—"}</td>
                <td className={cn("px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums", r.left > 0 ? "text-amber-600" : r.left < 0 ? "text-red-600" : "text-emerald-600")}>
                  {r.tracked || r.paid ? f.money(r.left, r.currency) : "—"}
                </td>
                {editable && (
                  <td className="pr-3 whitespace-nowrap">
                    {r.tracked && (
                      <Button size="icon-sm" variant="ghost" title={t("plans.pay")} onClick={() => setPay(r)}>
                        <HandCoins />
                      </Button>
                    )}
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
      {pay && <PayDialog row={pay} month={month} onClose={() => setPay(null)} />}
    </>
  );
}

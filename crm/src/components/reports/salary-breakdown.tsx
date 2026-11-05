"use client";

import Link from "next/link";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { PlanRowView } from "@/components/reports/plans-table";

export interface SalaryLineView {
  dealId: string;
  leadId: string;
  leadName: string;
  paidAt: string;
  product: string;
  quantity: number;
  kind: "PCT" | "RULE" | "BONUS" | "FLIGHT";
  amount: number;
  currency: "UZS" | "USD";
  base: number | null;
  from: "REVENUE" | "PROFIT" | null;
  pct: number | null;
  team: number | null;
  unit: { amount: number; currency: "UZS" | "USD" } | null;
  earned: number;
}

const KINDS = ["PCT", "RULE", "BONUS", "FLIGHT"] as const;

/** Как сложилась зарплата за месяц: оклад, начисления по каждой сделке, выплаты и остаток */
export function SalaryBreakdown({ row, monthName, onClose }: { row: PlanRowView; monthName: string; onClose: () => void }) {
  const { t, f } = useI18n();
  const cur = row.currency;
  const lines = row.lines ?? [];
  const sum = (k: (typeof KINDS)[number]) => lines.filter((l) => l.kind === k);
  const fact = row.fact;
  // обычный процент — то, что осталось от комиссии без авиабилетов, особых процентов и фиксированной оплаты (как в расчёте)
  const pctTotal = row.commission - Math.max(0, fact.flightCommission) - Math.max(0, fact.ruleCommission ?? 0) - Math.max(0, fact.bonusSalary ?? 0);
  const totals: Record<(typeof KINDS)[number], number> = { PCT: pctTotal, RULE: fact.ruleCommission ?? 0, BONUS: fact.bonusSalary ?? 0, FLIGHT: fact.flightCommission };
  const fromText = (from: "REVENUE" | "PROFIT" | null) => (from === "PROFIT" ? t("plans.ofProfit") : t("plans.ofRevenue"));
  const periodTo = row.period ? formatDate(new Date(new Date(row.period.to).getTime() - 1)) : null;

  /** как посчитано начисление за сделку */
  function how(l: SalaryLineView) {
    if (l.kind === "BONUS") return l.unit ? `${l.quantity} × ${f.money(l.unit.amount, l.unit.currency)}` : "";
    if (l.base === null) return t("plans.bdNoCost");
    const base = `${f.money(l.base, cur)} ${l.kind === "FLIGHT" ? t("plans.bdProfit") : fromText(l.from)}`;
    if (l.kind === "FLIGHT") return `${base} × ${formatNumber(l.pct ?? 0, 2)}% (${t("plans.bdTeam", { n: l.team ?? 1 })})`;
    return `${base} × ${formatNumber(l.pct ?? 0, 2)}%`;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl"
        title={t("plans.bdTitle", { name: row.name, month: monthName })}
        description={row.period ? t("plans.bdPeriod", { from: formatDate(row.period.from), to: periodTo ?? "" }) : undefined}
      >
        {!row.tracked ? (
          <p className="text-sm text-muted-foreground">{t("plans.bdNotTracked")}</p>
        ) : (
          <div className="space-y-5 text-sm">
            <dl className="divide-y rounded-lg border">
              <Item label={t("plans.base")} value={f.money(row.base, cur)} />
              {KINDS.map((k) => {
                const list = sum(k);
                if (!list.length && !totals[k]) return null;
                const label =
                  k === "PCT"
                    ? `${t("plans.bdPct", { pct: formatNumber(row.ratePct, 2) })} ${fromText(row.terms.from)}${row.planMet && row.terms.bonusPct > 0 ? ` (${t("plans.bdWithBonus", { pct: formatNumber(row.terms.bonusPct, 2) })})` : ""}`
                    : t(`plans.bdKind.${k}`);
                return <Item key={k} label={`${label} · ${t("plans.bdDeals", { n: list.length })}`} value={`+ ${f.money(totals[k], cur)}`} />;
              })}
              <Item label={t("plans.total")} value={f.money(row.total, cur)} strong />
              <Item label={t("plans.paid")} value={`− ${f.money(row.paid, cur)}`} />
              <Item label={t("plans.left")} value={f.money(row.left, cur)} strong className={row.left > 0 ? "text-amber-600" : row.left < 0 ? "text-red-600" : "text-emerald-600"} />
            </dl>

            {row.plan.profit !== null && row.terms.bonusPct > 0 && (
              <p className={cn("text-xs", row.planMet ? "text-emerald-700" : "text-muted-foreground")}>
                {row.planMet
                  ? t("plans.bdPlanMet", { fact: f.money(fact.profitUsd, "USD"), plan: f.money(row.plan.profit, "USD"), pct: formatNumber(row.terms.bonusPct, 2) })
                  : t("plans.bdPlanNotMet", { fact: f.money(fact.profitUsd, "USD"), plan: f.money(row.plan.profit, "USD"), pct: formatNumber(row.terms.bonusPct, 2) })}
              </p>
            )}

            {KINDS.map((k) => {
              const list = sum(k);
              if (!list.length) return null;
              return (
                <section key={k} className="space-y-2">
                  <h3 className="font-semibold">{k === "PCT" ? t("plans.bdKind.PCT") : t(`plans.bdKind.${k}`)}</h3>
                  <ul className="divide-y rounded-lg border">
                    {list.map((l) => (
                      <li key={l.dealId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2">
                        <div className="min-w-0">
                          <div>
                            <span className="text-muted-foreground tabular-nums">{formatDate(l.paidAt)}</span>{" "}
                            <Link href={`/leads/${l.leadId}`} className="font-medium text-primary hover:underline">
                              {l.leadName}
                            </Link>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {l.product}
                            {l.quantity > 1 ? ` · ${l.quantity}` : ""} · {f.money(l.amount, l.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">{how(l)}</div>
                        </div>
                        <div className={cn("font-semibold whitespace-nowrap tabular-nums", l.earned < 0 && "text-red-600")}>{f.money(l.earned, cur)}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {!lines.length && <p className="text-muted-foreground">{t("plans.bdNoDeals")}</p>}

            {row.payouts.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-semibold">{t("plans.bdPayouts")}</h3>
                <ul className="divide-y rounded-lg border">
                  {row.payouts.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
                      <span>
                        <span className="tabular-nums">{formatDate(p.paidAt)}</span>
                        {p.note ? <span className="text-muted-foreground"> · {p.note}</span> : null}
                      </span>
                      <span className="font-medium whitespace-nowrap tabular-nums">{f.money(p.amount, p.currency ?? cur)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="text-xs text-muted-foreground">{t("plans.bdNote")}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Item({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className={cn("text-muted-foreground", strong && "font-medium text-foreground")}>{label}</dt>
      <dd className={cn("whitespace-nowrap tabular-nums", strong && "font-semibold", className)}>{value}</dd>
    </div>
  );
}

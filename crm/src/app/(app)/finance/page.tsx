import Link from "next/link";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ReportFilters } from "@/components/reports/report-filters";
import { FinanceLeads } from "@/components/finance/finance-leads";
import { ExpensesPanel } from "@/components/finance/expenses-panel";
import { PendingCosts } from "@/components/finance/pending-costs";
import { formatDate, formatNumber } from "@/lib/format";
import { getManagers } from "@/lib/refs";
import { readFilters } from "@/lib/reports/data";
import { expenseCategories, expensesByCategory, financeSummary, loadAdSpendTotal, loadExpenses, loadFinanceLeads, loadPendingDeals } from "@/lib/finance";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { formatters } from "@/i18n/core";

type Tab = "leads" | "expenses";

/** «Финансы» — только для администратора: прибыль по каждому лиду, расходы компании и чистая прибыль */
export default async function FinancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAdmin();
  const tab: Tab = sp(params, "tab") === "expenses" ? "expenses" : "leads";
  const f = await readFilters(params, user);
  const { t } = f;
  const fm = formatters(f.locale);
  const money = (n: number) => fm.money(n, f.currency);

  const [leads, adSpend, expenses, categories, managers, pendingDeals] = await Promise.all([loadFinanceLeads(f), loadAdSpendTotal(f), loadExpenses(f), expenseCategories(), getManagers(), loadPendingDeals()]);
  const pendingInPeriod = leads.reduce((s, l) => s + l.deals.filter((d) => !d.costConfirmed).length, 0);
  // итоги считаем по всем сделкам периода; при фильтре по менеджеру реклама и расходы компании не вычитаются
  const byManager = !!f.managerId;
  const sumOf = (draw: boolean) => expenses.filter((e) => e.ownerDraw === draw).reduce((s, e) => s + e.converted, 0);
  const summary = financeSummary(leads, byManager ? null : adSpend, byManager ? 0 : sumOf(false), byManager ? 0 : sumOf(true));

  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "tab") keep.set(k, v);
  const tabHref = (tb: Tab) => `/finance?tab=${tb}${keep.size ? `&${keep.toString()}` : ""}`;

  const tiles: {
    label: string;
    value: string;
    tone?: "pos" | "neg" | "muted";
    hint?: string;
  }[] = [
    { label: t("finance.revenue"), value: money(summary.revenue) },
    { label: t("finance.cost"), value: money(summary.cost), tone: "muted" },
    {
      label: t("finance.grossProfit"),
      value: money(summary.grossProfit),
      tone: summary.grossProfit < 0 ? "neg" : "pos",
    },
    {
      label: t("finance.adSpend"),
      value: byManager || summary.adSpend === null ? "—" : `− ${money(summary.adSpend)}`,
      tone: "muted",
      hint: summary.adSpend === null && !byManager ? t("finance.adSpendOff") : undefined,
    },
    {
      label: t("finance.expenses"),
      value: byManager ? "—" : `− ${money(summary.expenses)}`,
      tone: "muted",
    },
    {
      label: t("finance.netProfit"),
      value: byManager ? "—" : money(summary.netProfit),
      tone: summary.netProfit < 0 ? "neg" : "pos",
      hint: t("finance.netHint"),
    },
    {
      label: t("finance.ownerDraws"),
      value: byManager ? "—" : `− ${money(summary.ownerDraws)}`,
      tone: "muted",
      hint: t("finance.ownerDrawsHint"),
    },
    {
      label: t("finance.retained"),
      value: byManager ? "—" : money(summary.retained),
      tone: summary.retained < 0 ? "neg" : "pos",
      hint: t("finance.retainedHint"),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("finance.title")}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <span className="inline-flex items-center gap-1 text-primary">
              <Lock className="size-3.5" /> {t("finance.adminOnly")}
            </span>
            <span>
              {t("finance.subtitle", {
                from: formatDate(f.period.from),
                to: formatDate(new Date(f.period.to.getTime() - 1)),
                cur: f.currency,
                rate: formatNumber(f.rate, 2),
                costRate: formatNumber(f.costRate, 2),
                sum: fm.sum,
              })}
            </span>
          </span>
        }
      />
      <PendingCosts deals={pendingDeals} />
      <div className="no-scrollbar -mx-3 mb-4 flex gap-1 overflow-x-auto whitespace-nowrap border-b px-3 sm:mx-0 sm:px-0">
        {(["leads", "expenses"] as Tab[]).map((tb) => (
          <Link
            key={tb}
            href={tabHref(tb)}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === tb ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t(tb === "leads" ? "finance.tabLeads" : "finance.tabExpenses")}
          </Link>
        ))}
      </div>
      <div className="mb-5">
        <Suspense>
          <ReportFilters managers={tab === "leads" ? managers.map((m) => ({ id: m.id, name: m.name })) : null} />
        </Suspense>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tl) => (
          <Card key={tl.label} className="p-4" title={tl.hint}>
            <div className="text-xs font-medium text-muted-foreground">{tl.label}</div>
            <div
              className={cn(
                "mt-1.5 whitespace-nowrap text-lg font-semibold tracking-tight tabular-nums lg:text-xl",
                tl.tone === "pos" && "text-emerald-700",
                tl.tone === "neg" && "text-red-600",
                tl.tone === "muted" && "text-muted-foreground",
              )}
            >
              {tl.value}
            </div>
            {tl.hint && <div className="mt-1 text-[11px] leading-tight text-muted-foreground">{tl.hint}</div>}
          </Card>
        ))}
      </div>

      {pendingInPeriod > 0 && <p className="-mt-2 mb-4 text-xs font-medium text-amber-700">{t("finance.pendingWarn", { n: pendingInPeriod })}</p>}
      {tab === "leads" ? (
        <Card>
          <div className="border-b px-4 py-3 text-xs text-muted-foreground">{t("finance.leadsCount", { n: summary.leads, d: summary.deals })}</div>
          <FinanceLeads leads={leads} currency={f.currency} rate={f.rate} />
        </Card>
      ) : (
        <ExpensesPanel rows={expenses} byCategory={expensesByCategory(expenses)} categories={categories} currency={f.currency} />
      )}
    </div>
  );
}

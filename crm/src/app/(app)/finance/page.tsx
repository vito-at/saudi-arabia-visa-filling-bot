import Link from "next/link";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportFilters } from "@/components/reports/report-filters";
import { FinanceLeads } from "@/components/finance/finance-leads";
import { ExpensesPanel } from "@/components/finance/expenses-panel";
import { PendingCosts } from "@/components/finance/pending-costs";
import { MoneyPie } from "@/components/reports/charts";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getManagers } from "@/lib/refs";
import { readFilters, type ReportFilters as Filters } from "@/lib/reports/data";
import { expenseCategories, expensesByCategory, financeSummary, loadAdSpendTotal, loadExpenses, loadFinanceLeads, loadPendingDeals, profitByService, type ServiceProfit } from "@/lib/finance";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { formatters } from "@/i18n/core";

type Tab = "profit" | "expenses" | "net";
const TABS: Tab[] = ["profit", "expenses", "net"];
const TAB_LABEL = { profit: "finance.tabProfit", expenses: "finance.tabExpenses", net: "finance.tabNet" } as const;

type Tile = { label: string; value: string; tone?: "pos" | "neg" | "muted"; hint?: string };

/** «Финансы» — только для администратора: прибыль (по продуктам и лидам), расходы и чистая прибыль */
export default async function FinancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAdmin();
  const raw = sp(params, "tab");
  // tab=leads — старая ссылка на «Прибыль по лидам»
  const tab: Tab = raw === "expenses" || raw === "net" ? raw : "profit";
  const filters = await readFilters(params, user);
  // фильтр по менеджеру есть только у прибыли; расходы и чистая прибыль — по всей компании
  const f = tab === "profit" ? filters : { ...filters, managerId: null };
  const { t } = f;
  const fm = formatters(f.locale);
  const money = (n: number) => fm.money(n, f.currency);

  const [leads, adSpend, expenses, categories, managers, pendingDeals] = await Promise.all([loadFinanceLeads(f), loadAdSpendTotal(f), loadExpenses(f), expenseCategories(), getManagers(), loadPendingDeals()]);
  const pendingInPeriod = leads.reduce((s, l) => s + l.deals.filter((d) => !d.costConfirmed).length, 0);
  const summary = financeSummary(leads, adSpend, expenses.reduce((s, e) => s + e.converted, 0));
  const byCategory = expensesByCategory(expenses);
  const services = profitByService(leads);
  const serviceName = (sv: ServiceProfit["service"]) => (sv ? t(`service.${sv}`) : t("finance.noService"));
  const allExpenses = (summary.adSpend ?? 0) + summary.expenses;

  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "tab" && (tab === "profit" || k !== "manager")) keep.set(k, v);
  const tabHref = (tb: Tab) => `/finance?tab=${tb}${keep.size ? `&${keep.toString()}` : ""}`;
  const tone = (n: number): "pos" | "neg" => (n < 0 ? "neg" : "pos");
  const adValue = summary.adSpend === null ? "—" : money(summary.adSpend);

  const tiles: Record<Tab, Tile[]> = {
    profit: [
      { label: t("finance.revenue"), value: money(summary.revenue) },
      { label: t("finance.cost"), value: money(summary.cost), tone: "muted" },
      { label: t("finance.profit"), value: money(summary.grossProfit), tone: tone(summary.grossProfit) },
      { label: t("finance.margin"), value: formatPercent(summary.revenue > 0 ? summary.grossProfit / summary.revenue : null) },
    ],
    expenses: [
      { label: t("finance.expenses"), value: money(summary.expenses) },
      { label: t("finance.adSpend"), value: adValue, hint: summary.adSpend === null ? t("finance.adSpendOff") : undefined },
      { label: t("finance.expensesAll"), value: money(allExpenses), tone: "neg" },
    ],
    net: [
      { label: t("finance.grossProfit"), value: money(summary.grossProfit), tone: tone(summary.grossProfit) },
      { label: t("finance.expensesAll"), value: `− ${money(allExpenses)}`, tone: "muted" },
      { label: t("finance.netProfit"), value: money(summary.netProfit), tone: tone(summary.netProfit), hint: t("finance.netHint") },
      { label: t("finance.netMargin"), value: formatPercent(summary.revenue > 0 ? summary.netProfit / summary.revenue : null), hint: t("finance.netMarginHint") },
    ],
  };

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
      {tab === "profit" && <PendingCosts deals={pendingDeals} />}
      <div className="no-scrollbar -mx-3 mb-4 flex gap-1 overflow-x-auto whitespace-nowrap border-b px-3 sm:mx-0 sm:px-0">
        {TABS.map((tb) => (
          <Link
            key={tb}
            href={tabHref(tb)}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === tb ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t(TAB_LABEL[tb])}
          </Link>
        ))}
      </div>
      <div className="mb-5">
        <Suspense>
          <ReportFilters managers={tab === "profit" ? managers.map((m) => ({ id: m.id, name: m.name })) : null} />
        </Suspense>
      </div>

      <div className={cn("mb-5 grid grid-cols-2 gap-3", tiles[tab].length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4")}>
        {tiles[tab].map((tl) => (
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

      {pendingInPeriod > 0 && tab !== "expenses" && <p className="-mt-2 mb-4 text-xs font-medium text-amber-700">{t("finance.pendingWarn", { n: pendingInPeriod })}</p>}
      {tab === "profit" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>{t("finance.byService")}</CardTitle>
              </CardHeader>
              <ServiceProfitTable rows={services} money={money} t={t} />
            </Card>
            <Card className="h-fit p-4">
              <div className="mb-3 text-sm font-semibold">{t("finance.profitSources")}</div>
              <MoneyPie currency={f.currency} data={services.map((r) => ({ name: serviceName(r.service), value: r.profit }))} />
            </Card>
          </div>
          <Card>
            <CardHeader className="flex-wrap gap-x-3 gap-y-1">
              <CardTitle className="whitespace-nowrap">{t("finance.byLead")}</CardTitle>
              <span className="text-xs text-muted-foreground">{t("finance.leadsCount", { n: summary.leads, d: summary.deals })}</span>
            </CardHeader>
            <FinanceLeads leads={leads} currency={f.currency} rate={f.rate} />
          </Card>
        </div>
      )}
      {tab === "expenses" && <ExpensesPanel rows={expenses} byCategory={byCategory} adSpend={summary.adSpend} categories={categories} currency={f.currency} />}
      {tab === "net" && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{t("finance.pnlTitle")}</CardTitle>
          </CardHeader>
          <div className="px-5 pb-5 text-sm">
            <PnlLine label={t("finance.revenue")} value={money(summary.revenue)} />
            <PnlLine label={t("finance.cost")} value={`− ${money(summary.cost)}`} muted />
            <PnlLine label={t("finance.grossProfit")} value={money(summary.grossProfit)} total tone={tone(summary.grossProfit)} />
            <PnlLine label={t("finance.adSpend")} value={summary.adSpend === null ? t("finance.adSpendOff") : `− ${money(summary.adSpend)}`} muted />
            <PnlLine label={t("finance.expenses")} value={`− ${money(summary.expenses)}`} muted />
            {byCategory.map((c) => (
              <PnlLine key={c.category} label={c.category} value={`− ${money(c.total)}`} sub />
            ))}
            <PnlLine label={t("finance.netProfit")} value={money(summary.netProfit)} total big tone={tone(summary.netProfit)} />
          </div>
        </Card>
      )}
    </div>
  );
}

/** Строка расчёта чистой прибыли; total — итог с чертой сверху, sub — расшифровка статьи */
function PnlLine({ label, value, muted, total, big, sub, tone }: { label: string; value: string; muted?: boolean; total?: boolean; big?: boolean; sub?: boolean; tone?: "pos" | "neg" }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", total && "mt-1 border-t pt-2.5 font-semibold", sub && "py-0.5 pl-4 text-xs text-muted-foreground", big && "text-base")}>
      <span className="min-w-0 truncate">{label}</span>
      <span className={cn("whitespace-nowrap tabular-nums", muted && "text-muted-foreground", tone === "pos" && "text-emerald-700", tone === "neg" && "text-red-600")}>{value}</span>
    </div>
  );
}

/** Прибыль по продуктам: выручка, себестоимость, прибыль, маржа и доля в общей прибыли */
function ServiceProfitTable({ rows, money, t }: { rows: ServiceProfit[]; money: (n: number) => string; t: Filters["t"] }) {
  if (rows.length === 0) return <div className="px-5 pb-5 text-sm text-muted-foreground">{t("finance.empty")}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">{t("lead.field.service")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("finance.revenue")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("finance.cost")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("finance.profit")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("finance.margin")}</th>
            <th className="px-4 py-2 text-right font-medium">{t("finance.deals")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.service ?? "none"}>
              <td className="px-4 py-2.5">
                <div className="font-medium">{r.service ? t(`service.${r.service}`) : t("finance.noService")}</div>
                <div className="mt-1 flex items-center gap-2" title={t("finance.share")}>
                  <div className="h-1.5 w-24 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-brand" style={{ width: `${r.share === null ? 0 : Math.max(r.share > 0 ? 2 : 0, r.share * 100)}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{formatPercent(r.share, 0)}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{money(r.revenue)}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">{money(r.cost)}</td>
              <td className={cn("px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums", r.profit < 0 ? "text-red-600" : "text-emerald-700")}>{money(r.profit)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(r.margin)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.deals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

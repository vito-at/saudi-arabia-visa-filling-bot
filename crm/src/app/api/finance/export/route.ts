import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { formatDate, toInputDate } from "@/lib/format";
import { readFilters } from "@/lib/reports/data";
import { buildWorkbook } from "@/lib/reports/excel";
import type { Table } from "@/lib/reports/tables";
import { expensesByCategory, financeSummary, loadAdSpendTotal, loadExpenses, loadFinanceLeads, profitByService } from "@/lib/finance";

export const dynamic = "force-dynamic";

/** «Финансы» в Excel (только администратор): прибыль по продуктам и сделкам, расходы, чистая прибыль */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const filters = await readFilters(params, user);
  const tab = params.tab === "expenses" || params.tab === "net" ? params.tab : "profit";
  const f = tab === "profit" ? filters : { ...filters, managerId: null };
  const { t } = f;
  const [leads, adSpend, expenses] = await Promise.all([loadFinanceLeads(f), loadAdSpendTotal(f), loadExpenses(f)]);
  const summary = financeSummary(leads, adSpend, expenses.reduce((s, e) => s + e.converted, 0));
  const byCategory = expensesByCategory(expenses);

  const tables: Table[] = [];
  if (tab === "profit") {
    tables.push({
      title: t("finance.byService"),
      columns: [
        { key: "name", label: t("lead.field.service"), type: "text" },
        { key: "revenue", label: t("finance.revenue"), type: "money" },
        { key: "cost", label: t("finance.cost"), type: "money" },
        { key: "profit", label: t("finance.profit"), type: "money" },
        { key: "margin", label: t("finance.margin"), type: "pct" },
        { key: "deals", label: t("finance.deals"), type: "int" },
      ],
      rows: profitByService(leads).map((r) => ({ name: r.service ? t(`service.${r.service}`) : t("finance.noService"), revenue: r.revenue, cost: r.cost, profit: r.profit, margin: r.margin, deals: r.deals })),
      totals: { name: t("rt.total"), revenue: summary.revenue, cost: summary.cost, profit: summary.grossProfit, margin: summary.revenue ? summary.grossProfit / summary.revenue : null, deals: summary.deals },
    });
    tables.push({
      title: t("finance.dealsSheet"),
      columns: [
        { key: "date", label: t("deal.paidAt"), type: "date" },
        { key: "lead", label: t("finance.lead"), type: "text" },
        { key: "manager", label: t("rt.managers.manager"), type: "text" },
        { key: "product", label: t("deal.product"), type: "text" },
        { key: "amount", label: t("finance.original"), type: "text" },
        { key: "revenue", label: t("finance.revenue"), type: "money" },
        { key: "profit", label: t("finance.profit"), type: "money" },
      ],
      rows: leads
        .flatMap((l) => l.deals.map((d) => ({ d, l })))
        .sort((a, b) => a.d.paidAt.localeCompare(b.d.paidAt))
        .map(({ d, l }) => ({ date: formatDate(d.paidAt), lead: l.name, manager: l.manager, product: d.product, amount: `${d.amount} ${d.currency}`, revenue: d.revenue, profit: d.costConfirmed ? d.profit : null })),
    });
  } else if (tab === "expenses") {
    tables.push({
      title: t("finance.tabExpenses"),
      columns: [
        { key: "date", label: t("finance.date"), type: "date" },
        { key: "category", label: t("finance.category"), type: "text" },
        { key: "amount", label: t("finance.original"), type: "text" },
        { key: "converted", label: t("finance.amount"), type: "money" },
        { key: "note", label: t("finance.note"), type: "text" },
      ],
      rows: expenses.map((e) => ({ date: formatDate(`${e.date}T12:00:00Z`), category: e.category, amount: `${e.amount} ${e.currency}`, converted: e.converted, note: e.note })),
      totals: { date: t("rt.total"), category: null, amount: null, converted: summary.expenses, note: null },
    });
    tables.push({
      title: t("finance.byCategory"),
      columns: [
        { key: "category", label: t("finance.category"), type: "text" },
        { key: "total", label: t("finance.amount"), type: "money" },
      ],
      rows: byCategory.map((c) => ({ category: c.category, total: c.total })),
    });
  } else {
    const lines: [string, number | null][] = [
      [t("finance.revenue"), summary.revenue],
      [t("finance.cost"), -summary.cost],
      [t("finance.grossProfit"), summary.grossProfit],
      [t("finance.adSpend"), summary.adSpend === null ? null : -summary.adSpend],
      [t("finance.expenses"), -summary.expenses],
      ...byCategory.map((c) => [`  ${c.category}`, -c.total] as [string, number]),
      [t("finance.netProfit"), summary.netProfit],
    ];
    tables.push({
      title: t("finance.pnlTitle"),
      columns: [
        { key: "name", label: t("rt.dash.metric"), type: "text" },
        { key: "value", label: t("finance.sum"), type: "money" },
      ],
      rows: lines.map(([name, value]) => ({ name, value })),
    });
  }
  const to = new Date(f.period.to.getTime() - 1);
  const buf = await buildWorkbook(tables, {
    title: `Orient Travel — ${t("finance.title")}`,
    subtitle: t("excel.subtitle", { from: formatDate(f.period.from), to: formatDate(to), cur: f.currency, rate: f.rate, costRate: f.costRate }),
    currency: f.currency,
    minutesLabel: t("excel.minutes"),
  });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orient-finance-${tab}-${toInputDate(f.period.from)}_${toInputDate(to)}.xlsx"`,
    },
  });
}

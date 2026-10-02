import type { Currency, LeadSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { convert, round2, toNum } from "@/lib/money";
import type { ReportFilters } from "@/lib/reports/data";
import { dateColumnRange } from "@/lib/period";

/** Сделка в разделе «Финансы»: суммы в исходной валюте и в валюте отчёта */
export interface FinanceDeal {
  id: string;
  product: string;
  amount: number;
  cost: number;
  currency: Currency;
  paidAt: string;
  revenue: number; // в валюте отчёта
  profit: number; // в валюте отчёта
  costConfirmed: boolean;
}

export interface FinanceLead {
  id: string;
  name: string;
  phone: string | null;
  manager: string | null;
  source: LeadSource;
  campaign: string | null;
  lastPaidAt: string;
  deals: FinanceDeal[];
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
  /** есть сделки, по которым администратор ещё не указал себестоимость */
  costPending: boolean;
}

export interface FinanceSummary {
  revenue: number;
  cost: number;
  grossProfit: number;
  adSpend: number | null; // null — расходы на рекламу не подключены
  expenses: number;
  netProfit: number;
  deals: number;
  leads: number;
}

/** Сгруппировать сделки по лидам и посчитать выручку, себестоимость и прибыль в валюте отчёта */
export function groupDealsByLead(
  deals: Array<{
    id: string;
    product: string;
    amount: number;
    cost: number;
    currency: Currency;
    paidAt: Date;
    costConfirmed?: boolean;
    lead: {
      id: string;
      name: string;
      phone: string | null;
      source: LeadSource;
      campaignName: string | null;
      manager: { name: string } | null;
    };
  }>,
  to: Currency,
  rate: number,
): FinanceLead[] {
  const map = new Map<string, FinanceLead>();
  for (const d of deals) {
    const revenue = convert(d.amount, d.currency, to, rate);
    const cost = convert(d.cost, d.currency, to, rate);
    const row =
      map.get(d.lead.id) ??
      ({
        id: d.lead.id,
        name: d.lead.name,
        phone: d.lead.phone,
        manager: d.lead.manager?.name ?? null,
        source: d.lead.source,
        campaign: d.lead.campaignName,
        lastPaidAt: d.paidAt.toISOString(),
        deals: [],
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: null,
        costPending: false,
      } satisfies FinanceLead);
    row.deals.push({
      id: d.id,
      product: d.product,
      amount: d.amount,
      cost: d.cost,
      currency: d.currency,
      paidAt: d.paidAt.toISOString(),
      revenue,
      profit: round2(revenue - cost),
      costConfirmed: d.costConfirmed !== false,
    });
    if (d.costConfirmed === false) row.costPending = true;
    row.revenue = round2(row.revenue + revenue);
    row.cost = round2(row.cost + cost);
    row.profit = round2(row.revenue - row.cost);
    row.margin = row.revenue > 0 ? row.profit / row.revenue : null;
    if (d.paidAt.toISOString() > row.lastPaidAt) row.lastPaidAt = d.paidAt.toISOString();
    map.set(d.lead.id, row);
  }
  return [...map.values()].sort((a, b) => b.lastPaidAt.localeCompare(a.lastPaidAt));
}

/** Итоги: валовая прибыль − реклама − расходы компании = чистая прибыль */
export function financeSummary(leads: FinanceLead[], adSpend: number | null, expenses: number): FinanceSummary {
  const revenue = round2(leads.reduce((s, l) => s + l.revenue, 0));
  const cost = round2(leads.reduce((s, l) => s + l.cost, 0));
  const grossProfit = round2(revenue - cost);
  return {
    revenue,
    cost,
    grossProfit,
    adSpend,
    expenses: round2(expenses),
    netProfit: round2(grossProfit - (adSpend ?? 0) - expenses),
    deals: leads.reduce((s, l) => s + l.deals.length, 0),
    leads: leads.length,
  };
}

/** Сделки, оплаченные в периоде, сгруппированные по лидам (фильтр по менеджеру сделки) */
export async function loadFinanceLeads(f: ReportFilters): Promise<FinanceLead[]> {
  const rows = await prisma.deal.findMany({
    where: {
      paidAt: { gte: f.period.from, lt: f.period.to },
      ...(f.managerId ? { managerId: f.managerId === "none" ? null : f.managerId } : {}),
    },
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      product: true,
      amount: true,
      cost: true,
      currency: true,
      paidAt: true,
      costConfirmed: true,
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          source: true,
          campaignName: true,
          manager: { select: { name: true } },
        },
      },
    },
  });
  return groupDealsByLead(
    rows.map((r) => ({ ...r, amount: toNum(r.amount), cost: toNum(r.cost) })),
    f.currency,
    f.rate,
  );
}

/** Расход на рекламу из Meta за период; null, если расходы ещё ни разу не загружались */
export async function loadAdSpendTotal(f: ReportFilters): Promise<number | null> {
  if (!(await prisma.adSpend.count())) return null;
  const rows = await prisma.adSpend.groupBy({
    by: ["currency"],
    where: { date: dateColumnRange(f.period) },
    _sum: { spend: true },
  });
  return round2(rows.reduce((s, r) => s + convert(toNum(r._sum.spend), r.currency === "UZS" ? "UZS" : "USD", f.currency, f.rate), 0));
}

export interface ExpenseRow {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  amount: number;
  currency: Currency;
  converted: number;
  note: string | null;
  createdBy: string | null;
}

export async function loadExpenses(f: ReportFilters): Promise<ExpenseRow[]> {
  const rows = await prisma.expense.findMany({
    where: { date: dateColumnRange(f.period) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    date: e.date.toISOString().slice(0, 10),
    category: e.category,
    amount: toNum(e.amount),
    currency: e.currency,
    converted: convert(e.amount, e.currency, f.currency, f.rate),
    note: e.note,
    createdBy: e.createdBy?.name ?? null,
  }));
}

/** Суммы расходов по категориям (по убыванию) */
export function expensesByCategory(rows: ExpenseRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.category, round2((map.get(r.category) ?? 0) + r.converted));
  return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

/** Категории, которые уже встречались — для подсказок в форме */
export async function expenseCategories(): Promise<string[]> {
  const rows = await prisma.expense.groupBy({
    by: ["category"],
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
    take: 30,
  });
  return rows.map((r) => r.category);
}

export interface PendingDeal {
  id: string;
  leadId: string;
  leadName: string;
  manager: string | null;
  product: string;
  amount: number;
  currency: Currency;
  paidAt: string;
}

/** Сделки, закрытые менеджерами, по которым администратор ещё не указал себестоимость (за всё время) */
export async function loadPendingDeals(): Promise<PendingDeal[]> {
  const rows = await prisma.deal.findMany({
    where: { costConfirmed: false },
    orderBy: { paidAt: "asc" },
    select: { id: true, product: true, amount: true, currency: true, paidAt: true, manager: { select: { name: true } }, lead: { select: { id: true, name: true } } },
  });
  return rows.map((d) => ({
    id: d.id,
    leadId: d.lead.id,
    leadName: d.lead.name,
    manager: d.manager?.name ?? null,
    product: d.product,
    amount: toNum(d.amount),
    currency: d.currency,
    paidAt: d.paidAt.toISOString(),
  }));
}

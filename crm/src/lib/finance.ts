import type { Currency, LeadSource, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { convertCost, convertRevenue, round2, toNum } from "@/lib/money";
import type { ReportFilters } from "@/lib/reports/data";
import { dateColumnRange } from "@/lib/period";
import { dateColumnKey, ratesOn, resolveRates, type RateBook } from "@/lib/rate-book";

/** Сделка в разделе «Финансы»: суммы в исходной валюте и в валюте отчёта */
export interface FinanceDeal {
  id: string;
  product: string;
  amount: number;
  cost: number;
  currency: Currency;
  /** валюта себестоимости */
  costCurrency: Currency;
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
  /** тип услуги лида — продукт, по которому считается разбивка прибыли */
  serviceType: ServiceType | null;
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
    costCurrency?: Currency;
    paidAt: Date;
    costConfirmed?: boolean;
    lead: {
      id: string;
      name: string;
      phone: string | null;
      source: LeadSource;
      serviceType?: ServiceType | null;
      campaignName: string | null;
      manager: { name: string } | null;
    };
  }>,
  to: Currency,
  rates: RateBook | number,
  costRate?: number,
): FinanceLead[] {
  const map = new Map<string, FinanceLead>();
  for (const d of deals) {
    // курсы дня оплаты: выручка по минимуму, себестоимость по максимуму
    const r = resolveRates(rates, costRate, d.paidAt);
    const revenue = convertRevenue(d.amount, d.currency, to, r);
    const cost = convertCost(d.cost, d.costCurrency ?? d.currency, to, r);
    const row =
      map.get(d.lead.id) ??
      ({
        id: d.lead.id,
        name: d.lead.name,
        phone: d.lead.phone,
        manager: d.lead.manager?.name ?? null,
        source: d.lead.source,
        serviceType: d.lead.serviceType ?? null,
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
      costCurrency: d.costCurrency ?? d.currency,
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

export interface ServiceProfit {
  /** null — у лида не указан тип услуги */
  service: ServiceType | null;
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
  /** доля в общей прибыли (0..1); null, если общая прибыль не положительна */
  share: number | null;
  deals: number;
  leads: number;
}

const SERVICE_ORDER: (ServiceType | null)[] = ["FLIGHTS", "TOUR", "VISA", "OTHER", null];

/** Прибыль по продуктам (тип услуги лида): сколько заработали на авиабилетах, турах, визах и т. д. — по убыванию прибыли */
export function profitByService(leads: FinanceLead[]): ServiceProfit[] {
  const map = new Map<ServiceType | null, ServiceProfit>();
  for (const l of leads) {
    const row = map.get(l.serviceType) ?? { service: l.serviceType, revenue: 0, cost: 0, profit: 0, margin: null, share: null, deals: 0, leads: 0 };
    row.revenue = round2(row.revenue + l.revenue);
    row.cost = round2(row.cost + l.cost);
    row.profit = round2(row.revenue - row.cost);
    row.deals += l.deals.length;
    row.leads += 1;
    map.set(l.serviceType, row);
  }
  const total = [...map.values()].reduce((s, r) => s + r.profit, 0);
  return [...map.values()]
    .map((r) => ({ ...r, margin: r.revenue > 0 ? r.profit / r.revenue : null, share: total > 0 ? Math.max(0, r.profit) / total : null }))
    .sort((a, b) => b.profit - a.profit || SERVICE_ORDER.indexOf(a.service) - SERVICE_ORDER.indexOf(b.service));
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
      costCurrency: true,
      paidAt: true,
      costConfirmed: true,
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          source: true,
          serviceType: true,
          campaignName: true,
          manager: { select: { name: true } },
        },
      },
    },
  });
  return groupDealsByLead(
    rows.map((r) => ({ ...r, amount: toNum(r.amount), cost: toNum(r.cost) })),
    f.currency,
    f.book,
  );
}

/** Расход на рекламу из Meta за период (по курсу покупки $ каждого дня); null, если расходы ещё ни разу не загружались */
export async function loadAdSpendTotal(f: ReportFilters): Promise<number | null> {
  if (!(await prisma.adSpend.count())) return null;
  const rows = await prisma.adSpend.groupBy({
    by: ["date", "currency"],
    where: { date: dateColumnRange(f.period) },
    _sum: { spend: true },
  });
  return round2(rows.reduce((s, r) => s + convertCost(toNum(r._sum.spend), r.currency === "UZS" ? "UZS" : "USD", f.currency, ratesOn(f.book, dateColumnKey(r.date))), 0));
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
    // старые записи «Взял себе из кассы» в расходы не входят
    where: { date: dateColumnRange(f.period), ownerDraw: false },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    date: e.date.toISOString().slice(0, 10),
    category: e.category,
    amount: toNum(e.amount),
    currency: e.currency,
    converted: convertCost(e.amount, e.currency, f.currency, ratesOn(f.book, dateColumnKey(e.date))),
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
    where: { ownerDraw: false },
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

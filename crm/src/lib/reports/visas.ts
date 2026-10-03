/**
 * Отчёт «Визы»: сколько заявлений на визу продано и по каким странам.
 * Продажа — лид с «Визовой поддержкой» и сделкой, оплаченной в периоде. Сделки берутся только за период.
 * Если количество заявлений не указано, лид считается за одно заявление.
 */
import { prisma } from "@/lib/db";
import { matchVisaCountry } from "@/lib/constants";
import { round2, toNum } from "@/lib/money";
import { dealProfit, dealRevenue } from "./calc";
import { money, type ReportFilters } from "./data";
import type { Table } from "./tables";

export interface VisaSale {
  destination: string | null;
  applications: number | null;
  revenue: number;
  profit: number;
}

export interface VisaCountryRow {
  name: string | null; // null — страна не указана
  applications: number;
  sales: number;
  revenue: number;
  profit: number;
}

/** Группировка продаж по странам (написания из списка стран сводятся к одному названию), по убыванию заявлений */
export function groupVisaSales(sales: VisaSale[]): { rows: VisaCountryRow[]; noCount: number } {
  const map = new Map<string, VisaCountryRow>();
  let noCount = 0;
  for (const s of sales) {
    const name = matchVisaCountry(s.destination) ?? (s.destination?.trim() || null);
    const key = name?.toLowerCase() ?? "";
    const row = map.get(key) ?? { name, applications: 0, sales: 0, revenue: 0, profit: 0 };
    if (!s.applications) noCount++;
    row.applications += s.applications || 1;
    row.sales += 1;
    row.revenue = round2(row.revenue + s.revenue);
    row.profit = round2(row.profit + s.profit);
    map.set(key, row);
  }
  const rows = [...map.values()].sort((a, b) => b.applications - a.applications || b.revenue - a.revenue);
  return { rows, noCount };
}

export async function loadVisaSales(f: ReportFilters): Promise<VisaSale[]> {
  const inPeriod = { paidAt: { gte: f.period.from, lt: f.period.to } };
  const managerId = f.managerId && f.managerId !== "none" ? f.managerId : null;
  const leads = await prisma.lead.findMany({
    where: { serviceType: "VISA", deals: { some: inPeriod }, ...(f.managerId === "none" ? { managerId: null } : managerId ? { managerId } : {}) },
    select: { destination: true, visaApplications: true, deals: { where: inPeriod, select: { amount: true, cost: true, currency: true, costCurrency: true, paidAt: true, managerId: true } } },
  });
  const m = money(f);
  return leads.map((l) => {
    const deals = l.deals.map((d) => ({ ...d, amount: toNum(d.amount), cost: toNum(d.cost) }));
    return {
      destination: l.destination,
      applications: l.visaApplications,
      revenue: round2(deals.reduce((s, d) => s + dealRevenue(d, m), 0)),
      profit: round2(deals.reduce((s, d) => s + dealProfit(d, m), 0)),
    };
  });
}

export async function visasTable(f: ReportFilters): Promise<{ table: Table; totals: { applications: number; sales: number; countries: number }; noCount: number }> {
  const { t } = f;
  const { rows, noCount } = groupVisaSales(await loadVisaSales(f));
  const sum = (k: "applications" | "sales" | "revenue" | "profit") => rows.reduce((s, r) => s + r[k], 0);
  const applications = sum("applications");
  return {
    table: {
      title: t("rt.visas.title"),
      note: t("rt.visas.note"),
      columns: [
        { key: "name", label: t("rt.visas.country"), type: "text" },
        { key: "applications", label: t("rt.visas.applications"), type: "int" },
        { key: "share", label: t("rt.visas.share"), type: "pct" },
        { key: "sales", label: t("rt.col.sales"), type: "int" },
        { key: "revenue", label: t("rt.col.revenue"), type: "money" },
        { key: "profit", label: t("rt.col.profit"), type: "money" },
      ],
      rows: rows.map((r) => ({ name: r.name ?? t("rt.visas.noCountry"), applications: r.applications, share: applications ? r.applications / applications : null, sales: r.sales, revenue: r.revenue, profit: r.profit })),
      totals: { name: t("rt.total"), applications, share: applications ? 1 : null, sales: sum("sales"), revenue: round2(sum("revenue")), profit: round2(sum("profit")) },
    },
    totals: { applications, sales: sum("sales"), countries: rows.filter((r) => r.name).length },
    noCount,
  };
}

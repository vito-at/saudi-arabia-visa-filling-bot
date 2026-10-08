/**
 * «Продажи по продуктам»: сколько и каких продуктов продал каждый менеджер за период.
 * Продукт — тип услуги лида (его же заполняет выбор продукта в окне сделки); сделка относится к менеджеру сделки.
 * Продажи считаются по количеству в сделке: виза на 6 человек — 6 продаж.
 */
import type { ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { round2, toNum } from "@/lib/money";
import { serviceLabel } from "@/i18n/labels";
import { getManagers } from "@/lib/refs";
import { dealProfit, dealRevenue, type Money, type RDeal } from "./calc";
import { money, type ReportFilters } from "./data";
import type { Column, Table } from "./tables";

import { PRODUCT_KEYS, type ProductKey } from "./products-keys";
export { PRODUCT_KEYS, type ProductKey };

export interface ProductDeal extends RDeal {
  serviceType: ServiceType | null;
  /** количество продаж в сделке (виза на 6 человек — 6); по умолчанию 1 */
  quantity?: number;
}

export interface ManagerProducts {
  id: string | null; // null — сделки без менеджера
  counts: Record<ProductKey, number>;
  sales: number;
  revenue: number;
  profit: number;
}

const emptyCounts = () => Object.fromEntries(PRODUCT_KEYS.map((k) => [k, 0])) as Record<ProductKey, number>;

/** Сводка по менеджерам: количество сделок по каждому продукту, всего, выручка и прибыль (в валюте отчёта) */
export function productsByManager(deals: ProductDeal[], m: Money): ManagerProducts[] {
  const map = new Map<string | null, ManagerProducts>();
  for (const d of deals) {
    const row = map.get(d.managerId) ?? { id: d.managerId, counts: emptyCounts(), sales: 0, revenue: 0, profit: 0 };
    const q = d.quantity ?? 1;
    row.counts[d.serviceType ?? "none"] += q;
    row.sales += q;
    row.revenue = round2(row.revenue + dealRevenue(d, m));
    row.profit = round2(row.profit + dealProfit(d, m));
    map.set(d.managerId, row);
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales || b.revenue - a.revenue);
}

export async function productsByManagerTable(f: ReportFilters): Promise<Table> {
  const { t } = f;
  const [rows, users] = await Promise.all([
    prisma.deal.findMany({
      where: { paidAt: { gte: f.period.from, lt: f.period.to }, ...(f.managerId ? { managerId: f.managerId === "none" ? null : f.managerId } : {}) },
      select: { amount: true, cost: true, currency: true, costCurrency: true, paidAt: true, managerId: true, quantity: true, lead: { select: { serviceType: true } } },
    }),
    getManagers(),
  ]);
  const deals: ProductDeal[] = rows.map((d) => ({ ...d, amount: toNum(d.amount), cost: toNum(d.cost), serviceType: d.lead.serviceType }));
  const data = productsByManager(deals, money(f));
  const names = new Map(users.map((u) => [u.id, u.name]));
  // колонку «Не указан» показываем, только если такие сделки есть
  const keys = PRODUCT_KEYS.filter((k) => k !== "none" || data.some((r) => r.counts.none > 0));
  const label = (k: ProductKey) => (k === "none" ? t("rt.services.noService") : serviceLabel(t, k));
  const columns: Column[] = [
    { key: "name", label: t("rt.managers.manager"), type: "text" },
    ...keys.map((k): Column => ({ key: k, label: label(k), type: "int" })),
    { key: "sales", label: t("rt.products.total"), type: "int" },
    { key: "revenue", label: t("rt.col.revenue"), type: "money" },
    { key: "profit", label: t("rt.col.profit"), type: "money" },
  ];
  const sum = (pick: (r: ManagerProducts) => number) => round2(data.reduce((s, r) => s + pick(r), 0));
  return {
    title: t("rt.products.title"),
    note: t("rt.products.note"),
    columns,
    rows: data.map((r) => ({
      // id менеджера (не колонка) — чтобы администратор мог открыть сделки ячейки
      mid: r.id ?? "none",
      name: r.id ? names.get(r.id) ?? "—" : t("rt.losses.unassigned"),
      ...Object.fromEntries(keys.map((k) => [k, r.counts[k]])),
      sales: r.sales,
      revenue: r.revenue,
      profit: r.profit,
    })),
    totals:
      data.length > 1
        ? { name: t("rt.total"), ...Object.fromEntries(keys.map((k) => [k, sum((r) => r.counts[k])])), sales: sum((r) => r.sales), revenue: sum((r) => r.revenue), profit: sum((r) => r.profit) }
        : undefined,
  };
}

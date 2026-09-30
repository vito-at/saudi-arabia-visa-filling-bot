import type { Currency, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toNum } from "@/lib/money";
import { previousPeriod, resolvePeriod, type Period } from "@/lib/period";
import { getSettings } from "@/lib/refs";
import type { CurrentUser } from "@/lib/session";
import { sp, type SearchParams } from "@/lib/leads/query";
import type { Money, RDeal, RLead } from "./calc";

export interface ReportFilters {
  period: Period;
  currency: Currency;
  managerId: string | null; // для менеджера — всегда он сам
  rate: number;
}

export async function readFilters(params: SearchParams, user: CurrentUser): Promise<ReportFilters> {
  const settings = await getSettings();
  return {
    period: resolvePeriod(sp(params, "period") ?? "30d", sp(params, "from"), sp(params, "to")),
    currency: sp(params, "cur") === "UZS" ? "UZS" : "USD",
    managerId: user.role === "ADMIN" ? sp(params, "manager") ?? null : user.id,
    rate: toNum(settings.usdRate),
  };
}

export const money = (f: ReportFilters): Money => ({ currency: f.currency, rate: f.rate });

function managerWhere(managerId: string | null): Prisma.LeadWhereInput {
  if (!managerId) return {};
  return managerId === "none" ? { managerId: null } : { managerId };
}

/** Лиды, созданные в периоде, со всеми их сделками и пройденными статусами */
export async function loadLeads(period: { from: Date; to: Date }, managerId: string | null): Promise<RLead[]> {
  const rows = await prisma.lead.findMany({
    where: { createdAt: { gte: period.from, lt: period.to }, ...managerWhere(managerId) },
    select: {
      id: true,
      createdAt: true,
      managerId: true,
      statusId: true,
      status: { select: { kind: true } },
      lossReasonId: true,
      campaignId: true,
      campaignName: true,
      adsetId: true,
      adsetName: true,
      adId: true,
      adName: true,
      formId: true,
      formName: true,
      serviceType: true,
      destination: true,
      firstResponseAt: true,
      history: { where: { toStatusId: { not: null } }, select: { toStatusId: true } },
      deals: { select: { amount: true, cost: true, currency: true, paidAt: true, managerId: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    statusKind: r.status.kind,
    visitedStatusIds: r.history.map((h) => h.toStatusId!),
    deals: r.deals.map((d) => ({ ...d, amount: toNum(d.amount), cost: toNum(d.cost) })),
  }));
}

/** Сделки, оплаченные в периоде */
export async function loadDeals(period: { from: Date; to: Date }, managerId: string | null): Promise<RDeal[]> {
  const rows = await prisma.deal.findMany({
    where: { paidAt: { gte: period.from, lt: period.to }, ...(managerId ? { managerId: managerId === "none" ? null : managerId } : {}) },
    select: { amount: true, cost: true, currency: true, paidAt: true, managerId: true },
  });
  return rows.map((d) => ({ ...d, amount: toNum(d.amount), cost: toNum(d.cost) }));
}

/** Расходы на рекламу за период, сгруппированные по уровню; суммы в валюте отчёта */
export async function loadSpend(period: { from: Date; to: Date }, level: "campaign" | "adset" | "ad", f: ReportFilters): Promise<Map<string, number> | null> {
  const any = await prisma.adSpend.count();
  if (!any) return null;
  const col = { campaign: "campaignId", adset: "adsetId", ad: "adId" } as const;
  const rows = await prisma.adSpend.groupBy({
    by: [col[level], "currency"],
    where: { date: { gte: period.from, lt: period.to } },
    _sum: { spend: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = (r as Record<string, unknown>)[col[level]] as string;
    const cur = r.currency === "UZS" ? "UZS" : "USD";
    const v = toNum(r._sum.spend);
    const converted = cur === f.currency ? v : cur === "USD" ? v * f.rate : v / f.rate;
    map.set(key, (map.get(key) ?? 0) + converted);
  }
  return map;
}

export { previousPeriod };

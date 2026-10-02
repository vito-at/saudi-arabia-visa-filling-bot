import type { Currency, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { convertCost, toNum } from "@/lib/money";
import { dateColumnRange, previousPeriod, resolvePeriod, type Period } from "@/lib/period";
import { getSettings } from "@/lib/refs";
import { loadRateBook } from "@/lib/rate-history";
import { dateColumnKey, ratesOn, type RateBook } from "@/lib/rate-book";
import type { CurrentUser } from "@/lib/session";
import { sp, type SearchParams } from "@/lib/leads/query";
import { getI18n } from "@/i18n/server";
import type { TFunction } from "@/i18n/core";
import type { Locale } from "@/i18n/config";
import type { AdStat, Money, RDeal, RLead } from "./calc";

export interface ReportFilters {
  period: Period;
  currency: Currency;
  managerId: string | null; // для менеджера — всегда он сам
  /** курс продажи $ — для выручки */
  rate: number;
  /** курс покупки $ (дорогой) — для себестоимости, рекламы и расходов компании */
  costRate: number;
  /** история курсов: суммы пересчитываются по курсам дня операции */
  book: RateBook;
  /** перевод подписей отчёта на язык пользователя */
  t: TFunction;
  locale: Locale;
}

export async function readFilters(params: SearchParams, user: CurrentUser): Promise<ReportFilters> {
  const settings = await getSettings();
  const { t, locale } = await getI18n();
  return {
    t,
    locale,
    period: resolvePeriod(sp(params, "period") ?? "30d", sp(params, "from"), sp(params, "to")),
    currency: sp(params, "cur") === "UZS" ? "UZS" : "USD",
    managerId: user.role === "ADMIN" ? sp(params, "manager") ?? null : user.id,
    rate: toNum(settings.usdRate),
    costRate: toNum(settings.usdRateCost),
    book: await loadRateBook(settings),
  };
}

export const money = (f: ReportFilters): Money => ({ currency: f.currency, rate: f.rate, costRate: f.costRate, book: f.book });

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

/** Статистика рекламы за период (расход в валюте отчёта, показы, клики), сгруппированная по уровню */
export async function loadSpend(period: { from: Date; to: Date }, level: "campaign" | "adset" | "ad", f: ReportFilters): Promise<Map<string, AdStat> | null> {
  const any = await prisma.adSpend.count();
  if (!any) return null;
  const col = { campaign: "campaignId", adset: "adsetId", ad: "adId" } as const;
  const nameCol = { campaign: "campaignName", adset: "adsetName", ad: "adName" } as const;
  const rows = await prisma.adSpend.findMany({
    where: { date: dateColumnRange(period) },
    select: { date: true, campaignId: true, adsetId: true, adId: true, campaignName: true, adsetName: true, adName: true, spend: true, currency: true, impressions: true, clicks: true },
  });
  const map = new Map<string, AdStat>();
  for (const r of rows) {
    const key = r[col[level]];
    if (!key) continue;
    const cur = r.currency === "UZS" ? "UZS" : "USD";
    const v = toNum(r.spend);
    const converted = convertCost(v, cur, f.currency, ratesOn(f.book, dateColumnKey(r.date)));
    const s = map.get(key) ?? { spend: 0, impressions: 0, clicks: 0, name: null };
    s.spend += converted;
    s.impressions += r.impressions;
    s.clicks += r.clicks;
    s.name ??= r[nameCol[level]];
    map.set(key, s);
  }
  return map;
}

export { previousPeriod };

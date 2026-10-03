/**
 * Раздел «Реклама»: расход Meta, цена лида и окупаемость по периодам (дни / недели / месяцы).
 * Чистые функции — без обращения к БД, покрыты тестами; загрузка данных — в loadAdsOverview.
 */
import { prisma } from "@/lib/db";
import { convertCost, round2, toNum } from "@/lib/money";
import { dateColumnRange, previousPeriod, type Period } from "@/lib/period";
import { dateColumnKey, ratesOn } from "@/lib/rate-book";
import { toInputDate } from "@/lib/format";
import { dealProfit, dealRevenue, isWon } from "./calc";
import { loadLeads, money, type ReportFilters } from "./data";

export type AdGroup = "day" | "week" | "month";
export const AD_GROUPS: AdGroup[] = ["day", "week", "month"];

/** Шаг по умолчанию: до месяца — дни, до полугода — недели, дальше — месяцы */
export function defaultAdGroup(period: { from: Date; to: Date }): AdGroup {
  const days = (period.to.getTime() - period.from.getTime()) / 86_400_000;
  return days <= 31 ? "day" : days <= 186 ? "week" : "month";
}

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Начало периода, в который попадает день (YYYY-MM-DD): неделя — с понедельника, месяц — с 1-го числа */
export function bucketStart(dayKey: string, group: AdGroup): string {
  if (group === "day") return dayKey;
  if (group === "month") return `${dayKey.slice(0, 7)}-01`;
  const dow = new Date(`${dayKey}T00:00:00Z`).getUTCDay(); // 0 — воскресенье
  return addDays(dayKey, -((dow + 6) % 7));
}

/** Все периоды от первого до последнего дня (включительно), чтобы на графике были и дни без расхода */
export function bucketStarts(firstDay: string, lastDay: string, group: AdGroup): string[] {
  const out: string[] = [];
  let cur = bucketStart(firstDay, group);
  const last = bucketStart(lastDay, group);
  while (cur <= last && out.length < 1000) {
    out.push(cur);
    cur = group === "day" ? addDays(cur, 1) : group === "week" ? addDays(cur, 7) : nextMonth(cur);
  }
  return out;
}

const nextMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
};

/** Расход за день — уже в валюте отчёта */
export interface AdDay {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
}

/** Лид из рекламы: когда пришёл, продан ли, выручка и прибыль его сделок (в валюте отчёта) */
export interface AdLead {
  day: string; // YYYY-MM-DD по Ташкенту
  won: boolean;
  revenue: number;
  profit: number;
}

export interface AdStats {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  sales: number;
  revenue: number;
  profit: number;
  /** цена лида = расход / лиды */
  cpl: number | null;
  /** цена продажи = расход / продажи */
  cps: number | null;
  cpc: number | null;
  ctr: number | null;
  /** конверсия лида в продажу */
  conversion: number | null;
  /** ROI = (прибыль − расход) / расход */
  roi: number | null;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

export function adStats(days: AdDay[], leads: AdLead[]): AdStats {
  const spend = round2(days.reduce((s, d) => s + d.spend, 0));
  const impressions = days.reduce((s, d) => s + d.impressions, 0);
  const clicks = days.reduce((s, d) => s + d.clicks, 0);
  const sales = leads.filter((l) => l.won).length;
  const revenue = round2(leads.reduce((s, l) => s + l.revenue, 0));
  const profit = round2(leads.reduce((s, l) => s + l.profit, 0));
  return {
    spend,
    impressions,
    clicks,
    leads: leads.length,
    sales,
    revenue,
    profit,
    cpl: div(spend, leads.length),
    cps: div(spend, sales),
    cpc: div(spend, clicks),
    ctr: div(clicks, impressions),
    conversion: div(sales, leads.length),
    roi: spend > 0 ? (profit - spend) / spend : null,
  };
}

export interface AdBucket extends AdStats {
  start: string; // первый день периода
}

/** Показатели по периодам (дни / недели / месяцы), включая периоды без расхода и лидов */
export function adBuckets(days: AdDay[], leads: AdLead[], firstDay: string, lastDay: string, group: AdGroup): AdBucket[] {
  const starts = bucketStarts(firstDay, lastDay, group);
  const byDays = new Map<string, AdDay[]>(starts.map((s) => [s, []]));
  const byLeads = new Map<string, AdLead[]>(starts.map((s) => [s, []]));
  for (const d of days) byDays.get(bucketStart(d.date, group))?.push(d);
  for (const l of leads) byLeads.get(bucketStart(l.day, group))?.push(l);
  return starts.map((start) => ({ start, ...adStats(byDays.get(start)!, byLeads.get(start)!) }));
}

/** Первый и последний день периода (to — не включительно) */
export function periodDays(period: { from: Date; to: Date }): [string, string] {
  return [toInputDate(period.from), toInputDate(new Date(period.to.getTime() - 1))];
}

async function loadAdDays(period: { from: Date; to: Date }, f: ReportFilters): Promise<AdDay[]> {
  const rows = await prisma.adSpend.groupBy({
    by: ["date", "currency"],
    where: { date: dateColumnRange(period) },
    _sum: { spend: true, impressions: true, clicks: true },
  });
  const map = new Map<string, AdDay>();
  for (const r of rows) {
    const date = dateColumnKey(r.date);
    // расход — по курсу покупки $ своего дня (по максимуму), как и остальные расходы
    const spend = convertCost(toNum(r._sum.spend), r.currency === "UZS" ? "UZS" : "USD", f.currency, ratesOn(f.book, date));
    const d = map.get(date) ?? { date, spend: 0, impressions: 0, clicks: 0 };
    d.spend = round2(d.spend + spend);
    d.impressions += r._sum.impressions ?? 0;
    d.clicks += r._sum.clicks ?? 0;
    map.set(date, d);
  }
  return [...map.values()];
}

async function loadAdLeads(period: { from: Date; to: Date }, f: ReportFilters): Promise<AdLead[]> {
  const m = money(f);
  const leads = await loadLeads(period, null);
  return leads
    .filter((l) => l.campaignId)
    .map((l) => ({
      day: toInputDate(l.createdAt),
      won: isWon(l),
      revenue: round2(l.deals.reduce((s, d) => s + dealRevenue(d, m), 0)),
      profit: round2(l.deals.reduce((s, d) => s + dealProfit(d, m), 0)),
    }));
}

export interface AdsOverview {
  /** расход из Meta ещё ни разу не загружался */
  noSpend: boolean;
  group: AdGroup;
  totals: AdStats;
  prev: AdStats;
  prevPeriod: Period;
  buckets: AdBucket[];
}

export async function loadAdsOverview(f: ReportFilters, group: AdGroup): Promise<AdsOverview> {
  const prevPeriod = previousPeriod(f.period);
  const [anySpend, days, leads, prevDays, prevLeads] = await Promise.all([
    prisma.adSpend.count(),
    loadAdDays(f.period, f),
    loadAdLeads(f.period, f),
    loadAdDays(prevPeriod, f),
    loadAdLeads(prevPeriod, f),
  ]);
  const [first, last] = periodDays(f.period);
  return {
    noSpend: anySpend === 0,
    group,
    totals: adStats(days, leads),
    prev: adStats(prevDays, prevLeads),
    prevPeriod,
    buckets: adBuckets(days, leads, first, last, group),
  };
}

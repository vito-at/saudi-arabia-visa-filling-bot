/**
 * Чистые функции расчёта отчётов — без обращения к БД, покрыты тестами.
 * Суммы пересчитываются в валюту отчёта по текущему курсу.
 */
import type { Currency } from "@prisma/client";
import { convert, round2, toNum } from "@/lib/money";

export interface RDeal {
  amount: number | string;
  cost: number | string;
  currency: Currency;
  paidAt: Date;
  managerId: string | null;
}

export interface RLead {
  id: string;
  createdAt: Date;
  managerId: string | null;
  statusId: string;
  statusKind: string;
  lossReasonId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  formId: string | null;
  formName: string | null;
  serviceType: string | null;
  destination: string | null;
  firstResponseAt: Date | null;
  /** статусы, через которые лид проходил (из истории) */
  visitedStatusIds: string[];
  deals: RDeal[];
}

export interface Money {
  currency: Currency;
  rate: number;
}

const safeDiv = (a: number, b: number) => (b > 0 ? a / b : null);

export function dealRevenue(d: RDeal, m: Money) {
  return convert(d.amount, d.currency, m.currency, m.rate);
}
export function dealProfit(d: RDeal, m: Money) {
  return round2(convert(toNum(d.amount) - toNum(d.cost), d.currency, m.currency, m.rate));
}

export const isWon = (l: Pick<RLead, "statusKind" | "deals">) => l.statusKind === "WON";

// ——— KPI для дашборда ———

export interface Kpis {
  leads: number;
  sales: number;
  conversion: number | null;
  revenue: number;
  profit: number;
  avgCheck: number | null;
  deals: number;
}

/**
 * @param leads лиды, созданные в периоде (для количества и конверсии)
 * @param deals сделки, оплаченные в периоде (для выручки, прибыли и среднего чека)
 */
export function calcKpis(leads: Pick<RLead, "statusKind" | "deals">[], deals: RDeal[], m: Money): Kpis {
  const sales = leads.filter(isWon).length;
  let revenue = 0;
  let profit = 0;
  for (const d of deals) {
    revenue += dealRevenue(d, m);
    profit += dealProfit(d, m);
  }
  return {
    leads: leads.length,
    sales,
    conversion: safeDiv(sales, leads.length),
    revenue: round2(revenue),
    profit: round2(profit),
    avgCheck: deals.length ? round2(revenue / deals.length) : null,
    deals: deals.length,
  };
}

/** Изменение относительно прошлого периода: 0.25 = +25%; null — не с чем сравнивать */
export function delta(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null) return null;
  if (prev === 0) return cur === 0 ? 0 : null;
  return (cur - prev) / Math.abs(prev);
}

// ——— Воронка ———

export interface FunnelStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  kind: string;
  /** false — статус-попытка (не дозвонились, перезвонить): не этап воронки */
  inFunnel?: boolean;
}
export interface FunnelRow {
  statusId: string;
  name: string;
  color: string;
  count: number;
  /** доля от всех лидов периода */
  ofTotal: number | null;
  /** доля от предыдущего шага */
  ofPrev: number | null;
}

/**
 * Сколько лидов дошло до каждого статуса.
 * Лид «дошёл» до шага, если побывал в нём или в любом более позднем шаге (кроме «Отказа»).
 * «Отказ» показывается отдельной строкой: сколько лидов в итоге отказались.
 */
/** Статус вне воронки: сколько лидов периода в нём побывали (или находятся сейчас) */
export interface SideStatusRow {
  statusId: string;
  name: string;
  color: string;
  count: number;
  ofTotal: number | null;
}

/**
 * Воронка продаж. Этапы — статусы с inFunnel (кроме «Отказа»): лид дошёл до этапа, если побывал в нём или в этапе дальше.
 * Статусы-попытки (не дозвонились, перезвонить) этапами не считаются и не «засчитываются» лидам, которые прошли дальше:
 * для них отдельно считается, сколько лидов в них действительно побывали.
 */
export function calcFunnel(
  leads: Pick<RLead, "statusId" | "statusKind" | "visitedStatusIds">[],
  statuses: FunnelStatus[],
): { steps: FunnelRow[]; side: SideStatusRow[]; lost: number; total: number } {
  const sorted = [...statuses].sort((a, b) => a.order - b.order);
  const steps = sorted.filter((s) => s.kind !== "LOST" && s.inFunnel !== false);
  const sideStatuses = sorted.filter((s) => s.kind !== "LOST" && s.inFunnel === false);
  const orderOf = new Map(steps.map((s) => [s.id, s.order]));
  const reached = steps.map(() => 0);
  const visited = sideStatuses.map(() => 0);
  let lost = 0;
  for (const l of leads) {
    if (l.statusKind === "LOST") lost++;
    const ids = [l.statusId, ...l.visitedStatusIds];
    const orders = ids.map((id) => orderOf.get(id)).filter((o): o is number => o !== undefined);
    const max = orders.length ? Math.max(...orders) : steps[0]?.order ?? 0;
    steps.forEach((s, i) => {
      if (s.order <= max) reached[i]++;
    });
    sideStatuses.forEach((s, i) => {
      if (ids.includes(s.id)) visited[i]++;
    });
  }
  const total = leads.length;
  return {
    total,
    lost,
    steps: steps.map((s, i) => ({
      statusId: s.id,
      name: s.name,
      color: s.color,
      count: reached[i],
      ofTotal: safeDiv(reached[i], total),
      ofPrev: i === 0 ? safeDiv(reached[i], total) : safeDiv(reached[i], reached[i - 1]),
    })),
    side: sideStatuses.map((s, i) => ({ statusId: s.id, name: s.name, color: s.color, count: visited[i], ofTotal: safeDiv(visited[i], total) })),
  };
}

// ——— Причины отказов ———

export interface LossRow {
  reasonId: string;
  name: string;
  count: number;
  share: number | null;
}

export function calcLossReasons(
  leads: Pick<RLead, "statusKind" | "lossReasonId">[],
  reasons: { id: string; name: string }[],
  noReasonLabel = "Причина не указана",
): { rows: LossRow[]; total: number } {
  const lost = leads.filter((l) => l.statusKind === "LOST");
  const counts = new Map<string, number>();
  for (const l of lost) {
    const k = l.lossReasonId ?? "none";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const names = new Map(reasons.map((r) => [r.id, r.name]));
  const rows = [...counts.entries()]
    .map(([reasonId, count]) => ({ reasonId, name: names.get(reasonId) ?? noReasonLabel, count, share: safeDiv(count, lost.length) }))
    .sort((a, b) => b.count - a.count);
  return { rows, total: lost.length };
}

/** Разбивка отказов: строки — менеджеры/кампании, столбцы — причины */
export function calcLossMatrix<K extends "managerId" | "campaignId">(
  leads: (Pick<RLead, "statusKind" | "lossReasonId"> & Record<K, string | null>)[],
  key: K,
) {
  const out = new Map<string, { total: number; byReason: Map<string, number> }>();
  for (const l of leads) {
    if (l.statusKind !== "LOST") continue;
    const k = l[key] ?? "none";
    const row = out.get(k) ?? { total: 0, byReason: new Map() };
    row.total++;
    const r = l.lossReasonId ?? "none";
    row.byReason.set(r, (row.byReason.get(r) ?? 0) + 1);
    out.set(k, row);
  }
  return out;
}

// ——— Группировки (реклама, менеджеры, услуги) ———

export interface GroupRow {
  key: string;
  name: string;
  leads: number;
  sales: number;
  conversion: number | null;
  revenue: number;
  profit: number;
}

/**
 * Когортная группировка: лиды периода и все их сделки.
 * Выручка и прибыль относятся к источнику лида, даже если оплата была позже.
 */
export function groupLeads(leads: RLead[], keyFn: (l: RLead) => { key: string; name: string } | null, m: Money): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const l of leads) {
    const k = keyFn(l);
    if (!k) continue;
    const row = map.get(k.key) ?? { key: k.key, name: k.name, leads: 0, sales: 0, conversion: null, revenue: 0, profit: 0 };
    row.leads++;
    if (isWon(l)) row.sales++;
    for (const d of l.deals) {
      row.revenue += dealRevenue(d, m);
      row.profit += dealProfit(d, m);
    }
    map.set(k.key, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, revenue: round2(r.revenue), profit: round2(r.profit), conversion: safeDiv(r.sales, r.leads) }))
    .sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name, "ru"));
}

export type AdLevel = "campaign" | "adset" | "ad" | "form";

export function adKey(level: AdLevel) {
  return (l: RLead) => {
    const pairs = {
      campaign: [l.campaignId, l.campaignName],
      adset: [l.adsetId, l.adsetName],
      ad: [l.adId, l.adName],
      form: [l.formId, l.formName],
    } as const;
    const [id, name] = pairs[level];
    return id ? { key: id, name: name ?? id } : null;
  };
}

export interface AdStat {
  spend: number;
  impressions: number;
  clicks: number;
  name: string | null;
}

export interface AdRow extends GroupRow {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  cps: number | null;
  roi: number | null;
}

/**
 * Добавить статистику рекламы: расход, показы, клики, CTR, цену клика, стоимость лида и продажи,
 * ROI = (прибыль − расход) / расход. Кампании с расходом, но без лидов в периоде, тоже попадают в отчёт.
 */
export function withSpend(rows: GroupRow[], stats: Map<string, AdStat> | null): AdRow[] {
  const all = [...rows];
  if (stats) {
    const known = new Set(rows.map((r) => r.key));
    for (const [key, s] of stats) {
      if (!known.has(key) && (s.spend > 0 || s.impressions > 0)) all.push({ key, name: s.name ?? key, leads: 0, sales: 0, conversion: null, revenue: 0, profit: 0 });
    }
  }
  return all
    .map((r) => {
      const s = stats?.get(r.key);
      const spend = stats ? round2(s?.spend ?? 0) : null;
      const impressions = stats ? s?.impressions ?? 0 : null;
      const clicks = stats ? s?.clicks ?? 0 : null;
      return {
        ...r,
        name: r.name === r.key && s?.name ? s.name : r.name,
        spend,
        impressions,
        clicks,
        ctr: impressions !== null && clicks !== null ? safeDiv(clicks, impressions) : null,
        cpc: spend !== null && clicks !== null ? safeDiv(spend, clicks) : null,
        cpl: spend !== null ? safeDiv(spend, r.leads) : null,
        cps: spend !== null ? safeDiv(spend, r.sales) : null,
        roi: spend ? (r.profit - spend) / spend : null,
      };
    })
    .sort((a, b) => b.leads - a.leads || (b.spend ?? 0) - (a.spend ?? 0) || a.name.localeCompare(b.name, "ru"));
}

// ——— Менеджеры ———

export interface ManagerRow {
  managerId: string;
  name: string;
  leads: number;
  inWork: number;
  sales: number;
  lost: number;
  conversion: number | null;
  revenue: number;
  profit: number;
  avgFirstResponseMin: number | null;
}

/**
 * @param leads лиды периода (назначенные менеджеру)
 * @param deals сделки, оплаченные в периоде (прибыль менеджера)
 */
export function calcManagers(leads: RLead[], deals: RDeal[], managers: { id: string; name: string }[], m: Money): ManagerRow[] {
  return managers
    .map((mg) => {
      const own = leads.filter((l) => l.managerId === mg.id);
      const sales = own.filter(isWon).length;
      const lost = own.filter((l) => l.statusKind === "LOST").length;
      const responses = own.filter((l) => l.firstResponseAt).map((l) => (l.firstResponseAt!.getTime() - l.createdAt.getTime()) / 60000);
      const myDeals = deals.filter((d) => d.managerId === mg.id);
      return {
        managerId: mg.id,
        name: mg.name,
        leads: own.length,
        inWork: own.length - sales - lost,
        sales,
        lost,
        conversion: safeDiv(sales, own.length),
        revenue: round2(myDeals.reduce((s, d) => s + dealRevenue(d, m), 0)),
        profit: round2(myDeals.reduce((s, d) => s + dealProfit(d, m), 0)),
        avgFirstResponseMin: responses.length ? round2(responses.reduce((a, b) => a + b, 0) / responses.length) : null,
      };
    })
    .filter((r) => r.leads > 0 || r.revenue > 0)
    .sort((a, b) => b.profit - a.profit || b.leads - a.leads);
}

// ——— Ряды по дням/неделям ———

/** Суммы по дням (или по неделям, если период длиннее 62 дней) */
export function timeSeries(items: { date: Date; value: number }[], from: Date, to: Date) {
  const DAY = 86_400_000;
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY));
  const bucket = days > 62 ? 7 : 1;
  const n = Math.ceil(days / bucket);
  const sums = new Array<number>(n).fill(0);
  for (const it of items) {
    const idx = Math.floor((it.date.getTime() - from.getTime()) / DAY / bucket);
    if (idx >= 0 && idx < n) sums[idx] += it.value;
  }
  return { bucket, points: sums.map((value, i) => ({ start: new Date(from.getTime() + i * bucket * DAY), value: round2(value) })) };
}

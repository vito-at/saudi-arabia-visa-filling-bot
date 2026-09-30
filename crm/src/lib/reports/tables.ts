/**
 * Табличное представление отчётов — одно и то же для экрана и для экспорта в Excel.
 */
import { prisma } from "@/lib/db";
import { getClientAggregates } from "@/lib/clients";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { getLossReasons, getManagers, getStatuses } from "@/lib/refs";
import {
  adKey,
  calcFunnel,
  calcLossMatrix,
  calcLossReasons,
  calcManagers,
  groupLeads,
  withSpend,
  type AdLevel,
} from "./calc";
import { loadDeals, loadLeads, loadSpend, money, previousPeriod, type ReportFilters } from "./data";
import { calcKpis, dealProfit, dealRevenue, delta, timeSeries, type Kpis } from "./calc";

export type ColType = "text" | "int" | "money" | "pct" | "minutes" | "date";
export interface Column {
  key: string;
  label: string;
  type: ColType;
}
export type Cell = string | number | null;
export interface Table {
  title: string;
  columns: Column[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>;
  note?: string;
}

export const REPORT_TABS = {
  dashboard: "Дашборд",
  clients: "По клиентам",
  funnel: "Воронка",
  losses: "Причины отказов",
  ads: "По рекламе",
  managers: "По менеджерам",
  services: "Услуги и направления",
} as const;
export type ReportTab = keyof typeof REPORT_TABS;

const pct = (a: number, b: number) => (b > 0 ? a / b : null);

export async function clientsTable(f: ReportFilters, opts: { limit?: number } = {}): Promise<Table> {
  const { rows, total } = await getClientAggregates({
    currency: f.currency,
    usdRate: f.rate,
    managerId: f.managerId && f.managerId !== "none" ? f.managerId : null,
    period: f.period,
    sort: "revenue",
    limit: opts.limit ?? 10000,
  });
  const sum = (k: "deals" | "revenue" | "cost" | "profit") => rows.reduce((s, r) => s + r[k], 0);
  return {
    title: "Клиенты со сделками в периоде",
    note: `Клиентов: ${total}. Сделки — по дате оплаты.`,
    columns: [
      { key: "name", label: "Клиент", type: "text" },
      { key: "phone", label: "Телефон", type: "text" },
      { key: "deals", label: "Сделок", type: "int" },
      { key: "revenue", label: "Выручка", type: "money" },
      { key: "cost", label: "Себестоимость", type: "money" },
      { key: "profit", label: "Прибыль", type: "money" },
      { key: "lastDealAt", label: "Последняя оплата", type: "date" },
    ],
    rows: rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, deals: r.deals, revenue: r.revenue, cost: r.cost, profit: r.profit, lastDealAt: r.lastDealAt ? formatDate(r.lastDealAt) : null })),
    totals: { name: "Итого", deals: sum("deals"), revenue: sum("revenue"), cost: sum("cost"), profit: sum("profit") },
  };
}

export async function funnelTable(f: ReportFilters) {
  const [leads, statuses] = await Promise.all([loadLeads(f.period, f.managerId), getStatuses()]);
  const funnel = calcFunnel(leads, statuses);
  const table: Table = {
    title: "Воронка продаж",
    note: `Лиды, созданные в периоде: ${funnel.total}. Лид считается дошедшим до шага, если побывал в нём или дальше. Отказались: ${funnel.lost}.`,
    columns: [
      { key: "name", label: "Этап", type: "text" },
      { key: "count", label: "Дошли до этапа", type: "int" },
      { key: "ofTotal", label: "% от всех лидов", type: "pct" },
      { key: "ofPrev", label: "% от предыдущего этапа", type: "pct" },
    ],
    rows: [
      ...funnel.steps.map((s) => ({ name: s.name, count: s.count, ofTotal: s.ofTotal, ofPrev: s.ofPrev })),
      { name: "Отказ (итог)", count: funnel.lost, ofTotal: pct(funnel.lost, funnel.total), ofPrev: null },
    ],
  };
  return { table, funnel };
}

export async function lossesTables(f: ReportFilters) {
  const [leads, reasons, managers] = await Promise.all([loadLeads(f.period, f.managerId), prisma.lossReason.findMany({ orderBy: { order: "asc" } }), getManagers()]);
  const { rows, total } = calcLossReasons(leads, reasons);
  const main: Table = {
    title: "Причины отказов",
    note: `Отказов среди лидов периода: ${total}`,
    columns: [
      { key: "name", label: "Причина", type: "text" },
      { key: "count", label: "Количество", type: "int" },
      { key: "share", label: "% от всех отказов", type: "pct" },
    ],
    rows: rows.map((r) => ({ name: r.name, count: r.count, share: r.share })),
    totals: { name: "Итого", count: total, share: total ? 1 : null },
  };
  // разбивки: строки — менеджеры/кампании, столбцы — причины (только встречающиеся)
  const used = reasons.filter((r) => rows.some((x) => x.reasonId === r.id));
  const reasonCols: Column[] = used.map((r) => ({ key: r.id, label: r.name, type: "int" }));
  const mNames = new Map(managers.map((m) => [m.id, m.name]));
  const byManager = calcLossMatrix(leads, "managerId");
  const byCampaign = calcLossMatrix(leads, "campaignId");
  const campNames = new Map(leads.filter((l) => l.campaignId).map((l) => [l.campaignId!, l.campaignName ?? l.campaignId!]));
  const matrix = (title: string, first: string, m: typeof byManager, names: Map<string, string>, noneLabel: string): Table => ({
    title,
    columns: [{ key: "name", label: first, type: "text" }, { key: "total", label: "Всего отказов", type: "int" }, ...reasonCols],
    rows: [...m.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([k, v]) => ({ name: k === "none" ? noneLabel : names.get(k) ?? k, total: v.total, ...Object.fromEntries(used.map((r) => [r.id, v.byReason.get(r.id) ?? 0])) })),
  });
  return {
    main,
    rows,
    total,
    byManager: matrix("Отказы по менеджерам", "Менеджер", byManager, mNames, "Не назначен"),
    byCampaign: matrix("Отказы по кампаниям", "Кампания", byCampaign, campNames, "Без рекламы (звонки, Direct, Telegram)"),
  };
}

export const AD_LEVELS: Record<AdLevel, string> = { campaign: "Кампании", adset: "Группы объявлений", ad: "Объявления", form: "Формы" };

export async function adsTable(f: ReportFilters, level: AdLevel): Promise<Table> {
  const leads = await loadLeads(f.period, f.managerId);
  const m = money(f);
  const groups = groupLeads(leads, adKey(level), m);
  const spend = level === "form" || (f.managerId && f.managerId !== "none") ? null : await loadSpend(f.period, level, f);
  const rows = withSpend(groups, spend);
  const noAds = leads.filter((l) => !adKey(level)(l)).length;
  const t = (k: "leads" | "sales" | "revenue" | "profit") => rows.reduce((s, r) => s + r[k], 0);
  const totalSpend = spend ? rows.reduce((s, r) => s + (r.spend ?? 0), 0) : null;
  const cols: Column[] = [
    { key: "name", label: { campaign: "Кампания", adset: "Группа объявлений", ad: "Объявление", form: "Форма" }[level], type: "text" },
    { key: "leads", label: "Лидов", type: "int" },
    { key: "sales", label: "Продаж", type: "int" },
    { key: "conversion", label: "Конверсия", type: "pct" },
    { key: "revenue", label: "Выручка", type: "money" },
    { key: "profit", label: "Прибыль", type: "money" },
  ];
  if (spend) cols.push({ key: "spend", label: "Расход", type: "money" }, { key: "cpl", label: "Цена лида", type: "money" }, { key: "cps", label: "Цена продажи", type: "money" }, { key: "roi", label: "ROI", type: "pct" });
  return {
    title: `Реклама — ${AD_LEVELS[level].toLowerCase()}`,
    note: `Лиды из рекламы, созданные в периоде, и все их сделки (в том числе оплаченные позже). Лидов не из рекламы: ${noAds}.${spend ? " ROI = (прибыль − расход) / расход." : level !== "form" ? " Расходы появятся после подключения Marketing API в настройках." : ""}`,
    columns: cols,
    rows: rows.map((r) => ({ ...r })),
    totals: {
      name: "Итого",
      leads: t("leads"),
      sales: t("sales"),
      conversion: pct(t("sales"), t("leads")),
      revenue: t("revenue"),
      profit: t("profit"),
      ...(totalSpend !== null ? { spend: totalSpend, cpl: pct(totalSpend, t("leads")), cps: pct(totalSpend, t("sales")), roi: totalSpend ? (t("profit") - totalSpend) / totalSpend : null } : {}),
    },
  };
}

export async function managersTable(f: ReportFilters) {
  const [leads, deals, users] = await Promise.all([loadLeads(f.period, f.managerId), loadDeals(f.period, f.managerId), getManagers()]);
  const rows = calcManagers(leads, deals, users, money(f));
  const table: Table = {
    title: "Менеджеры",
    note: "Лиды — созданные в периоде; выручка и прибыль — по сделкам, оплаченным в периоде; время реакции — от создания лида до первого действия.",
    columns: [
      { key: "name", label: "Менеджер", type: "text" },
      { key: "leads", label: "Лидов", type: "int" },
      { key: "inWork", label: "В работе", type: "int" },
      { key: "sales", label: "Продаж", type: "int" },
      { key: "lost", label: "Отказов", type: "int" },
      { key: "conversion", label: "Конверсия", type: "pct" },
      { key: "revenue", label: "Выручка", type: "money" },
      { key: "profit", label: "Прибыль", type: "money" },
      { key: "avgFirstResponseMin", label: "Первая реакция (сред.)", type: "minutes" },
    ],
    rows: rows.map((r) => ({ ...r })),
  };
  return { table, rows };
}

export async function servicesTables(f: ReportFilters) {
  const leads = await loadLeads(f.period, f.managerId);
  const m = money(f);
  const cols = (first: string): Column[] => [
    { key: "name", label: first, type: "text" },
    { key: "leads", label: "Лидов", type: "int" },
    { key: "sales", label: "Продаж", type: "int" },
    { key: "conversion", label: "Конверсия", type: "pct" },
    { key: "revenue", label: "Выручка", type: "money" },
    { key: "profit", label: "Прибыль", type: "money" },
  ];
  const services = groupLeads(leads, (l) => ({ key: l.serviceType ?? "none", name: l.serviceType ? SERVICE_LABELS[l.serviceType as keyof typeof SERVICE_LABELS] : "Не указан" }), m);
  const dests = groupLeads(
    leads,
    (l) => {
      const d = l.destination?.trim();
      return d ? { key: d.toLowerCase(), name: d } : { key: "none", name: "Не указано" };
    },
    m,
  );
  return {
    services: { title: "Типы услуг", note: "Лиды периода и все их сделки", columns: cols("Тип услуги"), rows: services.map((r) => ({ ...r })) } as Table,
    destinations: { title: "Направления", columns: cols("Направление"), rows: dests.map((r) => ({ ...r })) } as Table,
    servicesRows: services,
  };
}

export { getLossReasons };

// ——— Дашборд ———


export async function dashboardData(f: ReportFilters) {
  const prev = previousPeriod(f.period);
  const m = money(f);
  const [leads, deals, pLeads, pDeals] = await Promise.all([
    loadLeads(f.period, f.managerId),
    loadDeals(f.period, f.managerId),
    loadLeads(prev, f.managerId),
    loadDeals(prev, f.managerId),
  ]);
  const cur = calcKpis(leads, deals, m);
  const was = calcKpis(pLeads, pDeals, m);
  const keys: (keyof Kpis)[] = ["leads", "sales", "conversion", "revenue", "profit", "avgCheck"];
  const deltas = Object.fromEntries(keys.map((k) => [k, delta(cur[k], was[k])])) as Record<keyof Kpis, number | null>;
  const leadSeries = timeSeries(leads.map((l) => ({ date: l.createdAt, value: 1 })), f.period.from, f.period.to);
  const rev = timeSeries(deals.map((d) => ({ date: d.paidAt, value: dealRevenue(d, m) })), f.period.from, f.period.to);
  const prof = timeSeries(deals.map((d) => ({ date: d.paidAt, value: dealProfit(d, m) })), f.period.from, f.period.to);
  return { cur, was, deltas, prev, leadSeries, money: rev.points.map((p, i) => ({ start: p.start, revenue: p.value, profit: prof.points[i].value })), bucket: rev.bucket };
}

export async function dashboardTables(f: ReportFilters): Promise<Table[]> {
  const d = await dashboardData(f);
  const rows: [string, keyof Kpis, "int" | "money" | "pct"][] = [
    ["Лидов", "leads", "int"],
    ["Продаж (лиды периода в статусе «Продано»)", "sales", "int"],
    ["Конверсия в продажу", "conversion", "pct"],
    ["Выручка (оплаты в периоде)", "revenue", "money"],
    ["Прибыль", "profit", "money"],
    ["Средний чек", "avgCheck", "money"],
  ];
  return [
    {
      title: "Показатели",
      note: `Прошлый период: ${formatDate(d.prev.from)} — ${formatDate(new Date(d.prev.to.getTime() - 1))}`,
      columns: [
        { key: "name", label: "Показатель", type: "text" },
        { key: "cur", label: "Текущий период", type: "text" },
        { key: "prev", label: "Прошлый период", type: "text" },
        { key: "delta", label: "Изменение", type: "pct" },
      ],
      rows: rows.map(([name, k, type]) => {
        const fmt = (v: number | null) => (v === null ? null : type === "pct" ? `${(v * 100).toFixed(1)}%` : type === "money" ? `${v.toFixed(2)} ${f.currency}` : String(v));
        return { name, cur: fmt(d.cur[k]), prev: fmt(d.was[k]), delta: d.deltas[k] };
      }),
    },
    {
      title: d.bucket === 7 ? "По неделям" : "По дням",
      columns: [
        { key: "date", label: d.bucket === 7 ? "Неделя с" : "Дата", type: "date" },
        { key: "leads", label: "Лидов", type: "int" },
        { key: "revenue", label: "Выручка", type: "money" },
        { key: "profit", label: "Прибыль", type: "money" },
      ],
      rows: d.leadSeries.points.map((p, i) => ({ date: formatDate(p.start), leads: p.value, revenue: d.money[i].revenue, profit: d.money[i].profit })),
    },
  ];
}

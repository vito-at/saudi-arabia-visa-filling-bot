/**
 * Табличное представление отчётов — одно и то же для экрана и для экспорта в Excel.
 */
import { prisma } from "@/lib/db";
import { getClientAggregates } from "@/lib/clients";
import { reasonName, serviceLabel, statusName } from "@/i18n/labels";
import type { TKey } from "@/i18n/core";
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
  dashboard: "reports.tab.dashboard",
  clients: "reports.tab.clients",
  funnel: "reports.tab.funnel",
  losses: "reports.tab.losses",
  ads: "reports.tab.ads",
  managers: "reports.tab.managers",
  services: "reports.tab.services",
} as const satisfies Record<string, TKey>;
export type ReportTab = keyof typeof REPORT_TABS;

const pct = (a: number, b: number) => (b > 0 ? a / b : null);

export async function clientsTable(f: ReportFilters, opts: { limit?: number } = {}): Promise<Table> {
  const { t } = f;
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
    title: t("rt.clients.title"),
    note: t("rt.clients.note", { n: total }),
    columns: [
      { key: "name", label: t("rt.col.client"), type: "text" },
      { key: "phone", label: t("rt.col.phone"), type: "text" },
      { key: "deals", label: t("rt.col.deals"), type: "int" },
      { key: "revenue", label: t("rt.col.revenue"), type: "money" },
      { key: "cost", label: t("rt.col.cost"), type: "money" },
      { key: "profit", label: t("rt.col.profit"), type: "money" },
      { key: "lastDealAt", label: t("rt.col.lastPaid"), type: "date" },
    ],
    rows: rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, deals: r.deals, revenue: r.revenue, cost: r.cost, profit: r.profit, lastDealAt: r.lastDealAt ? formatDate(r.lastDealAt) : null })),
    totals: { name: t("rt.total"), deals: sum("deals"), revenue: sum("revenue"), cost: sum("cost"), profit: sum("profit") },
  };
}

export async function funnelTable(f: ReportFilters) {
  const { t } = f;
  const [leads, statusRows] = await Promise.all([loadLeads(f.period, f.managerId), getStatuses()]);
  const statuses = statusRows.map((s) => ({ ...s, name: statusName(t, s.name) }));
  const funnel = calcFunnel(leads, statuses);
  const table: Table = {
    title: t("rt.funnel.title"),
    note: t("rt.funnel.note", { total: funnel.total, lost: funnel.lost }),
    columns: [
      { key: "name", label: t("rt.funnel.stage"), type: "text" },
      { key: "count", label: t("rt.funnel.reached"), type: "int" },
      { key: "ofTotal", label: t("rt.funnel.ofTotal"), type: "pct" },
      { key: "ofPrev", label: t("rt.funnel.ofPrev"), type: "pct" },
    ],
    rows: [
      ...funnel.steps.map((s) => ({ name: s.name, count: s.count, ofTotal: s.ofTotal, ofPrev: s.ofPrev })),
      { name: t("rt.funnel.lost"), count: funnel.lost, ofTotal: pct(funnel.lost, funnel.total), ofPrev: null },
    ],
  };
  return { table, funnel };
}

export async function lossesTables(f: ReportFilters) {
  const { t } = f;
  const [leads, reasonRows, managers] = await Promise.all([loadLeads(f.period, f.managerId), prisma.lossReason.findMany({ orderBy: { order: "asc" } }), getManagers()]);
  const reasons = reasonRows.map((r) => ({ ...r, name: reasonName(t, r.name) }));
  const { rows, total } = calcLossReasons(leads, reasons, t("rt.losses.noReason"));
  const main: Table = {
    title: t("rt.losses.title"),
    note: t("rt.losses.note", { n: total }),
    columns: [
      { key: "name", label: t("rt.losses.reason"), type: "text" },
      { key: "count", label: t("rt.losses.count"), type: "int" },
      { key: "share", label: t("rt.losses.share"), type: "pct" },
    ],
    rows: rows.map((r) => ({ name: r.name, count: r.count, share: r.share })),
    totals: { name: t("rt.total"), count: total, share: total ? 1 : null },
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
    columns: [{ key: "name", label: first, type: "text" }, { key: "total", label: t("rt.losses.total"), type: "int" }, ...reasonCols],
    rows: [...m.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([k, v]) => ({ name: k === "none" ? noneLabel : names.get(k) ?? k, total: v.total, ...Object.fromEntries(used.map((r) => [r.id, v.byReason.get(r.id) ?? 0])) })),
  });
  return {
    main,
    rows,
    total,
    byManager: matrix(t("rt.losses.byManager"), t("rt.losses.manager"), byManager, mNames, t("rt.losses.unassigned")),
    byCampaign: matrix(t("rt.losses.byCampaign"), t("rt.losses.campaign"), byCampaign, campNames, t("rt.losses.noAds")),
  };
}

export const AD_LEVELS: Record<AdLevel, TKey> = { campaign: "rt.ads.levels.campaign", adset: "rt.ads.levels.adset", ad: "rt.ads.levels.ad", form: "rt.ads.levels.form" };

export async function adsTable(f: ReportFilters, level: AdLevel): Promise<Table> {
  const { t } = f;
  const leads = await loadLeads(f.period, f.managerId);
  const m = money(f);
  const groups = groupLeads(leads, adKey(level), m);
  const spend = level === "form" || (f.managerId && f.managerId !== "none") ? null : await loadSpend(f.period, level, f);
  const rows = withSpend(groups, spend);
  const noAds = leads.filter((l) => !adKey(level)(l)).length;
  const tot = (k: "leads" | "sales" | "revenue" | "profit") => rows.reduce((s, r) => s + r[k], 0);
  const totalSpend = spend ? rows.reduce((s, r) => s + (r.spend ?? 0), 0) : null;
  const totalImpr = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const nameCol: Column = { key: "name", label: t(({ campaign: "rt.ads.col.campaign", adset: "rt.ads.col.adset", ad: "rt.ads.col.ad", form: "rt.ads.col.form" } as const)[level]), type: "text" };
  const cols: Column[] = spend
    ? [
        nameCol,
        { key: "spend", label: t("rt.col.spend"), type: "money" },
        { key: "impressions", label: t("rt.col.impressions"), type: "int" },
        { key: "clicks", label: t("rt.col.clicks"), type: "int" },
        { key: "ctr", label: t("rt.col.ctr"), type: "pct" },
        { key: "cpc", label: t("rt.col.cpc"), type: "money" },
        { key: "leads", label: t("rt.col.leads"), type: "int" },
        { key: "cpl", label: t("rt.col.cpl"), type: "money" },
        { key: "sales", label: t("rt.col.sales"), type: "int" },
        { key: "conversion", label: t("rt.col.conversion"), type: "pct" },
        { key: "cps", label: t("rt.col.cps"), type: "money" },
        { key: "revenue", label: t("rt.col.revenue"), type: "money" },
        { key: "profit", label: t("rt.col.profit"), type: "money" },
        { key: "roi", label: t("rt.col.roi"), type: "pct" },
      ]
    : [
        nameCol,
        { key: "leads", label: t("rt.col.leads"), type: "int" },
        { key: "sales", label: t("rt.col.sales"), type: "int" },
        { key: "conversion", label: t("rt.col.conversion"), type: "pct" },
        { key: "revenue", label: t("rt.col.revenue"), type: "money" },
        { key: "profit", label: t("rt.col.profit"), type: "money" },
      ];
  return {
    title: t("rt.ads.title", { level: t(AD_LEVELS[level]).toLowerCase() }),
    note: `${t("rt.ads.note", { n: noAds })}${spend ? ` ${t("rt.ads.roiNote")}` : level !== "form" ? ` ${t("rt.ads.noSpend")}` : ""}`,
    columns: cols,
    rows: rows.map((r) => ({ ...r })),
    totals: {
      name: t("rt.total"),
      leads: tot("leads"),
      sales: tot("sales"),
      conversion: pct(tot("sales"), tot("leads")),
      revenue: tot("revenue"),
      profit: tot("profit"),
      ...(totalSpend !== null
        ? {
            spend: totalSpend,
            impressions: totalImpr,
            clicks: totalClicks,
            ctr: pct(totalClicks, totalImpr),
            cpc: pct(totalSpend, totalClicks),
            cpl: pct(totalSpend, tot("leads")),
            cps: pct(totalSpend, tot("sales")),
            roi: totalSpend ? (tot("profit") - totalSpend) / totalSpend : null,
          }
        : {}),
    },
  };
}

export async function managersTable(f: ReportFilters) {
  const { t } = f;
  const [leads, deals, users] = await Promise.all([loadLeads(f.period, f.managerId), loadDeals(f.period, f.managerId), getManagers()]);
  const rows = calcManagers(leads, deals, users, money(f));
  const table: Table = {
    title: t("rt.managers.title"),
    note: t("rt.managers.note"),
    columns: [
      { key: "name", label: t("rt.managers.manager"), type: "text" },
      { key: "leads", label: t("rt.col.leads"), type: "int" },
      { key: "inWork", label: t("rt.managers.inWork"), type: "int" },
      { key: "sales", label: t("rt.col.sales"), type: "int" },
      { key: "lost", label: t("rt.managers.lost"), type: "int" },
      { key: "conversion", label: t("rt.col.conversion"), type: "pct" },
      { key: "revenue", label: t("rt.col.revenue"), type: "money" },
      { key: "profit", label: t("rt.col.profit"), type: "money" },
      { key: "avgFirstResponseMin", label: t("rt.managers.response"), type: "minutes" },
    ],
    rows: rows.map((r) => ({ ...r })),
  };
  return { table, rows };
}

export async function servicesTables(f: ReportFilters) {
  const { t } = f;
  const leads = await loadLeads(f.period, f.managerId);
  const m = money(f);
  const cols = (first: string): Column[] => [
    { key: "name", label: first, type: "text" },
    { key: "leads", label: t("rt.col.leads"), type: "int" },
    { key: "sales", label: t("rt.col.sales"), type: "int" },
    { key: "conversion", label: t("rt.col.conversion"), type: "pct" },
    { key: "revenue", label: t("rt.col.revenue"), type: "money" },
    { key: "profit", label: t("rt.col.profit"), type: "money" },
  ];
  const services = groupLeads(leads, (l) => ({ key: l.serviceType ?? "none", name: l.serviceType ? serviceLabel(t, l.serviceType) : t("rt.services.noService") }), m);
  const dests = groupLeads(
    leads,
    (l) => {
      const d = l.destination?.trim();
      return d ? { key: d.toLowerCase(), name: d } : { key: "none", name: t("rt.services.noDest") };
    },
    m,
  );
  return {
    services: { title: t("rt.services.title"), note: t("rt.services.note"), columns: cols(t("rt.services.service")), rows: services.map((r) => ({ ...r })) } as Table,
    destinations: { title: t("rt.services.destTitle"), columns: cols(t("rt.services.destination")), rows: dests.map((r) => ({ ...r })) } as Table,
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
  const { t } = f;
  const d = await dashboardData(f);
  const rows: [TKey, keyof Kpis, "int" | "money" | "pct"][] = [
    ["rt.dash.leads", "leads", "int"],
    ["rt.dash.sales", "sales", "int"],
    ["rt.dash.conversion", "conversion", "pct"],
    ["rt.dash.revenue", "revenue", "money"],
    ["rt.dash.profit", "profit", "money"],
    ["rt.dash.avgCheck", "avgCheck", "money"],
  ];
  return [
    {
      title: t("rt.dash.title"),
      note: t("rt.dash.prev", { from: formatDate(d.prev.from), to: formatDate(new Date(d.prev.to.getTime() - 1)) }),
      columns: [
        { key: "name", label: t("rt.dash.metric"), type: "text" },
        { key: "cur", label: t("rt.dash.current"), type: "text" },
        { key: "prev", label: t("rt.dash.previous"), type: "text" },
        { key: "delta", label: t("rt.dash.change"), type: "pct" },
      ],
      rows: rows.map(([name, k, type]) => {
        const fmt = (v: number | null) => (v === null ? null : type === "pct" ? `${(v * 100).toFixed(1)}%` : type === "money" ? `${v.toFixed(2)} ${f.currency}` : String(v));
        return { name: t(name), cur: fmt(d.cur[k]), prev: fmt(d.was[k]), delta: d.deltas[k] };
      }),
    },
    {
      title: t(d.bucket === 7 ? "rt.dash.byWeek" : "rt.dash.byDay"),
      columns: [
        { key: "date", label: t(d.bucket === 7 ? "rt.dash.weekFrom" : "rt.dash.date"), type: "date" },
        { key: "leads", label: t("rt.col.leads"), type: "int" },
        { key: "revenue", label: t("rt.col.revenue"), type: "money" },
        { key: "profit", label: t("rt.col.profit"), type: "money" },
      ],
      rows: d.leadSeries.points.map((p, i) => ({ date: formatDate(p.start), leads: p.value, revenue: d.money[i].revenue, profit: d.money[i].profit })),
    },
  ];
}

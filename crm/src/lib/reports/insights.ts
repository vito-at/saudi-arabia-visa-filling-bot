/**
 * Авто-выводы по периоду: откуда лучше покупают, что быстрее закрывается, главная причина отказов,
 * лучший менеджер и динамика к прошлому периоду. Только факты с достаточной выборкой, без «шума».
 */
import { getLossReasons, getManagers, getSettings, getStatuses } from "@/lib/refs";
import { leadSourceLabel, reasonName } from "@/i18n/labels";
import { formatters } from "@/i18n/core";
import { calcKpis, calcManagers, calcStageTimes, delta, isWon, type RLead } from "./calc";
import { loadDeals, loadLeads, money, previousPeriod, type ReportFilters } from "./data";
import { scheduleOf } from "@/lib/work-hours";

export interface Insight {
  tone: "good" | "bad" | "info";
  text: string;
}

const MIN_LEADS = 5;

export async function buildInsights(f: ReportFilters): Promise<Insight[]> {
  const { t } = f;
  const fm = formatters(f.locale);
  const prev = previousPeriod(f.period);
  const [leads, deals, pLeads, pDeals, statuses, reasons, managers, settings] = await Promise.all([
    loadLeads(f.period, f.managerId),
    loadDeals(f.period, f.managerId),
    loadLeads(prev, f.managerId),
    loadDeals(prev, f.managerId),
    getStatuses(),
    getLossReasons(),
    getManagers(),
    getSettings(),
  ]);
  const out: Insight[] = [];
  if (!leads.length) return out;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  // динамика к прошлому периоду
  const cur = calcKpis(leads, deals, money(f));
  const was = calcKpis(pLeads, pDeals, money(f));
  const dLeads = delta(cur.leads, was.leads);
  if (dLeads !== null && Math.abs(dLeads) >= 0.1) out.push({ tone: dLeads > 0 ? "good" : "bad", text: t(dLeads > 0 ? "insight.leadsUp" : "insight.leadsDown", { p: pct(Math.abs(dLeads)), n: cur.leads, was: was.leads }) });
  const dConv = cur.conversion !== null && was.conversion !== null ? cur.conversion - was.conversion : null;
  if (dConv !== null && Math.abs(dConv) >= 0.03 && cur.leads >= MIN_LEADS)
    out.push({ tone: dConv > 0 ? "good" : "bad", text: t(dConv > 0 ? "insight.convUp" : "insight.convDown", { cur: pct(cur.conversion!), was: pct(was.conversion!) }) });

  // источники: конверсия, доля продаж, срок до продажи
  const bySource = new Map<string, RLead[]>();
  for (const l of leads) {
    const key = leadSourceLabel(t, { source: l.source ?? "OTHER", isOrganic: null });
    bySource.set(key, [...(bySource.get(key) ?? []), l]);
  }
  const sources = [...bySource].map(([name, list]) => ({ name, n: list.length, sales: list.filter(isWon).length, times: calcStageTimes(list, statuses) }));
  const totalSales = sources.reduce((s, x) => s + x.sales, 0);
  const best = sources.filter((s) => s.n >= MIN_LEADS && s.sales > 0).sort((a, b) => b.sales / b.n - a.sales / a.n)[0];
  if (best && sources.filter((s) => s.n >= MIN_LEADS).length > 1) out.push({ tone: "good", text: t("insight.bestSource", { name: best.name, p: pct(best.sales / best.n), sales: best.sales, n: best.n }) });
  const top = [...sources].sort((a, b) => b.sales - a.sales)[0];
  if (top && totalSales >= 3) out.push({ tone: "info", text: t("insight.topSource", { name: top.name, p: pct(top.sales / totalSales), sales: top.sales }) });
  const fastest = sources.filter((s) => s.times.sold >= 2 && s.times.toSaleMin !== null).sort((a, b) => a.times.toSaleMin! - b.times.toSaleMin!)[0];
  if (fastest && sources.filter((s) => s.times.sold >= 2).length > 1) out.push({ tone: "info", text: t("insight.fastest", { name: fastest.name, time: fm.duration(fastest.times.toSaleMin) }) });
  const weak = sources.filter((s) => s.n >= MIN_LEADS * 2 && s.sales === 0).sort((a, b) => b.n - a.n)[0];
  if (weak) out.push({ tone: "bad", text: t("insight.noSales", { name: weak.name, n: weak.n }) });

  // главная причина отказов
  const lost = leads.filter((l) => l.statusKind === "LOST" && l.lossReasonId);
  if (lost.length >= 3) {
    const counts = new Map<string, number>();
    for (const l of lost) counts.set(l.lossReasonId!, (counts.get(l.lossReasonId!) ?? 0) + 1);
    const [rid, cnt] = [...counts].sort((a, b) => b[1] - a[1])[0];
    const r = reasons.find((x) => x.id === rid);
    if (r) out.push({ tone: "bad", text: t("insight.topLoss", { name: reasonName(t, r.name), p: pct(cnt / lost.length), n: cnt }) });
  }

  // менеджеры: лучшая конверсия и самый медленный ответ (только у администратора — при фильтре по менеджеру сравнивать не с кем)
  if (!f.managerId) {
    const rows = calcManagers(leads, deals, managers, money(f), scheduleOf(settings)).filter((r) => r.leads >= MIN_LEADS);
    const bestM = [...rows].filter((r) => r.conversion !== null && r.sales > 0).sort((a, b) => b.conversion! - a.conversion!)[0];
    if (bestM && rows.length > 1) out.push({ tone: "good", text: t("insight.bestManager", { name: bestM.name, p: pct(bestM.conversion!) }) });
    const slow = [...rows].filter((r) => r.medianFirstResponseMin !== null).sort((a, b) => b.medianFirstResponseMin! - a.medianFirstResponseMin!)[0];
    if (slow && rows.length > 1 && slow.medianFirstResponseMin! > 15) out.push({ tone: "bad", text: t("insight.slowManager", { name: slow.name, time: fm.duration(slow.medianFirstResponseMin) }) });
  }
  return out;
}

/**
 * Планы менеджеров и зарплата за месяц.
 * Факт: лиды, назначенные менеджеру и созданные в месяце; продажи — количество в сделках, оплаченных в месяце;
 * прибыль — по этим сделкам (выручка − себестоимость, по курсам дня оплаты).
 * Зарплата = оклад + прибыль × (процент + надбавка, если план по прибыли выполнен) − штрафы за опоздания.
 */
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseInputDate } from "@/lib/format";
import { round2, toNum } from "@/lib/money";
import { getSettings } from "@/lib/refs";
import { loadRateBook } from "@/lib/rate-history";
import { dealProfit } from "@/lib/reports/calc";

export interface MonthRange {
  ym: string;
  from: Date;
  to: Date;
}

/** «2026-10» → границы месяца по Ташкенту; неверное значение — текущий месяц */
export function monthRange(ym: string | null | undefined, now = new Date()): MonthRange {
  const cur = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit" }).format(now).slice(0, 7);
  const v = ym && /^\d{4}-(0[1-9]|1[0-2])$/.test(ym) ? ym : cur;
  const [y, m] = v.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { ym: v, from: parseInputDate(`${v}-01`)!, to: parseInputDate(`${next}-01`)! };
}

/** Ключ месяца для колонки @db.Date: первое число по UTC (Prisma сохраняет дату по UTC) */
export const monthKey = (ym: string) => new Date(`${ym}-01T00:00:00Z`);

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const i = y * 12 + (m - 1) + delta;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export interface SalaryTerms {
  base: number;
  currency: Currency;
  pct: number;
  bonusPct: number;
}

export interface PlanValues {
  leads: number | null;
  sales: number | null;
  /** в долларах */
  profit: number | null;
}

export interface PlanFact {
  leads: number;
  sales: number;
  /** прибыль в долларах — для сравнения с планом */
  profitUsd: number;
  /** прибыль в валюте зарплаты — для комиссии */
  profitSalary: number;
}

export interface PayoutRow {
  plan: PlanValues;
  fact: PlanFact;
  /** выполнение плана 0..1+ (null — план не задан) */
  done: { leads: number | null; sales: number | null; profit: number | null };
  planMet: boolean;
  ratePct: number;
  commission: number;
  base: number;
  /** штрафы за опоздания в валюте зарплаты */
  fines: number;
  total: number;
  currency: Currency;
}

const ratio = (fact: number, plan: number | null) => (plan && plan > 0 ? fact / plan : null);

/** Чистая функция расчёта — покрыта тестом */
export function calcPayout(terms: SalaryTerms, plan: PlanValues, fact: PlanFact, fines = 0): PayoutRow {
  const done = { leads: ratio(fact.leads, plan.leads), sales: ratio(fact.sales, plan.sales), profit: ratio(fact.profitUsd, plan.profit) };
  const planMet = done.profit !== null && done.profit >= 1;
  const ratePct = terms.pct + (planMet ? terms.bonusPct : 0);
  // убыточный месяц не уменьшает оклад
  const commission = round2((Math.max(0, fact.profitSalary) * ratePct) / 100);
  const f = round2(Math.max(0, fines));
  return { plan, fact, done, planMet, ratePct, commission, base: terms.base, fines: f, total: round2(Math.max(0, terms.base + commission - f)), currency: terms.currency };
}

export interface ManagerMonth extends PayoutRow {
  userId: string;
  name: string;
  terms: SalaryTerms;
}

/** Планы, факт и зарплата менеджеров за месяц (managerId — только один) */
export async function loadManagerMonths(range: MonthRange, managerId: string | null): Promise<ManagerMonth[]> {
  const settings = await getSettings();
  const book = await loadRateBook(settings);
  const rate = toNum(settings.usdRate);
  const costRate = toNum(settings.usdRateCost);
  const users = await prisma.user.findMany({
    where: { role: "MANAGER", ...(managerId ? { id: managerId } : { isActive: true }) },
    orderBy: { name: "asc" },
    include: { plans: { where: { month: monthKey(range.ym) } } },
  });
  const ids = users.map((u) => u.id);
  const [leads, deals, fines] = await Promise.all([
    prisma.lead.groupBy({ by: ["managerId"], where: { managerId: { in: ids }, createdAt: { gte: range.from, lt: range.to } }, _count: { _all: true } }),
    prisma.deal.findMany({
      where: { managerId: { in: ids }, paidAt: { gte: range.from, lt: range.to } },
      select: { managerId: true, amount: true, cost: true, currency: true, costCurrency: true, paidAt: true, quantity: true },
    }),
    // штрафы хранятся в сумах; дни посещаемости — ключи @db.Date
    prisma.attendance.groupBy({ by: ["userId"], where: { userId: { in: ids }, day: { gte: monthKey(range.ym), lt: monthKey(shiftMonth(range.ym, 1)) } }, _sum: { fine: true } }),
  ]);
  return users.map((u) => {
    const own = deals.filter((d) => d.managerId === u.id).map((d) => ({ ...d, amount: toNum(d.amount), cost: toNum(d.cost) }));
    const terms: SalaryTerms = { base: toNum(u.salaryBase), currency: u.salaryCurrency, pct: toNum(u.commissionPct), bonusPct: toNum(u.planBonusPct) };
    const profitIn = (currency: Currency) => round2(own.reduce((s, d) => s + dealProfit(d, { currency, rate, costRate, book }), 0));
    const fact: PlanFact = {
      leads: leads.find((l) => l.managerId === u.id)?._count._all ?? 0,
      sales: own.reduce((s, d) => s + d.quantity, 0),
      profitUsd: profitIn("USD"),
      profitSalary: profitIn(terms.currency),
    };
    const p = u.plans[0];
    const plan: PlanValues = { leads: p?.leads ?? null, sales: p?.sales ?? null, profit: p?.profit === null || p?.profit === undefined ? null : toNum(p.profit) };
    const fineUzs = toNum(fines.find((x) => x.userId === u.id)?._sum.fine);
    const fineSalary = terms.currency === "USD" ? (rate > 0 ? fineUzs / rate : 0) : fineUzs;
    return { userId: u.id, name: u.name, terms, ...calcPayout(terms, plan, fact, fineSalary) };
  });
}

/**
 * Планы менеджеров и зарплата за месяц.
 * Факт: лиды, назначенные менеджеру и созданные в месяце; продажи — количество в сделках, оплаченных в месяце;
 * сумма продаж и прибыль — по этим сделкам (по курсам дня оплаты).
 * Зарплата = оклад + сумма продаж (или прибыль — задаётся у менеджера) × (процент + надбавка, если план по прибыли выполнен).
 * По умолчанию: 1 500 000 сум + 5% от суммы продаж.
 * Авиабилеты — отдельно: процент от чистой прибыли (flightPoolPct, 30%) делится поровну между менеджерами, работавшими
 * в день продажи (двое — по 15%, одна — 30%), и каждая получает свою долю только с билетов, проданных ею самой.
 * Работала в день — включала «В работе» (при автораспределении) или что-то делала в CRM: меняла лиды, писала
 * комментарии или клиентам, закрывала сделки (см. activityDays) — так доля делится и при ручном распределении.
 * Остальные услуги — оклад + процент от продаж/прибыли, как выше; авиабилеты в эту базу не входят.
 * Учёт зарплаты в CRM начинается с «salaryStartAt» (настройки): учитываются только сделки, оплаченные с этого момента,
 * а месяцы целиком до него не считаются (расчёты за них вели вне CRM). Выплаты — частями, «Осталось» = к выплате − выплачено.
 */
import { Prisma, type CommissionBase, type Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseInputDate } from "@/lib/format";
import { round2, toNum } from "@/lib/money";
import { getSettings } from "@/lib/refs";
import { loadRateBook } from "@/lib/rate-history";
import { dealProfit, dealRevenue } from "@/lib/reports/calc";
import { UZS_DEAL_MIN, USD_DEAL_MAX } from "@/lib/deals";
import { toInputDate } from "@/lib/format";

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
  /** процент — от суммы продаж или от прибыли */
  from: CommissionBase;
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
  /** прибыль в валюте зарплаты без авиабилетов — для комиссии от прибыли */
  profitSalary: number;
  /** сумма продаж в долларах — для показа */
  revenueUsd: number;
  /** сумма продаж в валюте зарплаты без авиабилетов — для комиссии от продаж */
  revenueSalary: number;
  /** прибыль с проданных авиабилетов (валюта зарплаты) */
  flightProfitSalary: number;
  /** доля с прибыли авиабилетов (валюта зарплаты) — см. flightShares */
  flightCommission: number;
  /** сделки, у которых администратор ещё не указал себестоимость: их прибыль не идёт в план и комиссию от прибыли */
  pendingCost?: number;
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
  total: number;
  currency: Currency;
}

const ratio = (fact: number, plan: number | null) => (plan && plan > 0 ? fact / plan : null);

/** Чистая функция расчёта — покрыта тестом */
export function calcPayout(terms: SalaryTerms, plan: PlanValues, fact: PlanFact): PayoutRow {
  const done = { leads: ratio(fact.leads, plan.leads), sales: ratio(fact.sales, plan.sales), profit: ratio(fact.profitUsd, plan.profit) };
  const planMet = done.profit !== null && done.profit >= 1;
  const ratePct = terms.pct + (planMet ? terms.bonusPct : 0);
  // убыточный месяц не уменьшает оклад
  const basis = terms.from === "PROFIT" ? fact.profitSalary : fact.revenueSalary;
  const commission = round2((Math.max(0, basis) * ratePct) / 100 + Math.max(0, fact.flightCommission));
  return { plan, fact, done, planMet, ratePct, commission, base: terms.base, total: round2(terms.base + commission), currency: terms.currency };
}

/**
 * Доли с авиабилетов: прибыль каждого билета × (процент / число менеджеров «В работе» в день продажи).
 * Продавшая считается работавшей в этот день, даже если не включила переключатель. Убыточный билет уменьшает долю.
 */
export function flightShares(deals: { sellerId: string; day: string; profit: number }[], workers: Map<string, Set<string>>, poolPct: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of deals) {
    const team = new Set(workers.get(d.day) ?? []);
    team.add(d.sellerId);
    out.set(d.sellerId, (out.get(d.sellerId) ?? 0) + (d.profit * poolPct) / 100 / team.size);
  }
  for (const [k, v] of out) out.set(k, round2(v));
  return out;
}

export interface ManagerMonth extends PayoutRow {
  userId: string;
  name: string;
  terms: SalaryTerms;
  /** с какого месяца действуют условия («2026-10»); null — с самого начала */
  termsSince: string | null;
  /** месяц входит в учёт зарплаты CRM (не целиком до даты начала учёта) */
  tracked: boolean;
  /** продажи считаются не с начала месяца, а с даты начала учёта (ISO) */
  countedFrom: string | null;
  paid: number;
  /** к выплате − выплачено (отрицательное — переплата) */
  left: number;
  payouts: { id: string; amount: number; paidAt: string; note: string | null }[];
}

/** Условия до этой даты считаем «с самого начала» (запись миграции) */
const TERMS_EPOCH = "2000-01";

/** Планы, факт и зарплата менеджеров за месяц (managerId — только один) */
export async function loadManagerMonths(range: MonthRange, managerId: string | null): Promise<ManagerMonth[]> {
  const settings = await getSettings();
  const book = await loadRateBook(settings);
  const rate = toNum(settings.usdRate);
  const costRate = toNum(settings.usdRateCost);
  const users = await prisma.user.findMany({
    where: { role: "MANAGER", ...(managerId ? { id: managerId } : { isActive: true }) },
    orderBy: { name: "asc" },
    include: {
      plans: { where: { month: monthKey(range.ym) } },
      // условия, действующие в этом месяце: последняя запись, начавшаяся не позже него
      salaryTerms: { where: { fromMonth: { lte: monthKey(range.ym) } }, orderBy: { fromMonth: "desc" }, take: 1 },
    },
  });
  const ids = users.map((u) => u.id);
  const start = settings.salaryStartAt;
  const tracked = !start || range.to > start;
  // в месяце начала учёта комиссия — только с даты начала; месяцы до учёта показывают продажи как есть, без начислений
  const dealsFrom = tracked && start && start > range.from ? start : range.from;
  const [leads, deals, shiftDays, payouts] = await Promise.all([
    prisma.lead.groupBy({ by: ["managerId"], where: { managerId: { in: ids }, createdAt: { gte: range.from, lt: range.to } }, _count: { _all: true } }),
    prisma.deal.findMany({
      where: { managerId: { in: ids }, paidAt: { gte: dealsFrom, lt: range.to } },
      select: { managerId: true, amount: true, cost: true, currency: true, costCurrency: true, paidAt: true, quantity: true, serviceType: true, costConfirmed: true },
    }),
    // кто был «В работе» в дни месяца — все менеджеры, а не только показанные (делим процент с авиабилетов)
    prisma.shiftDay.findMany({ where: { day: { gte: monthKey(range.ym), lt: monthKey(shiftMonth(range.ym, 1)) } } }),
    prisma.salaryPayout.findMany({ where: { userId: { in: ids }, month: monthKey(range.ym) }, orderBy: { paidAt: "asc" } }),
  ]);
  const workers = new Map<string, Set<string>>();
  const addWorker = (day: string, userId: string) => workers.set(day, (workers.get(day) ?? new Set()).add(userId));
  for (const s of shiftDays) addWorker(s.day.toISOString().slice(0, 10), s.userId);
  for (const a of await activityDays(range)) addWorker(a.day, a.userId);
  const poolPct = toNum(settings.flightPoolPct);
  return users.map((u) => {
    const own = deals.filter((d) => d.managerId === u.id).map((d) => ({ ...d, amount: toNum(d.amount), cost: toNum(d.cost) }));
    const flights = own.filter((d) => d.serviceType === "FLIGHTS");
    const other = own.filter((d) => d.serviceType !== "FLIGHTS");
    // пока себестоимость не указана, прибыль сделки неизвестна (себестоимость 0 завысила бы план, надбавку и комиссию от прибыли)
    const confirmed = own.filter((d) => d.costConfirmed);
    const st = u.salaryTerms[0];
    const terms: SalaryTerms = st
      ? { base: toNum(st.base), currency: st.currency, pct: toNum(st.pct), bonusPct: toNum(st.bonusPct), from: st.commissionFrom }
      : { base: toNum(u.salaryBase), currency: u.salaryCurrency, pct: toNum(u.commissionPct), bonusPct: toNum(u.planBonusPct), from: u.commissionFrom };
    const since = st ? st.fromMonth.toISOString().slice(0, 7) : null;
    const termsSince = since && since > TERMS_EPOCH ? since : null;
    const money = (currency: Currency) => ({ currency, rate, costRate, book });
    const profitIn = (currency: Currency, list = own) => round2(list.reduce((s, d) => s + dealProfit(d, money(currency)), 0));
    const revenueIn = (currency: Currency, list = own) => round2(list.reduce((s, d) => s + dealRevenue(d, money(currency)), 0));
    const flightCommission =
      flightShares(
        flights.map((d) => ({ sellerId: u.id, day: toInputDate(d.paidAt), profit: dealProfit(d, money(terms.currency)) })),
        workers,
        poolPct,
      ).get(u.id) ?? 0;
    const fact: PlanFact = {
      leads: leads.find((l) => l.managerId === u.id)?._count._all ?? 0,
      sales: own.reduce((s, d) => s + d.quantity, 0),
      profitUsd: profitIn("USD", confirmed),
      profitSalary: profitIn(terms.currency, other.filter((d) => d.costConfirmed)),
      revenueUsd: revenueIn("USD"),
      revenueSalary: revenueIn(terms.currency, other),
      flightProfitSalary: profitIn(terms.currency, flights),
      flightCommission,
      pendingCost: own.length - confirmed.length,
    };
    const p = u.plans[0];
    const plan: PlanValues = { leads: p?.leads ?? null, sales: p?.sales ?? null, profit: p?.profit === null || p?.profit === undefined ? null : toNum(p.profit) };
    const pay = calcPayout(terms, plan, fact);
    // месяц до начала учёта: зарплату за него платили вне CRM
    if (!tracked) Object.assign(pay, { commission: 0, base: 0, total: 0 });
    const mine = payouts.filter((p) => p.userId === u.id);
    const paid = round2(mine.reduce((s, p) => s + toNum(p.amount), 0));
    return {
      userId: u.id,
      name: u.name,
      terms,
      termsSince,
      ...pay,
      tracked,
      countedFrom: tracked && dealsFrom > range.from ? dealsFrom.toISOString() : null,
      paid,
      left: round2(pay.total - paid),
      payouts: mine.map((p) => ({ id: p.id, amount: toNum(p.amount), paidAt: p.paidAt.toISOString(), note: p.note })),
    };
  });
}

/**
 * Дни (по Ташкенту), в которые менеджер работал в CRM: менял лиды (история), писал комментарии, отвечал клиентам в чатах,
 * закрывал сделки. Отметка «В работе» есть только при автораспределении, а делить 30% с авиабилетов нужно в любом режиме.
 */
export async function activityDays(range: { from: Date; to: Date }): Promise<{ userId: string; day: string }[]> {
  const day = (col: Prisma.Sql) => Prisma.sql`to_char(${col} + interval '5 hours', 'YYYY-MM-DD')`;
  return prisma.$queryRaw<{ userId: string; day: string }[]>`
    SELECT DISTINCT a."userId", a.day FROM (
      SELECT h."userId" AS "userId", ${day(Prisma.sql`h."createdAt"`)} AS day FROM "LeadHistory" h
        WHERE h."userId" IS NOT NULL AND h."createdAt" >= ${range.from} AND h."createdAt" < ${range.to}
      UNION SELECT c."authorId", ${day(Prisma.sql`c."createdAt"`)} FROM "Comment" c
        WHERE c."createdAt" >= ${range.from} AND c."createdAt" < ${range.to}
      UNION SELECT m."senderId", ${day(Prisma.sql`m."createdAt"`)} FROM "ChatMessage" m
        WHERE m."senderId" IS NOT NULL AND m."createdAt" >= ${range.from} AND m."createdAt" < ${range.to}
      UNION SELECT d."managerId", ${day(Prisma.sql`d."createdAt"`)} FROM "Deal" d
        WHERE d."managerId" IS NOT NULL AND d."createdAt" >= ${range.from} AND d."createdAt" < ${range.to}
    ) a JOIN "User" u ON u.id = a."userId" WHERE u.role = 'MANAGER'`;
}

export interface CurrencyIssue {
  dealId: string;
  leadId: string;
  leadName: string;
  manager: string | null;
  product: string;
  paidAt: string;
  amount: number;
  currency: Currency;
  cost: number;
  costCurrency: Currency;
}

/**
 * Сделки, где сумма не похожа на валюту (см. currencyMismatch): сумы, сохранённые как доллары, и наоборот.
 * Из-за них в тысячи раз завышаются продажи и зарплата — администратор исправляет такие сделки в карточке лида.
 */
export async function loadCurrencyIssues(): Promise<CurrencyIssue[]> {
  const rows = await prisma.deal.findMany({
    where: {
      OR: [
        { currency: "USD", amount: { gte: USD_DEAL_MAX } },
        { currency: "UZS", amount: { gt: 0, lt: UZS_DEAL_MIN } },
        { costCurrency: "USD", cost: { gte: USD_DEAL_MAX } },
        { costCurrency: "UZS", cost: { gt: 0, lt: UZS_DEAL_MIN } },
      ],
    },
    orderBy: { paidAt: "desc" },
    take: 50,
    select: { id: true, leadId: true, product: true, paidAt: true, amount: true, currency: true, cost: true, costCurrency: true, lead: { select: { name: true } }, manager: { select: { name: true } } },
  });
  return rows.map((d) => ({
    dealId: d.id,
    leadId: d.leadId,
    leadName: d.lead.name,
    manager: d.manager?.name ?? null,
    product: d.product,
    paidAt: d.paidAt.toISOString(),
    amount: toNum(d.amount),
    currency: d.currency,
    cost: toNum(d.cost),
    costCurrency: d.costCurrency,
  }));
}

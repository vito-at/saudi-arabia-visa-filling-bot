import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { toInputDate } from "./format";
import { toNum } from "./money";
import type { RateBook } from "./rate-book";

type Db = Prisma.TransactionClient | typeof prisma;

/** Сохранить курсы за сегодняшний день (по Ташкенту); повторное сохранение в тот же день перезаписывает их */
export async function recordDayRates(sale: number, cost: number, db: Db = prisma, now = new Date()) {
  const date = new Date(`${toInputDate(now)}T00:00:00Z`);
  await db.exchangeRate.upsert({ where: { date }, create: { date, sale, cost }, update: { sale, cost } });
}

/** История курсов для отчётов */
export async function loadRateBook(current: { usdRate: Prisma.Decimal | number; usdRateCost: Prisma.Decimal | number }): Promise<RateBook> {
  const rows = await prisma.exchangeRate.findMany({ orderBy: { date: "asc" } });
  return {
    days: rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), sale: toNum(r.sale), cost: toNum(r.cost) })),
    current: { sale: toNum(current.usdRate), cost: toNum(current.usdRateCost) },
  };
}

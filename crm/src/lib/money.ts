import type { Currency } from "@prisma/client";
import { resolveRates, type RateBook } from "./rate-book";

type Num = number | string | { toString(): string } | null | undefined;

export function toNum(v: Num): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

/** Округление денег до 2 знаков без ошибок двоичной арифметики */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Прибыль = продажа − себестоимость */
export function calcProfit(amount: Num, cost: Num): number {
  return round2(toNum(amount) - toNum(cost));
}

/** Маржинальность: прибыль / продажа */
export function calcMargin(amount: Num, cost: Num): number | null {
  const a = toNum(amount);
  return a > 0 ? calcProfit(amount, cost) / a : null;
}

/**
 * Пересчёт суммы между UZS и USD по курсу USD→UZS.
 * Выручка пересчитывается по курсу продажи $, себестоимость и расходы — по курсу покупки $ (дорогому).
 */
export function convert(amount: Num, from: Currency, to: Currency, usdRate: Num): number {
  const a = toNum(amount);
  if (from === to) return round2(a);
  const rate = toNum(usdRate);
  if (rate <= 0) throw new Error("Курс USD→UZS не задан");
  return round2(from === "USD" ? a * rate : a / rate);
}

/** Курсы дня: продажа $ (дешевле) и покупка $ (дороже) */
export interface RatePair {
  sale: number;
  cost: number;
}

/**
 * Выручка — по курсу, при котором она получается меньше:
 * доллары в сумы — по меньшему курсу, сумы в доллары — по большему.
 * Так прибыль в отчётах не завышается в любой валюте отчёта.
 */
export function convertRevenue(amount: Num, from: Currency, to: Currency, r: RatePair): number {
  return convert(amount, from, to, from === "USD" ? Math.min(r.sale, r.cost) : Math.max(r.sale, r.cost));
}

/** Себестоимость, реклама, расходы — по курсу, при котором они получаются больше */
export function convertCost(amount: Num, from: Currency, to: Currency, r: RatePair): number {
  return convert(amount, from, to, from === "USD" ? Math.max(r.sale, r.cost) : Math.min(r.sale, r.cost));
}

export interface DealMoney {
  amount: Num;
  cost: Num;
  currency: Currency;
  paidAt?: Date;
}

/**
 * Итоги по набору сделок в выбранной валюте: выручка по минимуму, себестоимость по максимуму (см. convertRevenue/convertCost).
 * С историей курсов (RateBook) каждая сделка пересчитывается по курсам дня оплаты.
 */
export function sumDeals(deals: DealMoney[], to: Currency, usdRate: number | RateBook, costRate?: number) {
  let revenue = 0;
  let cost = 0;
  for (const d of deals) {
    const r = resolveRates(usdRate, costRate, d.paidAt);
    revenue += convertRevenue(d.amount, d.currency, to, r);
    cost += convertCost(d.cost, d.currency, to, r);
  }
  revenue = round2(revenue);
  cost = round2(cost);
  const count = deals.length;
  return { revenue, cost, profit: round2(revenue - cost), count, avgCheck: count ? round2(revenue / count) : 0 };
}

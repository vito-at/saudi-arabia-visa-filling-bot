import type { Currency } from "@prisma/client";

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
 * Все отчёты считаются по текущему курсу из настроек (Ипак Йули Банк).
 */
export function convert(amount: Num, from: Currency, to: Currency, usdRate: Num): number {
  const a = toNum(amount);
  if (from === to) return round2(a);
  const rate = toNum(usdRate);
  if (rate <= 0) throw new Error("Курс USD→UZS не задан");
  return round2(from === "USD" ? a * rate : a / rate);
}

export interface DealMoney {
  amount: Num;
  cost: Num;
  currency: Currency;
}

/** Итоги по набору сделок в выбранной валюте */
export function sumDeals(deals: DealMoney[], to: Currency, usdRate: Num) {
  let revenue = 0;
  let cost = 0;
  for (const d of deals) {
    revenue += convert(d.amount, d.currency, to, usdRate);
    cost += convert(d.cost, d.currency, to, usdRate);
  }
  revenue = round2(revenue);
  cost = round2(cost);
  const count = deals.length;
  return { revenue, cost, profit: round2(revenue - cost), count, avgCheck: count ? round2(revenue / count) : 0 };
}

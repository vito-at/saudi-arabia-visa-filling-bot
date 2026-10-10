/**
 * Долги клиентов: сделка продана на сумму amount, клиент заплатил paidAmount (предоплата при закрытии + доплаты).
 * Пока оплачено меньше суммы продажи — клиент в списке «Должники». Всё считается в валюте сделки.
 */
import { toInputDate } from "./format";
import { round2 } from "./money";

const parseNum = (s: string | number) => Number(String(s).replace(/\s/g, "").replace(",", "."));

/** Остаток долга (не меньше нуля) */
export function debtLeft(amount: number, paid: number): number {
  return Math.max(0, round2(amount - paid));
}

/**
 * Оплачено при закрытии сделки: пусто — клиент заплатил всё; иначе число от 0 до суммы продажи.
 * Возвращает null, если ввод неверный.
 */
export function parsePaidAtClose(input: string | number | null | undefined, amount: number): number | null {
  if (input === undefined || input === null || String(input).trim() === "") return amount;
  const n = parseNum(input);
  if (!Number.isFinite(n) || n < 0 || round2(n) > round2(amount)) return null;
  return round2(n);
}

/** Сумма доплаты: больше нуля и не больше остатка долга. null — неверный ввод. */
export function parsePayment(input: string | number, left: number): number | null {
  const n = parseNum(input);
  if (String(input).trim() === "" || !Number.isFinite(n) || n <= 0 || round2(n) > round2(left)) return null;
  return round2(n);
}

export type DueState = { kind: "none" } | { kind: "overdue"; days: number } | { kind: "today" } | { kind: "upcoming"; days: number };

/** Срок оплаты относительно сегодняшнего дня (по Ташкенту): просрочен на N дней, сегодня, через N дней или не указан */
export function dueState(dueAt: Date | string | null | undefined, now: Date = new Date()): DueState {
  if (!dueAt) return { kind: "none" };
  const day = (d: Date | string) => Date.parse(`${toInputDate(d)}T00:00:00Z`);
  const diff = Math.round((day(dueAt) - day(now)) / 86_400_000);
  if (diff < 0) return { kind: "overdue", days: -diff };
  if (diff === 0) return { kind: "today" };
  return { kind: "upcoming", days: diff };
}

/** Порядок в списке: сначала просроченные (самые давние сверху), затем сегодняшние и ближайшие сроки, в конце — без срока по дате продажи */
export function compareDebts(a: { dueAt: Date | null; paidAt: Date }, b: { dueAt: Date | null; paidAt: Date }): number {
  if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return a.paidAt.getTime() - b.paidAt.getTime();
}

/** Итог долгов по валютам */
export function debtTotals(rows: { currency: "USD" | "UZS"; left: number }[]): { USD: number; UZS: number } {
  const t = { USD: 0, UZS: 0 };
  for (const r of rows) t[r.currency] = round2(t[r.currency] + r.left);
  return t;
}

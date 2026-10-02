import { toInputDate } from "./format";

/** Курсы USD→UZS одного дня: продажи $ (выручка) и покупки $ (себестоимость, реклама, расходы) */
export interface DayRates {
  sale: number;
  cost: number;
}

/**
 * История курсов по дням (ташкентская дата YYYY-MM-DD, по возрастанию).
 * Суммы пересчитываются по курсу дня операции, поэтому смена курса не меняет отчёты за прошлые даты.
 */
export interface RateBook {
  days: ({ date: string } & DayRates)[];
  /** текущий курс — если истории ещё нет */
  current: DayRates;
}

/** Курс на дату: последний известный на этот день; до начала истории — самый ранний из сохранённых */
export function ratesOn(book: RateBook, date: Date | string): DayRates {
  const { days } = book;
  if (!days.length) return book.current;
  const key = typeof date === "string" ? date.slice(0, 10) : toInputDate(date);
  if (key < days[0].date) return days[0];
  let lo = 0;
  let hi = days.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (days[mid].date <= key) lo = mid;
    else hi = mid - 1;
  }
  return days[lo];
}

/** Ключ дня для столбца DATE (хранится как полночь UTC) */
export const dateColumnKey = (d: Date) => d.toISOString().slice(0, 10);

/** Курсы для операции: по истории на её дату или (без истории) фиксированные — продажи и покупки */
export function resolveRates(rates: RateBook | number, costRate: number | undefined, date: Date | string | undefined): DayRates {
  if (typeof rates === "number") return { sale: rates, cost: costRate ?? rates };
  return ratesOn(rates, date ?? new Date());
}

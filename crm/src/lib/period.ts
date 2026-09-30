import { parseInputDate, toInputDate } from "./format";

export type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "month" | "prev_month" | "quarter" | "year" | "all" | "custom";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Сегодня",
  yesterday: "Вчера",
  "7d": "7 дней",
  "30d": "30 дней",
  month: "Этот месяц",
  prev_month: "Прошлый месяц",
  quarter: "Квартал",
  year: "Год",
  all: "Всё время",
  custom: "Период",
};

export interface Period {
  key: PeriodKey;
  from: Date; // включительно
  to: Date; // не включительно
}

const DAY = 24 * 60 * 60 * 1000;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Период в часовом поясе Ташкента. */
export function resolvePeriod(key: string | undefined, fromStr?: string, toStr?: string, now = new Date()): Period {
  const today = toInputDate(now);
  const [y, m] = today.split("-").map(Number);
  const start = (s: string) => parseInputDate(s)!;
  const pk = (key as PeriodKey) || "30d";
  switch (pk) {
    case "today":
      return { key: pk, from: start(today), to: start(addDays(today, 1)) };
    case "yesterday":
      return { key: pk, from: start(addDays(today, -1)), to: start(today) };
    case "7d":
      return { key: pk, from: start(addDays(today, -6)), to: start(addDays(today, 1)) };
    case "month": {
      const first = `${y}-${String(m).padStart(2, "0")}-01`;
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      return { key: pk, from: start(first), to: start(next) };
    }
    case "prev_month": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { key: pk, from: start(`${py}-${String(pm).padStart(2, "0")}-01`), to: start(`${y}-${String(m).padStart(2, "0")}-01`) };
    }
    case "quarter":
      return { key: pk, from: start(addDays(today, -89)), to: start(addDays(today, 1)) };
    case "year":
      return { key: pk, from: start(addDays(today, -364)), to: start(addDays(today, 1)) };
    case "all":
      return { key: pk, from: new Date("2000-01-01T00:00:00Z"), to: start(addDays(today, 1)) };
    case "custom": {
      const f = parseInputDate(fromStr);
      const t = parseInputDate(toStr);
      if (f && t && f <= t) return { key: pk, from: f, to: new Date(t.getTime() + DAY) };
      break;
    }
  }
  return { key: "30d", from: start(addDays(today, -29)), to: start(addDays(today, 1)) };
}

/** Предыдущий период той же длины — для сравнения на дашборде */
export function previousPeriod(p: Period): Period {
  if (p.key === "month" || p.key === "prev_month") {
    // календарный месяц сравниваем с предыдущим календарным месяцем
    const fromStr = toInputDate(p.from);
    const [y, m] = fromStr.split("-").map(Number);
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return { key: "custom", from: parseInputDate(`${py}-${String(pm).padStart(2, "0")}-01`)!, to: p.from };
  }
  const len = p.to.getTime() - p.from.getTime();
  return { key: "custom", from: new Date(p.from.getTime() - len), to: p.from };
}

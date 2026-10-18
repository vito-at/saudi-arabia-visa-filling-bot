/**
 * Рабочее время офиса (по Ташкенту, UTC+5 без перехода на летнее время).
 * Скорость реакции на лид считается только в рабочие часы: лид, пришедший в 23:00, отсчитывается с начала следующего рабочего дня.
 */
export interface WorkSchedule {
  /** минуты от полуночи: 540 = 09:00 */
  startMin: number;
  endMin: number;
  /** 1 — понедельник … 7 — воскресенье */
  days: number[];
}

export const DEFAULT_SCHEDULE: WorkSchedule = { startMin: 540, endMin: 1080, days: [1, 2, 3, 4, 5, 6] };

const OFFSET_MS = 5 * 3_600_000;
const DAY_MS = 86_400_000;

/** ISO-день недели ташкентской даты для момента t (мс) */
function weekday(dayStartMs: number): number {
  const d = new Date(dayStartMs + OFFSET_MS).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Начало ташкентских суток (в мс UTC), в которые попадает момент t */
function tashkentDayStart(t: number): number {
  return Math.floor((t + OFFSET_MS) / DAY_MS) * DAY_MS - OFFSET_MS;
}

/** Рабочих минут между двумя моментами */
export function workMinutesBetween(from: Date, to: Date, s: WorkSchedule = DEFAULT_SCHEDULE): number {
  let a = from.getTime();
  const b = to.getTime();
  if (b <= a || s.endMin <= s.startMin || !s.days.length) return 0;
  let total = 0;
  // ограничение на всякий случай: не дольше года перебора
  for (let day = tashkentDayStart(a), n = 0; day < b && n < 400; day += DAY_MS, n++) {
    if (!s.days.includes(weekday(day))) continue;
    const ws = Math.max(day + s.startMin * 60_000, a);
    const we = Math.min(day + s.endMin * 60_000, b);
    if (we > ws) total += we - ws;
    a = Math.max(a, day);
  }
  return Math.round(total / 60_000);
}

/** Момент приходится на рабочее время */
export function isWorkTime(at: Date, s: WorkSchedule = DEFAULT_SCHEDULE): boolean {
  const t = at.getTime();
  const day = tashkentDayStart(t);
  const min = (t - day) / 60_000;
  return s.days.includes(weekday(day)) && min >= s.startMin && min < s.endMin;
}

export function scheduleOf(settings: { workStartMin?: number | null; workEndMin?: number | null; workDays?: number[] | null } | null | undefined): WorkSchedule {
  if (!settings) return DEFAULT_SCHEDULE;
  return { startMin: settings.workStartMin ?? 540, endMin: settings.workEndMin ?? 1080, days: settings.workDays?.length ? settings.workDays : DEFAULT_SCHEDULE.days };
}

export const minToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function timeToMin(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  return h <= 24 && mm < 60 && h * 60 + mm <= 1440 ? h * 60 + mm : null;
}

/**
 * Посещаемость: сотрудник отмечает приход и уход в Telegram-боте, CRM считает опоздания, штрафы и пропуски.
 * День — дата по Ташкенту; в колонке @db.Date хранится как полночь UTC этой даты.
 */
import { toInputDate } from "@/lib/format";
import type { WorkSchedule } from "@/lib/work-hours";

const OFFSET_MS = 5 * 3_600_000;

/** Ташкентская дата «YYYY-MM-DD» момента → ключ для @db.Date */
export const dayKey = (at: Date) => new Date(`${toInputDate(at)}T00:00:00Z`);

/** Минуты от ташкентской полуночи */
export function tashkentMinutes(at: Date): number {
  const t = at.getTime() + OFFSET_MS;
  return Math.floor((t % 86_400_000) / 60_000);
}

/** ISO-день недели (1 — пн … 7 — вс) для даты «YYYY-MM-DD» */
export function isoWeekday(day: string): number {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Опоздание в минутах: считается от начала дня, если приход позже начала больше чем на льготные минуты; в выходной — 0 */
export function lateMinutes(checkIn: Date, s: WorkSchedule, graceMin: number): number {
  if (!s.days.includes(isoWeekday(toInputDate(checkIn)))) return 0;
  const late = tashkentMinutes(checkIn) - s.startMin;
  return late > graceMin ? late : 0;
}

/** Расстояние между точками в метрах (формула гаверсинусов) */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export interface DayMark {
  day: string; // YYYY-MM-DD
  checkInAt: Date | null;
  checkOutAt: Date | null;
  lateMin: number;
  fine: number;
}

export type DayState = "ok" | "late" | "absent" | "off" | "future" | "noOut";

/**
 * Состояние дня в табеле. since — день первой отметки сотрудника: раньше учёт не вёлся, и пропусков там нет.
 */
export function dayState(day: string, mark: DayMark | undefined, s: WorkSchedule, today: string, since: string | null): DayState {
  if (day > today) return "future";
  const workday = s.days.includes(isoWeekday(day));
  if (!mark?.checkInAt) return workday && day < today && since !== null && day >= since ? "absent" : "off";
  if (mark.lateMin > 0) return "late";
  if (!mark.checkOutAt && day < today) return "noOut";
  return "ok";
}

export interface AttendanceSummary {
  worked: number;
  late: number;
  lateMin: number;
  absent: number;
  fines: number;
  /** среднее время прихода, минуты от полуночи */
  avgIn: number | null;
  /** отработано часов (по дням с приходом и уходом) */
  hours: number;
}

export function summarize(days: string[], marks: DayMark[], s: WorkSchedule, today: string, since: string | null): AttendanceSummary {
  const byDay = new Map(marks.map((m) => [m.day, m]));
  let worked = 0;
  let late = 0;
  let lateMin = 0;
  let absent = 0;
  let fines = 0;
  let inSum = 0;
  let ms = 0;
  for (const d of days) {
    const m = byDay.get(d);
    if (dayState(d, m, s, today, since) === "absent") absent++;
    if (!m?.checkInAt) continue;
    worked++;
    inSum += tashkentMinutes(m.checkInAt);
    if (m.lateMin > 0) {
      late++;
      lateMin += m.lateMin;
    }
    fines += m.fine;
    if (m.checkOutAt && m.checkOutAt > m.checkInAt) ms += m.checkOutAt.getTime() - m.checkInAt.getTime();
  }
  return { worked, late, lateMin, absent, fines: Math.round(fines * 100) / 100, avgIn: worked ? Math.round(inSum / worked) : null, hours: Math.round((ms / 3_600_000) * 10) / 10 };
}

/** Все даты месяца «YYYY-MM» */
export function monthDays(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
}

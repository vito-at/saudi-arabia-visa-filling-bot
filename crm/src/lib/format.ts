// Единые правила отображения: ДД.ММ.ГГГГ, часовой пояс Asia/Tashkent, разделители разрядов.
export const TZ = "Asia/Tashkent";
/** Ташкент живёт в UTC+5 без перехода на летнее время */
export const TZ_OFFSET = "+05:00";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

type DateLike = Date | string | number | null | undefined;

function toDate(d: DateLike): Date | null {
  if (d === null || d === undefined || d === "") return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(d: DateLike): string {
  const date = toDate(d);
  return date ? dateFmt.format(date) : "—";
}

export function formatTime(d: DateLike): string {
  const date = toDate(d);
  return date ? timeFmt.format(date) : "";
}

export function formatDateTime(d: DateLike): string {
  const date = toDate(d);
  return date ? `${dateFmt.format(date)} ${timeFmt.format(date)}` : "—";
}

/** Число с разделителями разрядов (пробелами) */
export function formatNumber(n: number | null | undefined, fractionDigits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
    .format(n)
    .replace(/ | /g, " ");
}

export function formatMoney(n: number | null | undefined, currency: "UZS" | "USD" = "UZS"): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return currency === "USD" ? `$${formatNumber(n, 2)}` : `${formatNumber(Math.round(n))} сум`;
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${formatNumber(n * 100, digits)}%`;
}

/** Длительность в минутах → «1 ч 15 мин» */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  const m = Math.round(minutes);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч ${m % 60} мин`;
  return `${Math.floor(h / 24)} д ${h % 24} ч`;
}

/** Дата в Ташкенте в виде YYYY-MM-DD (для <input type="date">) */
export function toInputDate(d: DateLike): string {
  const date = toDate(d);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return parts; // en-CA даёт YYYY-MM-DD
}

/** Дата и время в Ташкенте в виде YYYY-MM-DDTHH:mm (для <input type="datetime-local">) */
export function toInputDateTime(d: DateLike): string {
  const date = toDate(d);
  if (!date) return "";
  return `${toInputDate(date)}T${formatTime(date)}`;
}

/** YYYY-MM-DD (ташкентская дата) → Date начала дня */
export function parseInputDate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00${TZ_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** YYYY-MM-DDTHH:mm (ташкентское время) → Date */
export function parseInputDateTime(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return null;
  const d = new Date(`${s.slice(0, 16)}:00${TZ_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

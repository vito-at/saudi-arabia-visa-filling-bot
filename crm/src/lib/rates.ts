import { prisma } from "./db";
import { parseInputDateTime, toInputDate } from "./format";

/** Время ежедневного обновления курса и окно повторных попыток (по Ташкенту) */
export const RATE_UPDATE_HOUR = 7;
export const RATE_RETRY_UNTIL_HOUR = 12;

/** Сегодняшние 07:00 по Ташкенту */
export function todayRateTime(now = new Date()): Date {
  return parseInputDateTime(`${toInputDate(now)}T${String(RATE_UPDATE_HOUR).padStart(2, "0")}:00`)!;
}

/** Последние наступившие 07:00 по Ташкенту (сегодня, а до 07:00 — вчера) */
export function lastRateTime(now = new Date()): Date {
  const today = todayRateTime(now);
  return now >= today ? today : new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

/** Курс не обновлялся с последних 07:00 — нужна попытка и уведомление сотрудникам */
export function isRateStale(updatedAt: Date | null, now = new Date()): boolean {
  return !updatedAt || updatedAt < lastRateTime(now);
}

/**
 * Курс USD Ипак Йули Банка из открытых источников (без API):
 * по очереди загружаем страницы из IPAK_RATE_URLS и ищем в тексте строку с USD и два курса — покупка и продажа.
 */
export const DEFAULT_RATE_SOURCES = [
  "https://ipakyulibank.uz/physical/exchange-rates",
  "https://bank.uz/currency/bank/ipakyulibank",
  "https://depozit.uz/ru/exchange-rate-bank/ipak-yoli-banki",
];

export function rateSources(): string[] {
  const env = process.env.IPAK_RATE_URLS?.split(",").map((s) => s.trim()).filter(Boolean);
  return env?.length ? env : DEFAULT_RATE_SOURCES;
}

export interface BankRate {
  buy: number;
  sell: number;
  source: string;
}

// Правдоподобный диапазон курса USD→UZS — защищает от того, чтобы принять за курс посторонние числа
const MIN_RATE = 8_000;
const MAX_RATE = 30_000;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, (m) => (/USD|usd/.test(m) ? m.replace(/<[^>]+>/g, " ") : " "))
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;| | /g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
}

function toNumber(s: string): number {
  let t = s.replace(/[\s]/g, "");
  if (/^\d{1,2},\d{3}(\.\d+)?$/.test(t)) t = t.replace(",", ""); // 12,650.00 — запятая как разделитель тысяч
  return Number(t.replace(",", "."));
}

/** Извлечение курсов покупки/продажи USD из HTML или JSON страницы. */
export function parseUsdRates(body: string): { buy: number; sell: number } | null {
  const text = body.trim().startsWith("{") || body.trim().startsWith("[") ? body.replace(/\s+/g, " ") : htmlToText(body);
  const marker = /\bUSD\b|Доллар США|доллар США|AQSH dollari|US Dollar/g;
  const num = /\d{1,2}(?:[ ,]?\d{3})(?:[.,]\d{1,2})?/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(text))) {
    // окно — до следующего упоминания любой валюты, чтобы не смешивать строки таблицы
    const rest = text.slice(m.index + m[0].length, m.index + 250);
    const nextCur = rest.search(/\b(USD|EUR|RUB|GBP|CHF|JPY|KZT|CNY)\b|Доллар|Евро|Рубл/);
    const windowText = nextCur >= 0 ? rest.slice(0, nextCur) : rest;
    const values = [...windowText.matchAll(num)].map((x) => toNumber(x[0])).filter((n) => n >= MIN_RATE && n <= MAX_RATE);
    if (values.length >= 2) {
      const [a, b] = values;
      const buy = Math.min(a, b);
      const sell = Math.max(a, b);
      // спред банка обычно 0–5%; больше — вероятно, захватили чужие числа
      if ((sell - buy) / buy <= 0.05) return { buy, sell };
    }
  }
  return null;
}

export async function fetchIpakYuliRate(fetchFn: typeof fetch = fetch): Promise<BankRate> {
  const errors: string[] = [];
  for (const url of rateSources()) {
    try {
      const res = await fetchFn(url, {
        headers: { "User-Agent": "Mozilla/5.0 (OrientTravelCRM)", "Accept-Language": "ru,uz;q=0.8" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseUsdRates(await res.text());
      if (parsed) return { ...parsed, source: url };
      errors.push(`${url}: курс USD не найден на странице`);
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(errors.join("; "));
}

/** Обновить курс в настройках (если выбран источник «Ипак Йули Банк») */
export async function updateUsdRate(opts: { force?: boolean; fetchFn?: typeof fetch } = {}) {
  const s = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!s || (s.usdRateSource !== "IPAK_YULI" && !opts.force)) return { ok: false, skipped: true as const };
  try {
    const r = await fetchIpakYuliRate(opts.fetchFn);
    const rate = s.usdRateSide === "BUY" ? r.buy : r.sell;
    await prisma.appSettings.update({ where: { id: 1 }, data: { usdRate: rate, usdRateUpdatedAt: new Date(), usdRateError: null } });
    return { ok: true, rate, ...r };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.appSettings.update({ where: { id: 1 }, data: { usdRateError: msg.slice(0, 1000) } });
    return { ok: false, error: msg };
  }
}

/**
 * Справочник виз: для гражданина страны (по умолчанию Узбекистан) — поездка в страну мира: нужна ли виза, документы,
 * консульский сбор, цены продажи по вариантам визы (30 дней, 1 год…), где подавать, сайты подачи и записи, визовый сервис, официальные источники.
 * Читают все сотрудники; правят администратор и визовые специалисты (canEditCountries); любая правка снимает
 * отметку «проверено», ставит её только администратор.
 */
import type { Currency, Role, VisaKind } from "@prisma/client";
import { parseAmount } from "@/lib/money";
import { isCitizenship, worldCountry, type Citizenship } from "@/lib/world";

export const VISA_KINDS: VisaKind[] = ["EVISA", "STICKER", "ON_ARRIVAL", "VISA_FREE"];

export const canEditCountries = (role: Role) => role === "ADMIN" || role === "VISA";

/** Вариант визы с ценой для клиента: «30 дней» — 40 $, «1 год» — 65 $ */
export interface PriceOption {
  label: string;
  price: number;
  currency: Currency;
}

/** Вариант цены в форме — строками, как ввели */
export interface PriceInput {
  label: string;
  price: string;
  currency: string;
}

export const MAX_PRICES = 10;

const currencyOf = (v: unknown): Currency => (v === "UZS" ? "UZS" : "USD");

/** Варианты цен из колонки prices (Json); битые записи пропускаем */
export function readPrices(v: unknown): PriceOption[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({ label: typeof p.label === "string" ? p.label : "", price: Number(p.price), currency: currencyOf(p.currency) }))
    .filter((p) => Number.isFinite(p.price) && p.price >= 0);
}

export interface CountryInput {
  citizenship: string;
  /** код страны поездки; пусто — своё направление (name) */
  code: string;
  name: string;
  visaKind: string;
  documents: string;
  consularFee: string;
  prices: PriceInput[];
  processingTime: string;
  validity: string;
  whereToApply: string;
  applyUrl: string;
  appointmentUrl: string;
  visaCenter: string;
  notes: string;
  sources: string;
}

export interface CountryData {
  citizenship: Citizenship;
  code: string | null;
  name: string;
  region: string | null;
  visaKind: VisaKind | null;
  documents: string;
  consularFee: string | null;
  prices: PriceOption[];
  /** первый вариант — для старого кода */
  salePrice: number | null;
  saleCurrency: Currency;
  processingTime: string | null;
  validity: string | null;
  whereToApply: string | null;
  applyUrl: string | null;
  appointmentUrl: string | null;
  visaCenter: string | null;
  notes: string | null;
  sources: string | null;
}

const text = (v: string, max = 500) => v.trim().slice(0, max) || null;

/** Адрес сайта: «vfsglobal.com/uz» → «https://vfsglobal.com/uz»; не сайт — ошибка (null — поле пустое) */
export function normalizeUrl(v: string): string | null | "invalid" {
  const s = v.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".")) return "invalid";
    return u.toString();
  } catch {
    return "invalid";
  }
}

/** Проверка формы; ошибка — ключ перевода */
export function parseCountry(input: CountryInput): { data: CountryData } | { error: "err.countryName" | "err.countryUrl" | "err.countryPrice" | "err.countryCitizenship" } {
  if (!isCitizenship(input.citizenship)) return { error: "err.countryCitizenship" };
  // страна из списка стран мира — название и часть света берутся оттуда; иначе своё направление
  const world = worldCountry(input.code);
  const name = world ? world.ru : input.name.trim().replace(/\s+/g, " ").slice(0, 100);
  if (!name) return { error: "err.countryName" };
  const applyUrl = normalizeUrl(input.applyUrl);
  const appointmentUrl = normalizeUrl(input.appointmentUrl);
  if (applyUrl === "invalid" || appointmentUrl === "invalid") return { error: "err.countryUrl" };
  // варианты цен: пустые строки убираем; подпись без цены — ошибка
  const prices: PriceOption[] = [];
  for (const p of input.prices) {
    const label = p.label.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!label && !p.price.trim()) continue;
    const price = parseAmount(p.price);
    if (!p.price.trim() || !Number.isFinite(price) || price < 0) return { error: "err.countryPrice" };
    prices.push({ label, price, currency: currencyOf(p.currency) });
  }
  prices.splice(MAX_PRICES);
  return {
    data: {
      citizenship: input.citizenship,
      code: world?.code ?? null,
      name,
      region: world?.region ?? null,
      visaKind: VISA_KINDS.find((k) => k === input.visaKind) ?? null,
      // документы — по одному в строке, пустые строки убираем
      documents: input.documents
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n")
        .slice(0, 10_000),
      consularFee: text(input.consularFee, 300),
      prices,
      salePrice: prices[0]?.price ?? null,
      saleCurrency: prices[0]?.currency ?? "USD",
      processingTime: text(input.processingTime, 200),
      validity: text(input.validity, 200),
      whereToApply: text(input.whereToApply, 1000),
      applyUrl,
      appointmentUrl,
      visaCenter: text(input.visaCenter, 200),
      notes: text(input.notes, 10_000),
      sources: sourceLines(input.sources).join("\n") || null,
    },
  };
}

/** Документы списком: «1. Паспорт…» в начале строки убираем — номера ставит сам список */
export const documentLines = (documents: string) =>
  documents
    .split("\n")
    .map((l) => l.trim().replace(/^(\d+[.)]|[-•*–])\s*/, ""))
    .filter(Boolean);

/** Официальные источники — только ссылки на сайты, по одной в строке */
export function sourceLines(sources: string | null | undefined): string[] {
  const out: string[] = [];
  for (const line of (sources ?? "").split("\n")) {
    const u = normalizeUrl(line);
    if (u && u !== "invalid" && !out.includes(u)) out.push(u);
  }
  return out.slice(0, 20);
}

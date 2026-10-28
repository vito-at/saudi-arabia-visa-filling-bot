/**
 * Справочник виз: для гражданина страны (по умолчанию Узбекистан) — поездка в страну мира: нужна ли виза, документы,
 * консульский сбор, цена продажи, где подавать, сайты подачи и записи, визовый сервис, официальные источники.
 * Читают все сотрудники; правят администратор и визовые специалисты (canEditCountries); любая правка снимает
 * отметку «проверено», ставит её только администратор.
 */
import type { Currency, Role, VisaKind } from "@prisma/client";
import { parseAmount } from "@/lib/money";
import { isCitizenship, worldCountry, type Citizenship } from "@/lib/world";

export const VISA_KINDS: VisaKind[] = ["EVISA", "STICKER", "ON_ARRIVAL", "VISA_FREE"];

export const canEditCountries = (role: Role) => role === "ADMIN" || role === "VISA";

export interface CountryInput {
  citizenship: string;
  /** код страны поездки; пусто — своё направление (name) */
  code: string;
  name: string;
  visaKind: string;
  documents: string;
  consularFee: string;
  salePrice: string;
  saleCurrency: string;
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
  let salePrice: number | null = null;
  if (input.salePrice.trim()) {
    salePrice = parseAmount(input.salePrice);
    if (!Number.isFinite(salePrice) || salePrice < 0) return { error: "err.countryPrice" };
  }
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
      salePrice,
      saleCurrency: input.saleCurrency === "UZS" ? "UZS" : "USD",
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

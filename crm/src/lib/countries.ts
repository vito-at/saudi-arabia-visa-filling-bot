/**
 * Справочник стран для виз: документы, консульский сбор, цена продажи, где подавать, сайты подачи и записи,
 * визовый сервис. Читают все сотрудники; правят администратор и визовые специалисты (canEditCountries).
 */
import type { Currency, Role, VisaKind } from "@prisma/client";
import { parseAmount } from "@/lib/money";

export const VISA_KINDS: VisaKind[] = ["EVISA", "STICKER", "ON_ARRIVAL", "VISA_FREE"];

export const canEditCountries = (role: Role) => role === "ADMIN" || role === "VISA";

export interface CountryInput {
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
}

export interface CountryData {
  name: string;
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
export function parseCountry(input: CountryInput): { data: CountryData } | { error: "err.countryName" | "err.countryUrl" | "err.countryPrice" } {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 100);
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
      name,
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
    },
  };
}

/** Документы списком: «1. Паспорт…» в начале строки убираем — номера ставит сам список */
export const documentLines = (documents: string) =>
  documents
    .split("\n")
    .map((l) => l.trim().replace(/^(\d+[.)]|[-•*–])\s*/, ""))
    .filter(Boolean);

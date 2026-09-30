import type { Lang } from "@/lib/format";

export type Locale = Lang;
export const LOCALES: Locale[] = ["ru", "uz", "en"];
export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "lang";

/** Название языка на самом этом языке — для переключателя */
export const LOCALE_NAMES: Record<Locale, string> = { ru: "Русский", uz: "O‘zbekcha", en: "English" };
export const LOCALE_SHORT: Record<Locale, string> = { ru: "RU", uz: "UZ", en: "EN" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as string[]).includes(v);
}

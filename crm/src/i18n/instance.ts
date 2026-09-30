import type { Locale } from "./config";
import { createT, formatters } from "./core";
import { MESSAGES, ru } from "./messages";

/** Переводы для заданного языка — без зависимостей от Next.js (годится и для воркера) */
export function i18nFor(locale: Locale) {
  return { locale, t: createT(MESSAGES[locale], ru), f: formatters(locale) };
}

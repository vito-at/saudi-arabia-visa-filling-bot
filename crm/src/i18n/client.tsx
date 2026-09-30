"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { createT, formatters, type Formatters, type TFunction } from "./core";
import { MESSAGES, ru } from "./messages";

interface I18nValue {
  locale: Locale;
  t: TFunction;
  f: Formatters;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: createT(MESSAGES[locale], ru), f: formatters(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Переводы в клиентских компонентах */
export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n вне I18nProvider");
  return v;
}

import { formatDuration, formatMoney, formatMoneyRound, SUM_WORD } from "@/lib/format";
import type { Locale } from "./config";
import type { Messages } from "./messages/ru";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Ключ перевода: «leads.title», «errors.nameRequired» … */
export type TKey = Leaves<Messages>;
export type TVars = Record<string, string | number>;
export type TFunction = (key: TKey, vars?: TVars) => string;

function lookup(messages: Messages, key: string): string | undefined {
  let cur: unknown = messages;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in cur) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

/** t("leads.count", { n: 5 }) → «Лидов: 5»; подстановки в фигурных скобках */
export function createT(messages: Messages, fallback?: Messages): TFunction {
  return (key, vars) => {
    const raw = lookup(messages, key) ?? (fallback ? lookup(fallback, key) : undefined) ?? key;
    return vars ? raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : raw;
  };
}

/** Функции форматирования, привязанные к языку */
export function formatters(locale: Locale) {
  return {
    money: (n: number | null | undefined, currency: "UZS" | "USD" = "UZS") => formatMoney(n, currency, locale),
    moneyRound: (n: number | null | undefined, currency: "UZS" | "USD" = "UZS") => formatMoneyRound(n, currency, locale),
    duration: (minutes: number | null | undefined) => formatDuration(minutes, locale),
    sum: SUM_WORD[locale],
  };
}
export type Formatters = ReturnType<typeof formatters>;

import type { LeadSource, Role, ServiceType, StatusKind } from "@prisma/client";
import type { TFunction, TKey } from "./core";

/** Подписи перечислений на языке интерфейса */
export const sourceLabel = (t: TFunction, s: LeadSource | string) => t(`source.${s}` as TKey);
export const serviceLabel = (t: TFunction, s: ServiceType | string) => t(`service.${s}` as TKey);
export const roleLabel = (t: TFunction, r: Role | string) => t(`role.${r}` as TKey);
export const statusKindLabel = (t: TFunction, k: StatusKind | string) => t(`statusKind.${k}` as TKey);
export const fieldLabel = (t: TFunction, f: string) => t(`field.${f}` as TKey);

// Стандартные названия из seed: показываем их на языке пользователя, пока компания их не переименовала
const DEFAULT_STATUS_KEYS: Record<string, TKey> = {
  "Новый": "defaultStatus.new",
  "Взят в работу": "defaultStatus.inWork",
  "Не дозвонились": "defaultStatus.noAnswer",
  "Перезвонить": "defaultStatus.callback",
  "Консультация": "defaultStatus.consultation",
  "Отправлено предложение": "defaultStatus.offerSent",
  "Ожидает оплату": "defaultStatus.awaitingPayment",
  "Продано": "defaultStatus.won",
  "Отказ": "defaultStatus.lost",
};
const DEFAULT_REASON_KEYS: Record<string, TKey> = {
  "Дорого": "defaultReason.expensive",
  "Купил у конкурентов": "defaultReason.competitor",
  "Передумал / отложил поездку": "defaultReason.postponed",
  "Не дозвонились / не отвечает": "defaultReason.noAnswer",
  "Не оставлял заявку": "defaultReason.notApplied",
  "Не устроили даты": "defaultReason.dates",
  "Нет мест": "defaultReason.noSeats",
  "Отказ в визе": "defaultReason.visaDenied",
  "Просто интересовался": "defaultReason.justAsking",
  "Некачественный лид / спам": "defaultReason.spam",
  "Другое": "defaultReason.other",
};

export const statusName = (t: TFunction, name: string) => (DEFAULT_STATUS_KEYS[name] ? t(DEFAULT_STATUS_KEYS[name]) : name);
export const reasonName = (t: TFunction, name: string) => (DEFAULT_REASON_KEYS[name] ? t(DEFAULT_REASON_KEYS[name]) : name);

const SERVICE_RU: Record<string, TKey> = {
  "Авиабилеты": "service.FLIGHTS",
  "Тур": "service.TOUR",
  "Выездной тур": "service.TOUR",
  "Въездной тур": "service.TOUR",
  "Визовая поддержка": "service.VISA",
};

const SOURCE_RU: Record<string, TKey> = {
  "Facebook (реклама)": "source.META_FB",
  "Instagram (реклама)": "source.META_IG",
  "Звонок": "source.CALL",
  "Визит в офис": "source.WALK_IN",
  "Instagram Direct": "source.INSTAGRAM_DIRECT",
  "Telegram": "source.TELEGRAM",
};

/**
 * Значения в истории изменений хранятся текстом на момент записи (по-русски).
 * При показе переводим то, что узнаём: стандартные статусы и причины, источники и служебные пометки.
 */
export function historyValue(t: TFunction, value: string | null): string | null {
  if (!value) return value;
  if (DEFAULT_STATUS_KEYS[value]) return t(DEFAULT_STATUS_KEYS[value]);
  if (SERVICE_RU[value]) return t(SERVICE_RU[value]);
  let v = value;
  for (const [ru, key] of Object.entries(DEFAULT_REASON_KEYS)) if (v.startsWith(ru)) v = t(key) + v.slice(ru.length);
  for (const [ru, key] of Object.entries(SOURCE_RU)) if (v.startsWith(ru)) v = t(key) + v.slice(ru.length);
  return v
    .replace(", прибыль ", `, ${t("deal.profit").toLowerCase()} `)
    .replace("(автоматически)", t("history.auto")).replace("повторное обращение", t("history.repeat")).replace(/^удалена$/, t("history.deleted"));
}

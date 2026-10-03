import type { Currency, LeadSource, Role, ServiceType, StatusKind } from "@prisma/client";

// Русские подписи ниже — канонический текст для записей в истории изменений (хранится в БД).
// В интерфейсе подписи берутся из словарей i18n (см. src/i18n/labels.ts).

export const SOURCES: LeadSource[] = ["META_FB", "META_IG", "CALL", "INSTAGRAM_DIRECT", "TELEGRAM", "WALK_IN", "OTHER"];
export const SERVICE_TYPES: ServiceType[] = ["FLIGHTS", "TOUR", "VISA", "OTHER"];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  META_FB: "Facebook (реклама)",
  META_IG: "Instagram (реклама)",
  CALL: "Звонок",
  INSTAGRAM_DIRECT: "Instagram Direct",
  TELEGRAM: "Telegram",
  WALK_IN: "Визит в офис",
  OTHER: "Другое",
};

/** Источники, которые можно выбрать при ручном создании лида */
export const MANUAL_SOURCES: LeadSource[] = ["CALL", "INSTAGRAM_DIRECT", "TELEGRAM", "WALK_IN", "OTHER"];

export const SERVICE_LABELS: Record<ServiceType, string> = {
  FLIGHTS: "Авиабилеты",
  TOUR: "Тур",
  VISA: "Визовая поддержка",
  OTHER: "Другое",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
};

export const CURRENCY_LABELS: Record<Currency, string> = { UZS: "UZS (сум)", USD: "USD ($)" };

export const STATUS_KIND_LABELS: Record<StatusKind, string> = {
  NEW: "Новый (входящий)",
  IN_PROGRESS: "В работе",
  CALLBACK: "Перезвонить (с датой звонка)",
  WON: "Продажа",
  LOST: "Отказ",
  OTHER: "Промежуточный",
};

export const DEFAULT_STATUSES: { name: string; color: string; kind: StatusKind; isSystem?: boolean; inFunnel?: boolean }[] = [
  { name: "Новый", color: "#3b82f6", kind: "NEW", isSystem: true },
  { name: "Не дозвонились", color: "#f59e0b", kind: "OTHER", inFunnel: false },
  { name: "Перезвонить", color: "#fa6500", kind: "CALLBACK", isSystem: true, inFunnel: false },
  { name: "Консультация", color: "#06b6d4", kind: "OTHER" },
  { name: "Ожидает оплату", color: "#ec4899", kind: "OTHER" },
  { name: "Продано", color: "#16a34a", kind: "WON", isSystem: true },
  { name: "Отказ", color: "#dc2626", kind: "LOST", isSystem: true },
];

export const DEFAULT_LOSS_REASONS = [
  "Дорого",
  "Купил у конкурентов",
  "Передумал / отложил поездку",
  "Не дозвонились / не отвечает",
  "Не устроили даты",
  "Нет мест",
  "Отказ в визе",
  "Просто интересовался",
  "Некачественный лид / спам",
  "Другое",
];

/** Поля лида, изменения которых пишутся в историю */
export const FIELD_LABELS: Record<string, string> = {
  status: "Статус",
  manager: "Менеджер",
  name: "Имя",
  phone: "Телефон",
  email: "Email",
  serviceType: "Тип услуги",
  destination: "Направление",
  travelFrom: "Дата поездки с",
  travelTo: "Дата поездки по",
  travelers: "Кол-во туристов",
  lossReason: "Причина отказа",
  lossComment: "Комментарий к отказу",
  source: "Источник",
  created: "Лид создан",
  deal: "Сделка",
  callback: "Перезвонить",
};

/** Статусы с особой логикой: их нельзя добавить повторно или удалить */
export const SPECIAL_STATUS_KINDS: StatusKind[] = ["NEW", "CALLBACK", "WON", "LOST"];

/** За сколько минут до звонка напоминать менеджеру */
export const CALLBACK_REMIND_MIN = 10;

/** «Постоянный клиент» — у клиента от 3 сделок (покупок любых услуг) */
export const REGULAR_CLIENT_MIN_DEALS = 3;
export const isRegularClient = (deals: number) => deals >= REGULAR_CLIENT_MIN_DEALS;

/**
 * Страны для «Визовой поддержки». В лиде сохраняется русское название (поле «Направление»);
 * aliases — написания, которые встречаются в старых записях и формах Meta.
 */
export const VISA_COUNTRIES = [
  { ru: "Сингапур", uz: "Singapur", en: "Singapore", aliases: ["singapore", "singapur", "сингапур"] },
  { ru: "Таиланд", uz: "Tailand", en: "Thailand", aliases: ["тайланд", "таиланд", "thailand", "tailand", "tayland"] },
  { ru: "Вьетнам", uz: "Vyetnam", en: "Vietnam", aliases: ["вьетнам", "vietnam", "vyetnam", "vetnam"] },
  { ru: "Саудовская Аравия", uz: "Saudiya Arabistoni", en: "Saudi Arabia", aliases: ["саудовская аравия", "саудия", "saudi arabia", "saudiya arabistoni", "saudiya"] },
  { ru: "Кыргызстан", uz: "Qirg‘iziston", en: "Kyrgyzstan", aliases: ["кыргызстан", "киргизия", "kyrgyzstan", "qirg‘iziston", "qirgiziston"] },
] as const;

/** Русское название страны из списка по любому известному написанию, иначе null */
export function matchVisaCountry(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  return VISA_COUNTRIES.find((c) => c.ru.toLowerCase() === v || c.aliases.some((a) => a === v))?.ru ?? null;
}

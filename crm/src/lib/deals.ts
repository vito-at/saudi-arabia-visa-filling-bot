import type { Currency, ServiceType } from "@prisma/client";

/**
 * Сделка закрывается сразу, без ожидания себестоимости от администратора, только для визовой поддержки —
 * расходы на визы учитываются в расходах компании. Остальные сделки ждут себестоимость.
 */
export function dealClosesWithoutCost(serviceType: ServiceType | null): boolean {
  return serviceType === "VISA";
}

/** Себестоимость авиабилетов менеджер указывает сам при закрытии сделки — она известна сразу (цена билета у перевозчика) */
export function managerEntersCost(service: ServiceType | null | undefined): boolean {
  return service === "FLIGHTS";
}

/**
 * Проверка валюты суммы. В окне сделки по умолчанию выбран «$», и сумму в сумах легко сохранить как доллары:
 * 2 500 000 сум превращаются в 2 500 000 $ — продажи и зарплата менеджера вырастают в тысячи раз.
 * Сделок от 100 000 $ у агентства не бывает, а сделок дешевле 10 000 сум (меньше доллара) — тоже.
 */
export const USD_DEAL_MAX = 100_000;
export const UZS_DEAL_MIN = 10_000;

/** "usd" — сумма слишком большая для долларов (похоже, это сумы), "uzs" — слишком маленькая для сумов (похоже, доллары) */
export function currencyMismatch(amount: number, currency: Currency): "usd" | "uzs" | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (currency === "USD" && amount >= USD_DEAL_MAX) return "usd";
  if (currency === "UZS" && amount < UZS_DEAL_MIN) return "uzs";
  return null;
}

/**
 * Себестоимость визовой сделки, которая подставляется автоматически: пока только Таиланд —
 * цена одной визы ($, «Настройки → Общие») × число заявлений. null — не подставлять (расходы на визы — в расходах компании).
 */
export function autoVisaCostUsd(country: string | null | undefined, applications: number, thaiCostUsd: number): number | null {
  if (!(thaiCostUsd > 0) || !(applications > 0)) return null;
  const v = country?.trim().toLowerCase();
  if (!v) return null;
  const thai = ["таиланд", "тайланд", "thailand", "tailand", "tayland"];
  // страна — из списка («Таиланд») или из подробностей продукта («Таиланд, 2 заявл.»)
  return thai.some((t) => v === t || v.startsWith(`${t},`) || v.startsWith(`${t} `)) ? Math.round(thaiCostUsd * applications * 100) / 100 : null;
}

/** Название продукта сделки: тип услуги из списка и, если указаны, подробности — «Тур: Дубай, 7 ночей» */
export function composeProduct(label: string, details: string): string {
  const d = details.trim();
  return d ? `${label}: ${d}` : label;
}

/** Разобрать название продукта обратно: тип услуги (по подписям из списка) и подробности; старые произвольные названия — целиком в подробности */
export function splitProduct(product: string, labels: Record<ServiceType, string>): { service: ServiceType | ""; details: string } {
  const p = product.trim();
  for (const [service, label] of Object.entries(labels) as [ServiceType, string][]) {
    if (p === label) return { service, details: "" };
    if (p.startsWith(`${label}: `)) return { service, details: p.slice(label.length + 2) };
  }
  return { service: "", details: p };
}

/** Данные лида, которыми заполняется окно сделки */
export interface LeadPrefill {
  serviceType: ServiceType | null;
  destination: string | null;
  travelFrom: string; // YYYY-MM-DD или ""
  travelTo: string;
  travelers: number | null;
  visaApplications: number | null;
}

/** Части подробностей через запятую, пустые пропускаются: «Дубай, 10.10.2026 — 17.10.2026, 2 чел.» */
export function joinDetails(parts: (string | null | undefined | false)[]): string {
  return parts
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(", ");
}

/** Что из визовых данных сделки записать в лид: только незаполненные поля */
export function visaLeadPatch(
  lead: { destination: string | null; visaApplications: number | null },
  input: { destination?: string | null; visaApplications?: number | null },
): { destination?: string; visaApplications?: number } {
  const patch: { destination?: string; visaApplications?: number } = {};
  const dest = input.destination?.trim();
  if (!lead.destination?.trim() && dest) patch.destination = dest.slice(0, 120);
  const n = input.visaApplications;
  if (lead.visaApplications == null && n != null && Number.isInteger(n) && n >= 1 && n <= 500) patch.visaApplications = n;
  return patch;
}

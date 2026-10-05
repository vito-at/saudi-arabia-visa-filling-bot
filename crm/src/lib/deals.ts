import type { ServiceType } from "@prisma/client";

/**
 * Сделка закрывается сразу, без ожидания себестоимости от администратора, только для визовой поддержки —
 * расходы на визы учитываются в расходах компании. Остальные сделки ждут себестоимость.
 */
export function dealClosesWithoutCost(serviceType: ServiceType | null): boolean {
  return serviceType === "VISA";
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

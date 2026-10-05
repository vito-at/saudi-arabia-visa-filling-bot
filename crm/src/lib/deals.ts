import type { Role, ServiceType } from "@prisma/client";

/**
 * Сделка закрывается сразу, без ожидания себестоимости от администратора:
 * если её вносит администратор, или это визовая поддержка — расходы на визы учитываются в расходах компании.
 */
export function dealClosesWithoutCost(role: Role, serviceType: ServiceType | null): boolean {
  return role === "ADMIN" || serviceType === "VISA";
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

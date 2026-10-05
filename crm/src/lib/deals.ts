import type { Role, ServiceType } from "@prisma/client";

/**
 * Сделка закрывается сразу, без ожидания себестоимости от администратора:
 * если её вносит администратор, или это визовая поддержка — расходы на визы учитываются в расходах компании.
 */
export function dealClosesWithoutCost(role: Role, serviceType: ServiceType | null): boolean {
  return role === "ADMIN" || serviceType === "VISA";
}

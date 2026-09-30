import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./session";
import { prisma } from "./db";
import { AccessError } from "./session";

/** Фильтр видимости лидов: менеджер видит свои и нераспределённые. */
export function leadScope(user: CurrentUser): Prisma.LeadWhereInput {
  if (user.role === "ADMIN") return {};
  return { OR: [{ managerId: user.id }, { managerId: null }] };
}

/** Клиенты менеджера — те, у кого есть его лиды. */
export function clientScope(user: CurrentUser): Prisma.ClientWhereInput {
  if (user.role === "ADMIN") return {};
  return { leads: { some: { managerId: user.id } } };
}

/** Фильтр для отчётов: менеджер видит только свои данные. */
export function reportLeadScope(user: CurrentUser, managerId?: string | null): Prisma.LeadWhereInput {
  if (user.role !== "ADMIN") return { managerId: user.id };
  if (managerId === "none") return { managerId: null };
  return managerId ? { managerId } : {};
}

export async function getLeadForUser(user: CurrentUser, leadId: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...leadScope(user) } });
  if (!lead) throw new AccessError("Лид не найден или нет доступа");
  return lead;
}

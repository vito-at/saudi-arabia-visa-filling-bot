import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { CALLBACK_REMIND_MIN } from "./constants";
import type { CurrentUser } from "./session";

export interface CallbackItem {
  id: string;
  name: string;
  phone: string | null;
  callbackAt: string;
  manager: string | null;
}

/**
 * Лиды в статусе «Перезвонить», у которых звонок уже наступил или наступит в пределах horizonMin.
 * personal = только свои и нераспределённые (для всплывающих напоминаний, в том числе у администратора).
 */
export async function loadCallbacks(user: CurrentUser, opts: { horizonMin?: number; personal?: boolean } = {}): Promise<CallbackItem[]> {
  const until = new Date(Date.now() + (opts.horizonMin ?? CALLBACK_REMIND_MIN + 5) * 60_000);
  const who: Prisma.LeadWhereInput =
    opts.personal || user.role !== "ADMIN" ? { OR: [{ managerId: user.id }, { managerId: null }] } : {};
  const rows = await prisma.lead.findMany({
    where: { ...who, status: { kind: "CALLBACK" }, callbackAt: { not: null, lte: until } },
    orderBy: { callbackAt: "asc" },
    take: 50,
    select: { id: true, name: true, phone: true, phoneRaw: true, callbackAt: true, manager: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone ?? r.phoneRaw, callbackAt: r.callbackAt!.toISOString(), manager: r.manager?.name ?? null }));
}

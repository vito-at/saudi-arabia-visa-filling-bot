import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Round-robin: следующий менеджер — активный менеджер, которому дольше всех не назначали лид.
 * Возвращает id менеджера или null, если режим ручной или менеджеров нет.
 */
export async function pickNextManager(tx: Tx): Promise<string | null> {
  const settings = await tx.appSettings.findUnique({ where: { id: 1 } });
  if (settings?.distributionMode !== "ROUND_ROBIN") return null;
  const managers = await tx.user.findMany({
    where: { role: "MANAGER", isActive: true },
    select: { id: true, lastAssignedAt: true, createdAt: true },
  });
  if (managers.length === 0) return null;
  const next = pickRoundRobin(managers);
  await tx.user.update({ where: { id: next.id }, data: { lastAssignedAt: new Date() } });
  return next.id;
}

/** Чистая функция выбора — отдельно, чтобы покрыть тестом. */
export function pickRoundRobin<T extends { id: string; lastAssignedAt: Date | null; createdAt: Date }>(managers: T[]): T {
  return [...managers].sort((a, b) => {
    const at = a.lastAssignedAt?.getTime() ?? -1;
    const bt = b.lastAssignedAt?.getTime() ?? -1;
    if (at !== bt) return at - bt;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

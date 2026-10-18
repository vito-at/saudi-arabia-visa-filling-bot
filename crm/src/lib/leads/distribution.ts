import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

const DISTRIBUTION_LOCK = 7_340_002;

/**
 * Round-robin: следующий менеджер — активный менеджер, которому дольше всех не назначали лид.
 * Возвращает id менеджера или null, если режим ручной или менеджеров нет.
 */
export async function pickNextManager(tx: Tx): Promise<string | null> {
  const settings = await tx.appSettings.findUnique({ where: { id: 1 } });
  if (settings?.distributionMode !== "ROUND_ROBIN") return null;
  // лиды приходят пачками (загрузка из Meta, вебхук) — без очереди параллельные транзакции видят одного и того же
  // «следующего» менеджера и отдают ему несколько лидов подряд. Блокировка держится до конца транзакции создания лида.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DISTRIBUTION_LOCK})`;
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

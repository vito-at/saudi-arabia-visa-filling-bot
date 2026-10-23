/**
 * Автораспределение лидов. Лиды получают только менеджеры «в работе» (переключатель в меню), и у каждого одновременно
 * не больше N необработанных лидов (статус «Новый», N — в «Настройках»). Остальные новые лиды копятся в очереди
 * без ответственного. Менеджер обработал лид (сменил статус) или вышел на работу — ему сразу выдаются самые старые
 * лиды из очереди до лимита. Ушёл с работы — его необработанные лиды возвращаются в очередь.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyLeadAssigned } from "@/lib/notify";

/** Ташкентская дата как ключ колонки @db.Date (Prisma хранит дату по UTC) */

type Tx = Prisma.TransactionClient | PrismaClient;

const DISTRIBUTION_LOCK = 7_340_002;

/** Лиды в очереди: без ответственного, в статусе «Новый» (лиды «Не дозвонились» из общего списка сюда не входят) */
export const queuedLeadWhere: Prisma.LeadWhereInput = { managerId: null, hiddenFromManagers: false, status: { kind: "NEW" } };

/** Включено ли автораспределение лидов */
export async function isAutoDistribution(): Promise<boolean> {
  return !!(await isAuto(prisma));
}

async function isAuto(tx: Tx) {
  const s = await tx.appSettings.findUnique({ where: { id: 1 }, select: { distributionMode: true, leadLimit: true } });
  return s?.distributionMode === "ROUND_ROBIN" ? { limit: s.leadLimit } : null;
}

/** Сколько необработанных лидов у менеджеров */
async function newCounts(tx: Tx, ids: string[]) {
  const rows = await tx.lead.groupBy({ by: ["managerId"], where: { managerId: { in: ids }, status: { kind: "NEW" } }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.managerId!, r._count._all]));
}

/**
 * Повторного клиента отдаём менеджеру, который вёл его раньше. При автораспределении — только если у него есть место;
 * иначе лид идёт в общую очередь. (Переключателя «В работе» больше нет: раздача — всем активным менеджерам.)
 */
export async function canReceive(tx: Tx, managerId: string): Promise<boolean> {
  const auto = await isAuto(tx);
  if (!auto) return true;
  const m = await tx.user.findFirst({ where: { id: managerId, role: "MANAGER", isActive: true }, select: { id: true } });
  if (!m) return false;
  return ((await newCounts(tx, [m.id])).get(m.id) ?? 0) < auto.limit;
}

/**
 * Менеджер сам берёт лид из очереди («Взять», смена статуса, ответ в чате): при автораспределении — пока у него
 * меньше лимита необработанных. Возвращает ключ ошибки или null.
 */
export async function takeBlocked(tx: Tx, managerId: string): Promise<"err.leadLimit" | null> {
  const auto = await isAuto(tx);
  if (!auto) return null;
  const m = await tx.user.findUnique({ where: { id: managerId }, select: { role: true } });
  if (m?.role !== "MANAGER") return null;
  return ((await newCounts(tx, [managerId])).get(managerId) ?? 0) >= auto.limit ? "err.leadLimit" : null;
}

/**
 * Раздача очереди: самые старые лиды — активным менеджерам, у которых меньше лимита, по кругу
 * (следующим получает тот, кому дольше всех не давали). Возвращает число выданных лидов.
 */
export async function distributeQueue(): Promise<number> {
  const given = await prisma.$transaction(async (tx) => {
    const auto = await isAuto(tx);
    if (!auto) return [];
    // лиды приходят пачками (загрузка из Meta, вебхук) и менеджеры меняют статусы одновременно —
    // без блокировки параллельные раздачи отдали бы один лид дважды или превысили лимит
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DISTRIBUTION_LOCK})`;
    const managers = await tx.user.findMany({
      where: { role: "MANAGER", isActive: true },
      select: { id: true, name: true, lastAssignedAt: true, createdAt: true },
    });
    if (!managers.length) return [];
    const counts = await newCounts(
      tx,
      managers.map((m) => m.id),
    );
    const free = new Map(managers.map((m) => [m.id, Math.max(0, auto.limit - (counts.get(m.id) ?? 0))]));
    const total = [...free.values()].reduce((a, b) => a + b, 0);
    if (!total) return [];
    const queue = await tx.lead.findMany({ where: queuedLeadWhere, orderBy: { createdAt: "asc" }, take: total, select: { id: true, name: true } });

    const out: { id: string; name: string; managerId: string }[] = [];
    let at = Date.now();
    for (const lead of queue) {
      const open = managers.filter((m) => (free.get(m.id) ?? 0) > 0);
      if (!open.length) break;
      const m = pickRoundRobin(open);
      const now = new Date(at++);
      const { count } = await tx.lead.updateMany({ where: { id: lead.id, managerId: null }, data: { managerId: m.id, assignedAt: now } });
      if (!count) continue;
      await tx.leadHistory.create({ data: { leadId: lead.id, userId: null, field: "manager", newValue: `${m.name} (автоматически)` } });
      m.lastAssignedAt = now;
      free.set(m.id, (free.get(m.id) ?? 0) - 1);
      out.push({ ...lead, managerId: m.id });
    }
    for (const m of managers) if (out.some((o) => o.managerId === m.id)) await tx.user.update({ where: { id: m.id }, data: { lastAssignedAt: m.lastAssignedAt } });
    return out;
  });
  for (const l of given) await notifyLeadAssigned(l, null).catch(() => undefined);
  return given.length;
}

/** Раздача после действия пользователя: её сбой не должен ломать само действие (повторит воркер через минуту) */
export function distributeSoon() {
  return distributeQueue().catch((e) => console.error("Распределение лидов:", e));
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

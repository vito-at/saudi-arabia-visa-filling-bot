/**
 * «В работе» менеджера.
 * - Включил — при автораспределении получает лиды; день отмечается для деления процента с авиабилетов.
 * - Час ничего не нажимал в CRM — «В работе» выключается само (воркер, endIdleShifts), необработанные лиды уходят в очередь.
 * - Время работы за день (ShiftDay.activeSec) копится, пока менеджер «В работе» и действует в CRM: браузер сообщает
 *   о нажатиях и вводе текста (touchActivity), к дню прибавляется время с прошлого действия, но не больше часа.
 *   Меньше 4 часов за день — менеджер не входит в деление процента с авиабилетов в этот день (см. salary.ts).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toInputDate } from "@/lib/format";
import { distributeQueue, releaseNewLeads } from "@/lib/leads/distribution";

/** Без действий в CRM дольше этого — «В работе» выключается */
export const SHIFT_IDLE_MS = 60 * 60_000;
/** Меньше стольких секунд «В работе» за день — без доли с авиабилетов */
export const FLIGHT_MIN_ACTIVE_SEC = 4 * 3600;

/** Ташкентская дата как ключ колонки @db.Date (Prisma хранит дату по UTC) */
export const dayKey = (d: Date) => new Date(`${toInputDate(d)}T00:00:00Z`);

/** Сколько секунд засчитать с прошлого действия: не больше часа (дольше — «В работе» уже выключилось бы) */
export function activeDelta(prev: Date | null, now: Date): number {
  if (!prev) return 0;
  const ms = Math.min(now.getTime() - prev.getTime(), SHIFT_IDLE_MS);
  return ms > 0 ? Math.round(ms / 1000) : 0;
}

type Tx = Prisma.TransactionClient;

async function addActive(tx: Tx, userId: string, now: Date, sec: number) {
  const day = dayKey(now);
  await tx.shiftDay.upsert({ where: { userId_day: { userId, day } }, update: { activeSec: { increment: sec } }, create: { userId, day, activeSec: sec } });
}

/** Строка менеджера с блокировкой: параллельные отметки не должны засчитать одно и то же время дважды */
async function lockUser(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<{ onShift: boolean; lastSeenAt: Date | null; role: string }[]>`
    SELECT "onShift", "lastSeenAt", role::text AS role FROM "User" WHERE id = ${userId} FOR UPDATE`;
  return rows[0] ?? null;
}

/** Менеджер что-то нажал в CRM. Возвращает, «В работе» ли он сейчас (переключатель мог выключиться сам). */
export async function touchActivity(userId: string): Promise<boolean> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const u = await lockUser(tx, userId);
    if (!u || u.role !== "MANAGER") return false;
    if (u.onShift) {
      const sec = activeDelta(u.lastSeenAt, now);
      if (sec > 0) await addActive(tx, userId, now, sec);
    }
    await tx.user.update({ where: { id: userId }, data: { lastSeenAt: now } });
    return u.onShift;
  });
}

/**
 * Переключатель «В работе». Ушёл с работы — необработанные лиды возвращаются в очередь и достаются тем, кто в работе;
 * пришёл — сразу получает самые старые лиды из очереди.
 */
export async function setOnShift(userId: string, on: boolean) {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const u = await lockUser(tx, userId);
    if (!u || u.role !== "MANAGER" || u.onShift === on) return;
    if (on) {
      // день работы — для деления процента с авиабилетов; время пойдёт с этого момента
      await addActive(tx, userId, now, 0);
    } else {
      const sec = activeDelta(u.lastSeenAt, now);
      if (sec > 0) await addActive(tx, userId, now, sec);
      await releaseNewLeads(tx, [userId], "очередь (менеджер не в работе)");
    }
    await tx.user.update({ where: { id: userId }, data: { onShift: on, lastSeenAt: now } });
  });
  await distributeQueue();
}

/** Воркер: «В работе», но час ничего не делали в CRM — выключаем. Время после последнего действия не засчитывается. */
export async function endIdleShifts(now = new Date()): Promise<number> {
  const idleSince = new Date(now.getTime() - SHIFT_IDLE_MS);
  const ids = await prisma.$transaction(async (tx) => {
    const idle = await tx.user.findMany({
      where: { role: "MANAGER", onShift: true, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: idleSince } }] },
      select: { id: true },
    });
    if (!idle.length) return [];
    const list = idle.map((u) => u.id);
    // условие повторяем: менеджер мог нажать что-то между выборкой и обновлением
    await tx.user.updateMany({ where: { id: { in: list }, onShift: true, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: idleSince } }] }, data: { onShift: false } });
    const off = (await tx.user.findMany({ where: { id: { in: list }, onShift: false }, select: { id: true } })).map((u) => u.id);
    await releaseNewLeads(tx, off, "очередь (час без действий в CRM)");
    return off;
  });
  if (ids.length) await distributeQueue();
  return ids.length;
}

/** Сколько секунд менеджер «В работе» сегодня */
export async function activeToday(userId: string): Promise<number> {
  const d = await prisma.shiftDay.findUnique({ where: { userId_day: { userId, day: dayKey(new Date()) } }, select: { activeSec: true } });
  return d?.activeSec ?? 0;
}

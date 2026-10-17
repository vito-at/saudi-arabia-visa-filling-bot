/**
 * Напоминание после поездки: на следующий день после даты возвращения (из анкеты клиента) менеджер получает задачу
 * «Спросить, как прошла поездка» — отзыв, повторная продажа, рекомендации. Только для лидов с продажей.
 */
import { prisma } from "@/lib/db";
import { toInputDate } from "@/lib/format";
import { notify } from "@/lib/notify";

export const TRIP_TASK_TITLE = "Спросить, как прошла поездка";
/** вернувшихся раньше этого срока не трогаем (дату возвращения заполнили задним числом) */
const MAX_AGE_DAYS = 7;

const dayStart = (d: Date) => new Date(`${toInputDate(d)}T00:00:00+05:00`);

export async function createTripFollowUps(now = new Date()): Promise<number> {
  const today = dayStart(now);
  const leads = await prisma.lead.findMany({
    where: {
      tripFollowUpAt: null,
      travelTo: { lt: today, gte: new Date(today.getTime() - MAX_AGE_DAYS * 86_400_000) },
      deals: { some: {} },
    },
    select: { id: true, managerId: true, name: true },
  });
  if (!leads.length) return 0;
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  // задача на 11:00 сегодня (если уже позже — на текущий момент)
  const due = new Date(Math.max(today.getTime() + 11 * 3_600_000, now.getTime()));
  let created = 0;
  for (const l of leads) {
    const assigneeId = l.managerId ?? admin?.id;
    if (!assigneeId) continue;
    await prisma.$transaction([
      prisma.task.create({ data: { leadId: l.id, assigneeId, createdById: assigneeId, title: TRIP_TASK_TITLE, dueAt: due } }),
      prisma.lead.update({ where: { id: l.id }, data: { tripFollowUpAt: now } }),
    ]);
    await notify([{ userId: assigneeId, type: "trip", key: `trip:${l.id}`, link: `/leads/${l.id}`, data: { name: l.name } }]);
    created++;
  }
  return created;
}

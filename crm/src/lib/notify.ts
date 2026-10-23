/**
 * Уведомления сотрудникам (колокольчик). Каждое событие — одно уведомление (ключ key), текст собирается на языке
 * пользователя из type + data. Сбой записи уведомления никогда не мешает основному действию.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type NotificationType = "lead" | "task" | "cost" | "trip" | "chat" | "pool" | "ai" | "visa" | "visaNew" | "visaFix" | "visaMsg";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  key: string;
  link?: string | null;
  data?: Record<string, string | number | null>;
}

export async function notify(items: NotifyInput[]): Promise<number> {
  if (!items.length) return 0;
  try {
    const r = await prisma.notification.createMany({
      data: items.map((i) => ({ userId: i.userId, type: i.type, key: i.key, link: i.link ?? null, data: (i.data ?? {}) as Prisma.InputJsonValue })),
      skipDuplicates: true,
    });
    return r.count;
  } catch (e) {
    console.error("notify:", e);
    return 0;
  }
}

async function adminIds(): Promise<string[]> {
  return (await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } })).map((u) => u.id);
}

/** Лид без ответственного (общий список): о нём и о сообщениях по нему узнают все активные менеджеры и администраторы */
export async function poolRecipients(): Promise<string[]> {
  return (await prisma.user.findMany({ where: { isActive: true, role: { in: ["MANAGER", "ADMIN"] } }, select: { id: true } })).map((u) => u.id);
}

/** Новый лид попал в общий список (ручное распределение) — уведомление всем, кто может его взять */
export async function notifyPoolLead(lead: { id: string; name: string }) {
  const users = await poolRecipients();
  await notify(users.map((userId) => ({ userId, type: "pool" as const, key: `pool:${lead.id}`, link: `/leads/${lead.id}`, data: { name: lead.name } })));
}

/** Новый лид у менеджера (автораспределение, назначение администратором) */
export async function notifyLeadAssigned(lead: { id: string; name: string; managerId: string | null }, actorId?: string | null) {
  if (!lead.managerId || lead.managerId === actorId) return;
  await notify([{ userId: lead.managerId, type: "lead", key: `lead:${lead.id}:${lead.managerId}`, link: `/leads/${lead.id}`, data: { name: lead.name } }]);
}

/** Сделку закрыл менеджер — администраторам: указать себестоимость */
export async function notifyCostPending(deal: { id: string; leadId: string; product: string; leadName: string }) {
  const admins = await adminIds();
  await notify(admins.map((userId) => ({ userId, type: "cost" as const, key: `cost:${deal.id}`, link: "/finance", data: { name: deal.leadName, product: deal.product } })));
}

/**
 * Периодическая проверка (воркер): просроченные задачи — исполнителю.
 */
export async function scanNotifications(now = new Date()): Promise<number> {
  const tasks = await prisma.task.findMany({
    where: { doneAt: null, dueAt: { lt: now, gt: new Date(now.getTime() - 7 * 86_400_000) } },
    select: { id: true, title: true, assigneeId: true, leadId: true, lead: { select: { name: true } } },
    take: 500,
  });
  const items: NotifyInput[] = [];
  for (const t of tasks) {
    items.push({ userId: t.assigneeId, type: "task", key: `task:${t.id}`, link: t.leadId ? `/leads/${t.leadId}` : "/tasks", data: { title: t.title, name: t.lead?.name ?? null } });
  }
  return notify(items);
}

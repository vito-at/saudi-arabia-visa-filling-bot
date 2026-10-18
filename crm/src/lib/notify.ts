/**
 * Уведомления сотрудникам (колокольчик). Каждое событие — одно уведомление (ключ key), текст собирается на языке
 * пользователя из type + data. Сбой записи уведомления никогда не мешает основному действию.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toInputDate } from "@/lib/format";
import { toNum } from "@/lib/money";

export type NotificationType = "lead" | "task" | "debt" | "cost" | "trip" | "chat" | "pool" | "ai" | "visa" | "visaNew";

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
 * Периодическая проверка (воркер): просроченные задачи — исполнителю; долги со сроком сегодня или просроченные —
 * менеджеру и администраторам (раз в день по каждой сделке).
 */
export async function scanNotifications(now = new Date()): Promise<number> {
  const today = toInputDate(now);
  const endOfDay = new Date(new Date(`${today}T00:00:00+05:00`).getTime() + 86_400_000);
  const [tasks, debts, admins] = await Promise.all([
    prisma.task.findMany({
      where: { doneAt: null, dueAt: { lt: now, gt: new Date(now.getTime() - 7 * 86_400_000) } },
      select: { id: true, title: true, assigneeId: true, leadId: true, lead: { select: { name: true } } },
      take: 500,
    }),
    prisma.deal.findMany({
      where: { paidAmount: { lt: prisma.deal.fields.amount }, dueAt: { lt: endOfDay } },
      select: { id: true, amount: true, paidAmount: true, currency: true, dueAt: true, managerId: true, lead: { select: { id: true, name: true, managerId: true } } },
      take: 500,
    }),
    adminIds(),
  ]);
  const items: NotifyInput[] = [];
  for (const t of tasks) {
    items.push({ userId: t.assigneeId, type: "task", key: `task:${t.id}`, link: t.leadId ? `/leads/${t.leadId}` : "/tasks", data: { title: t.title, name: t.lead?.name ?? null } });
  }
  for (const d of debts) {
    const left = Math.round((toNum(d.amount) - toNum(d.paidAmount)) * 100) / 100;
    // менеджеру — только по его клиентам (лид за ним), администраторам — все
    const users = new Set([d.lead.managerId, ...admins].filter(Boolean) as string[]);
    for (const userId of users) {
      items.push({ userId, type: "debt", key: `debt:${d.id}:${today}`, link: "/debtors", data: { name: d.lead.name, left, currency: d.currency, due: d.dueAt ? toInputDate(d.dueAt) : null } });
    }
  }
  return notify(items);
}

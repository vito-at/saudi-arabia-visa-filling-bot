/** Календарь: задачи и звонки, сроки оплаты долгов, вылеты и возвращения клиентов с продажей */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toInputDate, formatTime } from "@/lib/format";
import { toNum } from "@/lib/money";
import type { CurrentUser } from "@/lib/session";
import type { MonthRange } from "@/lib/salary";

export type CalendarKind = "callback" | "task" | "debt" | "depart" | "return";

export interface CalendarItem {
  day: string; // YYYY-MM-DD по Ташкенту
  time: string | null;
  kind: CalendarKind;
  title: string;
  sub: string | null;
  link: string;
  done: boolean;
}

/** userId — чей календарь (менеджер — всегда свой; администратор — все или выбранный) */
export async function loadCalendar(range: MonthRange, user: CurrentUser, userId: string | null): Promise<CalendarItem[]> {
  const owner = user.role === "ADMIN" ? userId : user.id;
  const leadOwner: Prisma.LeadWhereInput = owner ? { managerId: owner } : {};
  const inMonth = { gte: range.from, lt: range.to };
  const [tasks, debts, trips] = await Promise.all([
    prisma.task.findMany({
      where: { dueAt: inMonth, ...(owner ? { assigneeId: owner } : {}) },
      select: { id: true, title: true, dueAt: true, doneAt: true, isCallback: true, leadId: true, lead: { select: { name: true } }, assignee: { select: { name: true } } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.deal.findMany({
      where: { dueAt: inMonth, paidAmount: { lt: prisma.deal.fields.amount }, lead: leadOwner },
      select: { id: true, amount: true, paidAmount: true, currency: true, dueAt: true, lead: { select: { id: true, name: true } } },
    }),
    prisma.lead.findMany({
      where: { ...leadOwner, deals: { some: {} }, OR: [{ travelFrom: inMonth }, { travelTo: inMonth }] },
      select: { id: true, name: true, destination: true, travelFrom: true, travelTo: true },
    }),
  ]);
  const items: CalendarItem[] = [];
  for (const t of tasks) {
    items.push({
      day: toInputDate(t.dueAt),
      time: formatTime(t.dueAt),
      kind: t.isCallback ? "callback" : "task",
      title: t.lead?.name ?? t.title,
      sub: [t.lead ? t.title : null, user.role === "ADMIN" && !owner ? t.assignee.name : null].filter(Boolean).join(" · ") || null,
      link: t.leadId ? `/leads/${t.leadId}` : "/tasks",
      done: !!t.doneAt,
    });
  }
  for (const d of debts) {
    const left = Math.round((toNum(d.amount) - toNum(d.paidAmount)) * 100) / 100;
    items.push({ day: toInputDate(d.dueAt!), time: null, kind: "debt", title: d.lead.name, sub: `${left} ${d.currency}`, link: "/debtors", done: false });
  }
  for (const l of trips) {
    if (l.travelFrom && l.travelFrom >= range.from && l.travelFrom < range.to) items.push({ day: toInputDate(l.travelFrom), time: null, kind: "depart", title: l.name, sub: l.destination, link: `/leads/${l.id}`, done: false });
    if (l.travelTo && l.travelTo >= range.from && l.travelTo < range.to) items.push({ day: toInputDate(l.travelTo), time: null, kind: "return", title: l.name, sub: l.destination, link: `/leads/${l.id}`, done: false });
  }
  return items.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? ""));
}

/** Недели месяца (пн–вс) с датами YYYY-MM-DD; дни соседних месяцев — для заполнения сетки */
export function monthGrid(ym: string): string[][] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const shift = (first.getUTCDay() + 6) % 7; // понедельник = 0
  const start = new Date(first.getTime() - shift * 86_400_000);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + (w * 7 + i) * 86_400_000).toISOString().slice(0, 10));
    if (w > 3 && !week.some((d) => d.startsWith(ym))) break;
    weeks.push(week);
  }
  return weeks;
}

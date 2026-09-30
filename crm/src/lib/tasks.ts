import { prisma } from "./db";
import { parseInputDate, toInputDate } from "./format";
import type { CurrentUser } from "./session";
import type { TaskItem } from "@/components/tasks/task-list";

export function tashkentDayBounds(now = new Date()) {
  const start = parseInputDate(toInputDate(now))!;
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

const include = { assignee: { select: { name: true } }, lead: { select: { id: true, name: true } } } as const;

type TaskWithRel = Awaited<ReturnType<typeof prisma.task.findMany<{ include: typeof include }>>>[number];

export function toTaskItem(t: TaskWithRel): TaskItem {
  return { id: t.id, title: t.title, dueAt: t.dueAt.toISOString(), doneAt: t.doneAt?.toISOString() ?? null, assignee: t.assignee.name, lead: t.lead, isCallback: t.isCallback };
}

/** Просроченные и сегодняшние задачи пользователя (админ может смотреть всех) */
export async function getUrgentTasks(user: CurrentUser, assigneeId?: string) {
  const { end } = tashkentDayBounds();
  const who = user.role === "ADMIN" ? (assigneeId ? { assigneeId } : {}) : { assigneeId: user.id };
  const tasks = await prisma.task.findMany({ where: { ...who, doneAt: null, dueAt: { lt: end } }, include, orderBy: { dueAt: "asc" } });
  const now = Date.now();
  return {
    overdue: tasks.filter((t) => t.dueAt.getTime() < now).map(toTaskItem),
    today: tasks.filter((t) => t.dueAt.getTime() >= now).map(toTaskItem),
  };
}

export async function getTasks(user: CurrentUser, opts: { assigneeId?: string; scope: "open" | "done" }) {
  const who = user.role === "ADMIN" ? (opts.assigneeId ? { assigneeId: opts.assigneeId } : {}) : { assigneeId: user.id };
  const tasks = await prisma.task.findMany({
    where: { ...who, doneAt: opts.scope === "open" ? null : { not: null } },
    include,
    orderBy: opts.scope === "open" ? { dueAt: "asc" } : { doneAt: "desc" },
    take: 300,
  });
  return tasks.map(toTaskItem);
}

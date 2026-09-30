import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewTaskForm, TaskRow, type TaskItem } from "@/components/tasks/task-list";
import { getManagers } from "@/lib/refs";
import { getTasks, tashkentDayBounds } from "@/lib/tasks";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

function Group({ title, tasks, tone }: { title: string; tasks: TaskItem[]; tone?: string }) {
  if (!tasks.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className={tone}>
          {title} · {tasks.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((t) => (
          <TaskRow key={t.id} t={t} showLead />
        ))}
      </CardContent>
    </Card>
  );
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const scope = sp(params, "scope") === "done" ? "done" : "open";
  const assigneeId = isAdmin ? sp(params, "user") : undefined;
  const [tasks, users] = await Promise.all([getTasks(user, { assigneeId, scope }), getManagers()]);
  const { end } = tashkentDayBounds();
  const now = Date.now();
  const due = (t: TaskItem) => new Date(t.dueAt).getTime();

  const tab = (key: string, label: string) => (
    <Link
      href={`/tasks?scope=${key}${assigneeId ? `&user=${assigneeId}` : ""}`}
      className={cn("rounded-md px-3 py-1.5 text-sm", scope === key ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}
    >
      {label}
    </Link>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title="Задачи" description="Напоминания «перезвонить», встречи и другие дела" />
      <div className="mb-4 flex items-center gap-3">
        <div className="flex rounded-lg bg-slate-200/60 p-1">
          {tab("open", "Активные")}
          {tab("done", "Выполненные")}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-1 text-sm">
            <Link href={`/tasks?scope=${scope}`} className={cn("rounded-md px-2 py-1", !assigneeId ? "bg-primary text-white" : "hover:bg-accent")}>
              Все
            </Link>
            {users.map((u) => (
              <Link key={u.id} href={`/tasks?scope=${scope}&user=${u.id}`} className={cn("rounded-md px-2 py-1", assigneeId === u.id ? "bg-primary text-white" : "hover:bg-accent")}>
                {u.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <Card className="mb-5">
        <CardContent className="pt-4">
          <NewTaskForm assignees={isAdmin ? users.map((u) => ({ id: u.id, name: u.name })) : undefined} />
        </CardContent>
      </Card>
      <div className="space-y-5">
        {scope === "open" ? (
          <>
            <Group title="Просрочено" tone="text-red-700" tasks={tasks.filter((t) => due(t) < now)} />
            <Group title="Сегодня" tasks={tasks.filter((t) => due(t) >= now && due(t) < end.getTime())} />
            <Group title="Позже" tasks={tasks.filter((t) => due(t) >= end.getTime())} />
            {tasks.length === 0 && <p className="text-sm text-muted-foreground">Активных задач нет 🎉</p>}
          </>
        ) : (
          <Group title="Выполненные" tasks={tasks} />
        )}
      </div>
    </div>
  );
}

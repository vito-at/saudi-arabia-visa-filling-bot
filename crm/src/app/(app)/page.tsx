import Link from "next/link";
import { Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskRow } from "@/components/tasks/task-list";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/access";
import { formatDateTime, formatDuration } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { getSettings } from "@/lib/refs";
import { getUrgentTasks } from "@/lib/tasks";
import { requireUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireUser();
  const [tasks, settings, newLeads] = await Promise.all([
    getUrgentTasks(user),
    getSettings(),
    prisma.lead.findMany({
      where: { ...leadScope(user), status: { kind: "NEW" } },
      orderBy: { createdAt: "asc" },
      take: 10,
      include: { manager: { select: { name: true } } },
    }),
  ]);
  const now = Date.now();

  return (
    <div className="space-y-5">
      <PageHeader title="Дашборд" description={`Здравствуйте, ${user.name}!`} />
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Задачи на сегодня</CardTitle>
            <Link href="/tasks" className="text-xs text-primary hover:underline">
              Все задачи
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.overdue.length > 0 && <div className="text-xs font-medium uppercase text-red-600">Просрочено · {tasks.overdue.length}</div>}
            {tasks.overdue.map((t) => (
              <TaskRow key={t.id} t={t} showLead />
            ))}
            {tasks.today.length > 0 && <div className="pt-2 text-xs font-medium uppercase text-muted-foreground">Сегодня · {tasks.today.length}</div>}
            {tasks.today.map((t) => (
              <TaskRow key={t.id} t={t} showLead />
            ))}
            {tasks.overdue.length + tasks.today.length === 0 && <p className="text-sm text-muted-foreground">На сегодня задач нет</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Необработанные лиды</CardTitle>
            <Link href="/leads?sort=createdAt&dir=asc" className="text-xs text-primary hover:underline">
              Все лиды
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {newLeads.map((l) => {
              const waiting = (now - l.createdAt.getTime()) / 60000;
              const hot = waiting > settings.unprocessedAlertMin;
              return (
                <Link
                  key={l.id}
                  href={`/leads/${l.id}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 ${hot ? "border-red-200 bg-red-50" : ""}`}
                >
                  <div className="flex-1">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {prettyPhone(l.phone)} · {formatDateTime(l.createdAt)} · {l.manager?.name ?? "не назначен"}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs ${hot ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                    {hot && <Flame className="size-3" />} {formatDuration(waiting)}
                  </span>
                </Link>
              );
            })}
            {newLeads.length === 0 && <p className="text-sm text-muted-foreground">Все лиды разобраны 👍</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

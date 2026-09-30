import Link from "next/link";
import { Suspense } from "react";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { CountBars, MoneyBars } from "@/components/reports/charts";
import { ReportFilters } from "@/components/reports/report-filters";
import { formatDate, formatMoneyRound as formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getManagers } from "@/lib/refs";
import { readFilters } from "@/lib/reports/data";
import { dashboardData } from "@/lib/reports/tables";
import type { SearchParams } from "@/lib/leads/query";
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

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const f = await readFilters({ period: "month", ...params }, user);
  const cur = f.currency;
  const [d, managers, tasks, settings, newLeads] = await Promise.all([
    dashboardData(f),
    user.role === "ADMIN" ? getManagers() : Promise.resolve(null),
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
      <PageHeader
        title="Дашборд"
        description={`${formatDate(f.period.from)} — ${formatDate(new Date(f.period.to.getTime() - 1))} · сравнение с ${formatDate(d.prev.from)} — ${formatDate(new Date(d.prev.to.getTime() - 1))}${user.role !== "ADMIN" ? " · ваши показатели" : ""}`}
      />
      <Suspense>
        <ReportFilters managers={managers?.map((m) => ({ id: m.id, name: m.name })) ?? null} exportHref="/api/reports/export?tab=dashboard" defaultPeriod="month" />
      </Suspense>
      <div className="grid grid-cols-6 gap-4">
        <KpiTile label="Лидов" value={formatNumber(d.cur.leads)} delta={d.deltas.leads} prev={formatNumber(d.was.leads)} />
        <KpiTile label="Продаж" value={formatNumber(d.cur.sales)} delta={d.deltas.sales} prev={formatNumber(d.was.sales)} />
        <KpiTile label="Конверсия в продажу" value={formatPercent(d.cur.conversion)} delta={d.deltas.conversion} prev={formatPercent(d.was.conversion)} />
        <KpiTile label="Выручка" value={formatMoney(d.cur.revenue, cur)} delta={d.deltas.revenue} prev={formatMoney(d.was.revenue, cur)} />
        <KpiTile label="Прибыль" value={formatMoney(d.cur.profit, cur)} delta={d.deltas.profit} prev={formatMoney(d.was.profit, cur)} />
        <KpiTile label="Средний чек" value={formatMoney(d.cur.avgCheck, cur)} delta={d.deltas.avgCheck} prev={formatMoney(d.was.avgCheck, cur)} />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Лиды {d.bucket === 7 ? "по неделям" : "по дням"}</CardTitle>
          </CardHeader>
          <CardContent>
            <CountBars label="Лидов" data={d.leadSeries.points.map((p) => ({ x: formatDate(p.start).slice(0, 5), value: p.value }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Выручка и прибыль {d.bucket === 7 ? "по неделям" : "по дням"}</CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyBars currency={cur} data={d.money.map((p) => ({ x: formatDate(p.start).slice(0, 5), revenue: p.revenue, profit: p.profit }))} />
          </CardContent>
        </Card>
      </div>
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

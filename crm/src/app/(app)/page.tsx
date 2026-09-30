import Link from "next/link";
import { Suspense } from "react";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { CountBars, MoneyBars } from "@/components/reports/charts";
import { ReportFilters } from "@/components/reports/report-filters";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getI18n } from "@/i18n/server";
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
import { formatDateTime } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { getSettings } from "@/lib/refs";
import { getUrgentTasks } from "@/lib/tasks";
import { requireUser } from "@/lib/session";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { t, f: fm } = await getI18n();
  const formatMoney = fm.moneyRound;
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
        title={t("dashboard.title")}
        description={`${t("dashboard.compare", { from: formatDate(f.period.from), to: formatDate(new Date(f.period.to.getTime() - 1)), pfrom: formatDate(d.prev.from), pto: formatDate(new Date(d.prev.to.getTime() - 1)) })}${user.role !== "ADMIN" ? ` · ${t("dashboard.own")}` : ""}`}
      />
      <Suspense>
        <ReportFilters managers={managers?.map((m) => ({ id: m.id, name: m.name })) ?? null} exportHref="/api/reports/export?tab=dashboard" defaultPeriod="month" />
      </Suspense>
      <div className="grid grid-cols-6 gap-4">
        <KpiTile label={t("dashboard.leads")} value={formatNumber(d.cur.leads)} delta={d.deltas.leads} prev={formatNumber(d.was.leads)} />
        <KpiTile label={t("dashboard.sales")} value={formatNumber(d.cur.sales)} delta={d.deltas.sales} prev={formatNumber(d.was.sales)} />
        <KpiTile label={t("dashboard.conversion")} value={formatPercent(d.cur.conversion)} delta={d.deltas.conversion} prev={formatPercent(d.was.conversion)} />
        <KpiTile label={t("dashboard.revenue")} value={formatMoney(d.cur.revenue, cur)} delta={d.deltas.revenue} prev={formatMoney(d.was.revenue, cur)} />
        <KpiTile label={t("dashboard.profit")} value={formatMoney(d.cur.profit, cur)} delta={d.deltas.profit} prev={formatMoney(d.was.profit, cur)} />
        <KpiTile label={t("dashboard.avgCheck")} value={formatMoney(d.cur.avgCheck, cur)} delta={d.deltas.avgCheck} prev={formatMoney(d.was.avgCheck, cur)} />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>{t(d.bucket === 7 ? "dashboard.leadsByWeek" : "dashboard.leadsByDay")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CountBars label={t("dashboard.leads")} data={d.leadSeries.points.map((p) => ({ x: formatDate(p.start).slice(0, 5), value: p.value }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t(d.bucket === 7 ? "dashboard.moneyByWeek" : "dashboard.moneyByDay")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyBars currency={cur} data={d.money.map((p) => ({ x: formatDate(p.start).slice(0, 5), revenue: p.revenue, profit: p.profit }))} />
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.tasksToday")}</CardTitle>
            <Link href="/tasks" className="text-xs text-primary hover:underline">
              {t("dashboard.allTasks")}
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.overdue.length > 0 && <div className="text-xs font-medium uppercase text-red-600">{t("dashboard.overdueCount", { n: tasks.overdue.length })}</div>}
            {tasks.overdue.map((t) => (
              <TaskRow key={t.id} t={t} showLead />
            ))}
            {tasks.today.length > 0 && <div className="pt-2 text-xs font-medium uppercase text-muted-foreground">{t("dashboard.todayCount", { n: tasks.today.length })}</div>}
            {tasks.today.map((t) => (
              <TaskRow key={t.id} t={t} showLead />
            ))}
            {tasks.overdue.length + tasks.today.length === 0 && <p className="text-sm text-muted-foreground">{t("dashboard.noTasks")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.unprocessed")}</CardTitle>
            <Link href="/leads?sort=createdAt&dir=asc" className="text-xs text-primary hover:underline">
              {t("dashboard.allLeads")}
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
                      {prettyPhone(l.phone)} · {formatDateTime(l.createdAt)} · {l.manager?.name ?? t("common.notAssigned")}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs ${hot ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                    {hot && <Flame className="size-3" />} {fm.duration(waiting)}
                  </span>
                </Link>
              );
            })}
            {newLeads.length === 0 && <p className="text-sm text-muted-foreground">{t("dashboard.allProcessed")}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

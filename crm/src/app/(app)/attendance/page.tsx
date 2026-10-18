import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceGrid, STATE_STYLE, SettingsButton, TelegramCard, type GridRow } from "@/components/attendance/attendance-ui";
import { prisma } from "@/lib/db";
import { dayState, monthDays, summarize, type DayMark, type DayState } from "@/lib/attendance";
import { formatTime, toInputDate } from "@/lib/format";
import { toNum } from "@/lib/money";
import { getSettings } from "@/lib/refs";
import { monthKey, monthRange, shiftMonth } from "@/lib/salary";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { minToTime, scheduleOf } from "@/lib/work-hours";
import { cn } from "@/lib/utils";
import type { TKey } from "@/i18n/core";
import { getI18n } from "@/i18n/server";

const LEGEND: DayState[] = ["ok", "late", "noOut", "absent", "off"];

/** Посещаемость: отметки прихода/ухода из Telegram-бота, опоздания, штрафы, табель за месяц */
export default async function AttendancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { t, f, locale } = await getI18n();
  const isAdmin = user.role === "ADMIN";
  const range = monthRange(sp(params, "m"));
  const settings = await getSettings();
  const schedule = scheduleOf(settings);
  const today = toInputDate(new Date());
  const days = monthDays(range.ym);

  const [me, users, firsts] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { telegramName: true, telegramId: true } }),
    prisma.user.findMany({
      // администраторы — в табеле, только если отмечались в этом месяце
      where: isAdmin ? { isActive: true, OR: [{ role: "MANAGER" }, { attendance: { some: { day: { gte: monthKey(range.ym), lt: monthKey(shiftMonth(range.ym, 1)) } } } }] } : { id: user.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        telegramName: true,
        telegramId: true,
        attendance: { where: { day: { gte: monthKey(range.ym), lt: monthKey(shiftMonth(range.ym, 1)) } } },
      },
    }),
    // первая отметка каждого сотрудника — с неё считаются пропуски
    prisma.attendance.groupBy({ by: ["userId"], where: { checkInAt: { not: null } }, _min: { day: true } }),
  ]);

  const rows = users.map((u) => {
    const first = firsts.find((x) => x.userId === u.id)?._min.day;
    const since = first ? first.toISOString().slice(0, 10) : null;
    const marks: DayMark[] = u.attendance.map((a) => ({ day: a.day.toISOString().slice(0, 10), checkInAt: a.checkInAt, checkOutAt: a.checkOutAt, lateMin: a.lateMin, fine: toNum(a.fine) }));
    const byDay = new Map(u.attendance.map((a) => [a.day.toISOString().slice(0, 10), a]));
    const grid: GridRow = {
      userId: u.id,
      name: u.name,
      telegram: u.telegramId ? (u.telegramName ?? "Telegram") : null,
      days: days.map((d) => {
        const a = byDay.get(d);
        const m = marks.find((x) => x.day === d);
        return { day: d, state: dayState(d, m, schedule, today, since), in: a?.checkInAt ? formatTime(a.checkInAt) : null, out: a?.checkOutAt ? formatTime(a.checkOutAt) : null, lateMin: a?.lateMin ?? 0, fine: a ? toNum(a.fine) : 0, note: a?.note ?? null };
      }),
    };
    return { grid, sum: summarize(days, marks, schedule, today, since), todayMark: byDay.get(today) };
  });

  const href = (m: string) => `/attendance?m=${m}`;
  const intl = locale === "en" ? "en-GB" : locale === "uz" ? "uz-Latn" : "ru-RU";
  const monthName = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${range.ym}-15T00:00:00Z`));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("att.title")}
        description={t("att.subtitle", { start: minToTime(schedule.startMin), grace: settings.attendanceGraceMin })}
        actions={
          isAdmin ? (
            <SettingsButton
              initial={{
                enabled: settings.attendanceEnabled,
                graceMin: String(settings.attendanceGraceMin),
                lateFine: toNum(settings.lateFine) ? String(toNum(settings.lateFine)) : "",
                geo: settings.attendanceGeo,
                officeLat: settings.officeLat === null ? "" : String(settings.officeLat),
                officeLng: settings.officeLng === null ? "" : String(settings.officeLng),
                radiusM: String(settings.officeRadiusM),
              }}
            />
          ) : undefined
        }
      />
      {!settings.attendanceEnabled && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{isAdmin ? t("att.offAdmin") : t("att.off")}</div>}

      <TelegramCard userId={user.id} linkedAs={me.telegramId ? (me.telegramName ?? "Telegram") : null} />

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{t("att.today")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            {rows.map(({ grid, todayMark }) => (
              <span key={grid.userId} className={cn("rounded-md border px-2.5 py-1", !todayMark?.checkInAt && "text-muted-foreground")}>
                {grid.name}:{" "}
                {todayMark?.checkInAt ? (
                  <b className={todayMark.lateMin > 0 ? "text-amber-600" : "text-emerald-600"}>
                    {formatTime(todayMark.checkInAt)}
                    {todayMark.checkOutAt ? `–${formatTime(todayMark.checkOutAt)}` : ""}
                  </b>
                ) : (
                  t("att.notYet")
                )}
                {!grid.telegram && <span className="ml-1 text-xs text-muted-foreground">({t("att.noTelegram")})</span>}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href(shiftMonth(range.ym, -1))} className="inline-flex size-9 items-center justify-center rounded-md border bg-card hover:bg-accent" aria-label="←">
          <ChevronLeft className="size-4" />
        </Link>
        <span className="inline-block min-w-40 text-center font-semibold first-letter:uppercase">{monthName}</span>
        <Link href={href(shiftMonth(range.ym, 1))} className="inline-flex size-9 items-center justify-center rounded-md border bg-card hover:bg-accent" aria-label="→">
          <ChevronRight className="size-4" />
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">{t("rt.managers.manager")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("att.worked")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("att.late")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("att.absent")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("att.avgIn")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("att.hours")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("att.fines")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ grid, sum }) => (
                <tr key={grid.userId}>
                  <td className="px-4 py-2.5 font-medium">{grid.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{sum.worked}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", sum.late > 0 && "text-amber-600")}>
                    {sum.late}
                    {sum.lateMin > 0 && <span className="text-xs text-muted-foreground"> · {t("att.lateN", { n: sum.lateMin })}</span>}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", sum.absent > 0 && "text-red-600")}>{sum.absent}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{sum.avgIn === null ? "—" : minToTime(sum.avgIn)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{sum.hours}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{sum.fines ? f.money(sum.fines, "UZS") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("att.grid")}</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            {LEGEND.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={cn("inline-block size-3 rounded", STATE_STYLE[s], s === "off" && "border")} /> {t(`att.state.${s}` as TKey)}
              </span>
            ))}
          </div>
        </CardHeader>
        <AttendanceGrid rows={rows.map((r) => r.grid)} editable={isAdmin} />
        {isAdmin && <p className="px-4 pt-1 pb-4 text-xs text-muted-foreground">{t("att.gridHint")}</p>}
      </Card>
    </div>
  );
}

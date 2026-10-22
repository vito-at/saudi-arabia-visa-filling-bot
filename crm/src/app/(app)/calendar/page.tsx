import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { loadCalendar, monthGrid, type CalendarItem, type CalendarKind } from "@/lib/calendar";
import { toInputDate } from "@/lib/format";
import { getManagers } from "@/lib/refs";
import { monthRange, shiftMonth } from "@/lib/salary";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { TKey } from "@/i18n/core";
import { getI18n } from "@/i18n/server";

const KIND_STYLE: Record<CalendarKind, string> = {
  callback: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  task: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  depart: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  return: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};
const KINDS: CalendarKind[] = ["callback", "task", "depart", "return"];

/** Календарь: звонки и задачи, вылеты и возвращения клиентов */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const isAdmin = user.role === "ADMIN";
  const range = monthRange(sp(params, "m"));
  const userId = isAdmin ? sp(params, "u") || null : user.id;
  const [items, managers] = await Promise.all([loadCalendar(range, user, userId), isAdmin ? getManagers() : Promise.resolve([])]);
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);
  const weeks = monthGrid(range.ym);
  const today = toInputDate(new Date());
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ m: range.ym, u: userId, ...patch })) if (v) p.set(k, v);
    return `/calendar?${p.toString()}`;
  };
  const intl = locale === "en" ? "en-GB" : locale === "uz" ? "uz-Latn" : "ru-RU";
  const monthName = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${range.ym}-15T00:00:00Z`));
  const dayName = (d: string) => new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const weekdays = [1, 2, 3, 4, 5, 6, 7].map((d) => t(`general.day${d}` as TKey));

  const Item = ({ it, compact }: { it: CalendarItem; compact?: boolean }) => (
    <Link href={it.link} className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] hover:brightness-95", KIND_STYLE[it.kind], it.done && "line-through opacity-60", !compact && "py-1.5 text-sm")} title={[it.time, t(`calendar.kind.${it.kind}` as TKey), it.title, it.sub].filter(Boolean).join(" · ")}>
      {it.time && <span className="mr-1 tabular-nums opacity-70">{it.time}</span>}
      {it.title}
      {!compact && it.sub && <span className="opacity-70"> · {it.sub}</span>}
    </Link>
  );

  return (
    <div>
      <PageHeader
        title={t("calendar.title")}
        description={t("calendar.subtitle")}
        actions={
          <Link href="/tasks" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" /> {t("calendar.newTask")}
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={href({ m: shiftMonth(range.ym, -1) })} className="inline-flex size-9 items-center justify-center rounded-md border bg-card hover:bg-accent" aria-label="←">
          <ChevronLeft className="size-4" />
        </Link>
        <span className="inline-block min-w-40 text-center font-semibold first-letter:uppercase">{monthName}</span>
        <Link href={href({ m: shiftMonth(range.ym, 1) })} className="inline-flex size-9 items-center justify-center rounded-md border bg-card hover:bg-accent" aria-label="→">
          <ChevronRight className="size-4" />
        </Link>
        <Link href={href({ m: today.slice(0, 7) })} className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent">
          {t("calendar.today")}
        </Link>
        {isAdmin && (
          <div className="flex flex-wrap gap-1 text-sm">
            {[{ id: null as string | null, name: t("common.allManagers") }, ...managers].map((m) => (
              <Link key={m.id ?? "all"} href={href({ u: m.id })} className={cn("rounded-md px-2.5 py-1", userId === m.id ? "bg-primary text-white" : "border bg-card hover:bg-accent")}>
                {m.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {KINDS.map((k) => (
          <span key={k} className={cn("rounded px-2 py-0.5", KIND_STYLE[k])}>
            {t(`calendar.kind.${k}` as TKey)}
          </span>
        ))}
      </div>

      {/* компьютер: сетка месяца */}
      <Card className="hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs text-muted-foreground">
          {weekdays.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((w) => (
          <div key={w[0]} className="grid grid-cols-7 border-b last:border-b-0">
            {w.map((d) => {
              const list = byDay.get(d) ?? [];
              const other = !d.startsWith(range.ym);
              return (
                <div key={d} className={cn("min-h-28 border-r p-1.5 last:border-r-0", other && "bg-muted/30", d === today && "bg-primary/5 ring-1 ring-inset ring-primary")}>
                  <div className={cn("mb-1 text-xs", other ? "text-muted-foreground/60" : "font-medium", d === today && "text-primary")}>{Number(d.slice(8))}</div>
                  <div className="space-y-0.5">
                    {list.slice(0, 4).map((it, i) => (
                      <Item key={i} it={it} compact />
                    ))}
                    {list.length > 4 && <div className="px-1 text-[11px] text-muted-foreground">{t("calendar.more", { n: list.length - 4 })}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      {/* телефон: список по дням */}
      <div className="space-y-3 md:hidden">
        {[...byDay].filter(([d]) => d.startsWith(range.ym)).map(([d, list]) => (
          <Card key={d} className={cn("p-3", d === today && "border-primary")}>
            <div className={cn("mb-2 text-sm font-semibold first-letter:uppercase", d === today && "text-primary")}>{dayName(d)}</div>
            <div className="space-y-1">
              {list.map((it, i) => (
                <Item key={i} it={it} />
              ))}
            </div>
          </Card>
        ))}
        {!items.length && <Card className="p-6 text-center text-sm text-muted-foreground">{t("calendar.empty")}</Card>}
      </div>
    </div>
  );
}

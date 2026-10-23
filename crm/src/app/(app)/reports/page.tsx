import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelBars, HBars, LossPie } from "@/components/reports/charts";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportTable } from "@/components/reports/report-table";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getManagers, getSettings } from "@/lib/refs";
import { readFilters } from "@/lib/reports/data";
import { AD_LEVELS, adsTable, clientsTable, funnelTable, lossesTables, managersTable, tasksTable, REPORT_TABS, servicesTables, type ReportTab } from "@/lib/reports/tables";
import type { AdLevel } from "@/lib/reports/calc";
import { visasTable } from "@/lib/reports/visas";
import { productsByManagerTable } from "@/lib/reports/products";
import { buildInsights } from "@/lib/reports/insights";
import { loadCurrencyIssues, loadManagerMonths, monthRange, shiftMonth } from "@/lib/salary";
import { PlansTable } from "@/components/reports/plans-table";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Lightbulb } from "lucide-react";
import { ProductSalesTable } from "@/components/reports/product-sales-table";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { formatters } from "@/i18n/core";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const tabParam = sp(params, "tab") as ReportTab | undefined;
  const tab: ReportTab = tabParam && tabParam in REPORT_TABS && tabParam !== "dashboard" ? tabParam : "funnel";
  const f = await readFilters(params, user);
  const { t } = f;
  const sum = formatters(f.locale).sum;
  const managers = isAdmin ? (await getManagers()).map((m) => ({ id: m.id, name: m.name })) : null;
  const level = (sp(params, "level") as AdLevel) in AD_LEVELS ? (sp(params, "level") as AdLevel) : "campaign";

  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "tab" && k !== "level") keep.set(k, v);
  const tabHref = (t: string) => `/reports?tab=${t}${keep.size ? `&${keep.toString()}` : ""}`;

  return (
    <div>
      <PageHeader
        title={t("reports.title")}
        description={
          <>
            {t("reports.subtitle", { from: formatDate(f.period.from), to: formatDate(new Date(f.period.to.getTime() - 1)), cur: f.currency, rate: formatNumber(f.rate, 2), costRate: formatNumber(f.costRate, 2), sum })}
            {!isAdmin && ` · ${t("reports.ownOnly")}`}
          </>
        }
      />
      <div className="no-scrollbar -mx-3 mb-4 flex gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain whitespace-nowrap px-3 shadow-[inset_0_-1px_0_var(--border)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {(Object.keys(REPORT_TABS) as ReportTab[]).filter((tb) => tb !== "dashboard").map((tb) => (
          <Link key={tb} href={tabHref(tb)} className={cn("shrink-0 border-b-2 px-3 py-2 text-sm", tab === tb ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t(REPORT_TABS[tb])}
          </Link>
        ))}
      </div>
      {/* у «Планов и зарплаты» свой выбор месяца вместо периода */}
      {tab !== "plans" && (
        <div className="mb-5">
          <Suspense>
            <ReportFilters managers={managers} exportHref={`/api/reports/export?tab=${tab}${tab === "ads" ? `&level=${level}` : ""}`} />
          </Suspense>
        </div>
      )}

      {tab === "clients" && <ClientsReport f={f} />}
      {tab === "funnel" && <FunnelReport f={f} />}
      {tab === "losses" && <LossesReport f={f} isAdmin={isAdmin} />}
      {tab === "ads" && <AdsReport f={f} level={level} tabHref={tabHref("ads")} />}
      {tab === "managers" && <ManagersReport f={f} isAdmin={isAdmin} />}
      {tab === "services" && <ServicesReport f={f} />}
      {tab === "visas" && <VisasReport f={f} />}
      {tab === "tasks" && <TasksReport f={f} />}
      {tab === "plans" && <PlansReport f={f} ym={sp(params, "m")} isAdmin={isAdmin} keep={keep} />}
    </div>
  );
}

type F = Awaited<ReturnType<typeof readFilters>>;

async function ClientsReport({ f }: { f: F }) {
  const table = await clientsTable(f);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{table.title}</CardTitle>
        <span className="text-xs text-muted-foreground">{table.note} {f.t("reports.clientsHint")}</span>
      </CardHeader>
      <ReportTable table={table} currency={f.currency} linkPrefix="/clients/" />
    </Card>
  );
}

async function FunnelReport({ f }: { f: F }) {
  const [{ table, side, funnel, times }, insights] = await Promise.all([funnelTable(f), buildInsights(f)]);
  const fm = formatters(f.locale);
  const now = funnel.current.filter((c) => c.count > 0);
  return (
    <div className="space-y-5">
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-500" /> {f.t("insight.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {insights.map((x, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border-l-4 bg-muted/40 px-3 py-2 text-sm",
                  x.tone === "good" ? "border-emerald-500" : x.tone === "bad" ? "border-red-500" : "border-sky-500",
                )}
              >
                {x.text}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {funnel.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{f.t("reports.nowTitle", { n: formatNumber(funnel.total) })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* одна полоса: доли статусов в сумме 100% */}
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {now.map((c) => (
                <div key={c.statusId} title={`${c.name}: ${formatNumber(c.count)} (${formatPercent(c.ofTotal)})`} style={{ width: `${(c.ofTotal ?? 0) * 100}%`, background: c.color }} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {funnel.current.map((c) => (
                <div key={c.statusId} className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="font-medium tabular-nums">{formatNumber(c.count)}</span>
                  <span className="w-14 text-right tabular-nums text-muted-foreground">{formatPercent(c.ofTotal)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{f.t("reports.nowNote")}</p>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{f.t("reports.funnelTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {funnel.total ? <FunnelBars data={funnel.steps.map((s) => ({ name: s.name, count: s.count, ofTotal: s.ofTotal }))} /> : <p className="text-sm text-muted-foreground">{f.t("reports.noLeads")}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{f.t("reports.table")}</CardTitle>
        </CardHeader>
        <ReportTable table={table} currency={f.currency} />
        <p className="px-5 pt-3 text-xs text-muted-foreground">{table.note}</p>
        {times.toSaleMin !== null && <p className="px-5 pt-1 text-sm font-medium">{f.t("rt.funnel.toSale", { time: fm.duration(times.toSaleMin), n: times.sold })}</p>}
        <p className="px-5 py-3 text-xs text-muted-foreground">{f.t("rt.funnel.avgTimeNote")}</p>
        {side && (
          <div className="border-t">
            <div className="px-5 pb-1 pt-4 text-sm font-semibold">{side.title}</div>
            <ReportTable table={side} currency={f.currency} />
            <p className="px-5 py-3 text-xs text-muted-foreground">{side.note}</p>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}

async function LossesReport({ f, isAdmin }: { f: F; isAdmin: boolean }) {
  const t = await lossesTables(f);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{f.t("reports.lossesTitle", { n: t.total })}</CardTitle>
          </CardHeader>
          <CardContent>{t.total ? <LossPie data={t.rows} /> : <p className="text-sm text-muted-foreground">{f.t("reports.noLosses")}</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{f.t("reports.table")}</CardTitle>
          </CardHeader>
          <ReportTable table={t.main} currency={f.currency} />
        </Card>
      </div>
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{t.byManager.title}</CardTitle>
          </CardHeader>
          <ReportTable table={t.byManager} currency={f.currency} compact />
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t.byCampaign.title}</CardTitle>
        </CardHeader>
        <ReportTable table={t.byCampaign} currency={f.currency} compact />
      </Card>
    </div>
  );
}

async function AdsReport({ f, level, tabHref }: { f: F; level: AdLevel; tabHref: string }) {
  const table = await adsTable(f, level);
  return (
    <Card>
      <CardHeader>
        <div className="no-scrollbar flex max-w-full overflow-x-auto whitespace-nowrap rounded-lg bg-slate-200/60 p-1 text-sm">
          {(Object.keys(AD_LEVELS) as AdLevel[]).map((l) => (
            <Link key={l} href={`${tabHref}&level=${l}`} className={cn("rounded-md px-3 py-1", level === l ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}>
              {f.t(AD_LEVELS[l])}
            </Link>
          ))}
        </div>
      </CardHeader>
      <ReportTable table={table} currency={f.currency} />
      <p className="px-5 py-3 text-xs text-muted-foreground">{table.note}</p>
    </Card>
  );
}

async function ManagersReport({ f, isAdmin }: { f: F; isAdmin: boolean }) {
  const [{ table, rows }, products] = await Promise.all([managersTable(f), productsByManagerTable(f)]);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{f.t("reports.managersTitle")}</CardTitle>
        </CardHeader>
        <ReportTable table={table} currency={f.currency} />
        <p className="px-5 py-3 text-xs text-muted-foreground">{table.note}</p>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{products.title}</CardTitle>
        </CardHeader>
        <ProductSalesTable table={products} currency={f.currency} editable={isAdmin} period={{ from: f.period.from.toISOString(), to: f.period.to.toISOString() }} />
        <p className="px-5 py-3 text-xs text-muted-foreground">{products.note}</p>
      </Card>
      {rows.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{f.t("reports.profitByManager")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HBars data={rows.map((r) => ({ name: r.name, value: r.profit }))} currency={f.currency} label={f.t("reports.profit")} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function VisasReport({ f }: { f: F }) {
  const { table, totals, noCount } = await visasTable(f);
  const tiles = [
    { label: f.t("rt.visas.tileApplications"), value: totals.applications },
    { label: f.t("rt.visas.tileSales"), value: totals.sales },
    { label: f.t("rt.visas.tileCountries"), value: totals.countries },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        {tiles.map((tl) => (
          <Card key={tl.label} className="p-4">
            <div className="text-xs font-medium text-muted-foreground">{tl.label}</div>
            <div className="mt-1.5 text-xl font-semibold tabular-nums">{formatNumber(tl.value)}</div>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{table.title}</CardTitle>
          <span className="text-xs text-muted-foreground">{table.note}</span>
        </CardHeader>
        {table.rows.length ? <ReportTable table={table} currency={f.currency} /> : <p className="px-5 pb-5 text-sm text-muted-foreground">{f.t("rt.visas.empty")}</p>}
        {noCount > 0 && <p className="px-5 py-3 text-xs text-amber-700">{f.t("rt.visas.noCount", { n: noCount })}</p>}
      </Card>
    </div>
  );
}

async function ServicesReport({ f }: { f: F }) {
  const t = await servicesTables(f);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t.services.title}</CardTitle>
          </CardHeader>
          <ReportTable table={t.services} currency={f.currency} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{f.t("reports.profitByService")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HBars data={t.servicesRows.filter((r) => r.profit !== 0).map((r) => ({ name: r.name, value: r.profit }))} currency={f.currency} label={f.t("reports.profit")} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.destinations.title}</CardTitle>
        </CardHeader>
        <ReportTable table={t.destinations} currency={f.currency} />
      </Card>
    </div>
  );
}

async function TasksReport({ f }: { f: F }) {
  const table = await tasksTable(f);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{table.title}</CardTitle>
        <Link href="/tasks" className="text-xs text-primary hover:underline">
          {f.t("rt.tasks.open")} →
        </Link>
      </CardHeader>
      <ReportTable table={table} currency={f.currency} />
      <p className="px-5 py-3 text-xs text-muted-foreground">{table.note}</p>
    </Card>
  );
}

async function PlansReport({ f, ym, isAdmin, keep }: { f: F; ym: string | undefined; isAdmin: boolean; keep: URLSearchParams }) {
  const range = monthRange(ym);
  const managerId = isAdmin ? null : f.managerId;
  const months = [range.ym, ...[1, 2, 3, 4, 5].map((i) => shiftMonth(range.ym, -i))];
  const [issues, rows, ...history] = await Promise.all([
    // сделки с перепутанной валютой завышают продажи и зарплату — администратору список, чтобы исправить
    isAdmin ? loadCurrencyIssues() : Promise.resolve([]),
    loadManagerMonths(range, managerId),
    ...months.slice(1).map((m) => loadManagerMonths(monthRange(m), managerId)),
  ]);
  const monthName = (m: string) => new Intl.DateTimeFormat(f.locale === "en" ? "en-GB" : f.locale === "uz" ? "uz-Latn" : "ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-15T00:00:00Z`));
  const link = (m: string) => {
    const p = new URLSearchParams(keep);
    p.set("tab", "plans");
    p.set("m", m);
    return `/reports?${p.toString()}`;
  };
  const fm = formatters(f.locale);
  const allMonths = [rows, ...history];
  const salaryStart = (await getSettings()).salaryStartAt;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={link(shiftMonth(range.ym, -1))} className="inline-flex size-9 items-center justify-center rounded-md border bg-card hover:bg-accent" aria-label="←">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="inline-block min-w-40 text-center font-semibold first-letter:uppercase">{monthName(range.ym)}</span>
          <Link href={link(shiftMonth(range.ym, 1))} className="inline-flex size-9 items-center justify-center rounded-md border bg-card hover:bg-accent" aria-label="→">
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <a href={`/api/reports/export?tab=plans&m=${range.ym}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-sm hover:bg-accent">
          <Download className="size-4" /> Excel
        </a>
      </div>
      {issues.length > 0 && (
        <Card className="border-red-300 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400">{f.t("plans.currencyTitle", { n: issues.length })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{f.t("plans.currencyHint")}</p>
            <ul className="divide-y">
              {issues.map((d) => (
                <li key={d.dealId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                  <Link href={`/leads/${d.leadId}`} className="font-medium text-primary hover:underline">
                    {d.leadName}
                  </Link>
                  <span className="text-muted-foreground">{d.product}</span>
                  <span className="font-medium tabular-nums">{fm.money(d.amount, d.currency)}</span>
                  {d.cost > 0 && (
                    <span className="text-muted-foreground tabular-nums">
                      {f.t("plans.currencyCost")} {fm.money(d.cost, d.costCurrency)}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {formatDate(d.paidAt)}
                    {d.manager ? ` · ${d.manager}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{f.t("plans.title")}</CardTitle>
        </CardHeader>
        <PlansTable rows={rows} month={range.ym} editable={isAdmin} />
        <p className="px-5 py-3 text-xs text-muted-foreground">{f.t("plans.note")}</p>
        {salaryStart && <p className="px-5 pb-3 text-xs text-muted-foreground">{f.t("plans.countedFrom", { date: formatDate(salaryStart) })}</p>}
      </Card>
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{f.t("plans.history")}</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{f.t("plans.month")}</th>
                  {rows.map((r) => (
                    <th key={r.userId} className="px-3 py-2 text-right font-medium">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {months.map((m, i) => (
                  <tr key={m}>
                    <td className="px-4 py-2.5 first-letter:uppercase">
                      <Link href={link(m)} className="hover:underline">
                        {monthName(m)}
                      </Link>
                    </td>
                    {rows.map((r) => {
                      const x = allMonths[i].find((y) => y.userId === r.userId);
                      return (
                        <td key={r.userId} className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                          {x ? (
                            <>
                              <div className="font-medium">{x.tracked ? fm.money(x.total, x.currency) : f.t("plans.notTracked")}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {fm.money(x.fact.revenueUsd, "USD")} · {x.fact.sales}
                              </div>
                              {(x.tracked || x.paid > 0) && (
                                <div className={cn("text-[11px]", x.left > 0 ? "text-amber-600" : "text-emerald-600")}>
                                  {f.t("plans.paid")} {fm.money(x.paid, x.currency)} · {f.t("plans.left")} {fm.money(x.left, x.currency)}
                                </div>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

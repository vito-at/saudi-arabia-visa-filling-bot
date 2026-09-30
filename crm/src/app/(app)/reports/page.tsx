import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelBars, HBars, LossPie } from "@/components/reports/charts";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportTable } from "@/components/reports/report-table";
import { formatDate, formatNumber } from "@/lib/format";
import { getManagers } from "@/lib/refs";
import { readFilters } from "@/lib/reports/data";
import { AD_LEVELS, adsTable, clientsTable, funnelTable, lossesTables, managersTable, REPORT_TABS, servicesTables, type ReportTab } from "@/lib/reports/tables";
import type { AdLevel } from "@/lib/reports/calc";
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
            {t("reports.subtitle", { from: formatDate(f.period.from), to: formatDate(new Date(f.period.to.getTime() - 1)), cur: f.currency, rate: formatNumber(f.rate, 2), sum })}
            {!isAdmin && ` · ${t("reports.ownOnly")}`}
          </>
        }
      />
      <div className="mb-4 flex gap-1 border-b">
        {(Object.keys(REPORT_TABS) as ReportTab[]).filter((tb) => tb !== "dashboard").map((tb) => (
          <Link key={tb} href={tabHref(tb)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === tb ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t(REPORT_TABS[tb])}
          </Link>
        ))}
      </div>
      <div className="mb-5">
        <Suspense>
          <ReportFilters managers={managers} exportHref={`/api/reports/export?tab=${tab}${tab === "ads" ? `&level=${level}` : ""}`} />
        </Suspense>
      </div>

      {tab === "clients" && <ClientsReport f={f} />}
      {tab === "funnel" && <FunnelReport f={f} />}
      {tab === "losses" && <LossesReport f={f} isAdmin={isAdmin} />}
      {tab === "ads" && <AdsReport f={f} level={level} tabHref={tabHref("ads")} />}
      {tab === "managers" && <ManagersReport f={f} />}
      {tab === "services" && <ServicesReport f={f} />}
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
  const { table, funnel } = await funnelTable(f);
  return (
    <div className="grid grid-cols-[1.2fr_1fr] gap-5">
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
        <p className="px-5 py-3 text-xs text-muted-foreground">{table.note}</p>
      </Card>
    </div>
  );
}

async function LossesReport({ f, isAdmin }: { f: F; isAdmin: boolean }) {
  const t = await lossesTables(f);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[1.3fr_1fr] gap-5">
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
        <div className="flex rounded-lg bg-slate-200/60 p-1 text-sm">
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

async function ManagersReport({ f }: { f: F }) {
  const { table, rows } = await managersTable(f);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{f.t("reports.managersTitle")}</CardTitle>
        </CardHeader>
        <ReportTable table={table} currency={f.currency} />
        <p className="px-5 py-3 text-xs text-muted-foreground">{table.note}</p>
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

async function ServicesReport({ f }: { f: F }) {
  const t = await servicesTables(f);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5">
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

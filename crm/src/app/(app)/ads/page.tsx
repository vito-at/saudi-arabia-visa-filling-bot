import Link from "next/link";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportTable } from "@/components/reports/report-table";
import { MoneyValueBars } from "@/components/reports/charts";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { readFilters } from "@/lib/reports/data";
import { AD_GROUPS, defaultAdGroup, loadAdsOverview, type AdGroup, type AdStats } from "@/lib/reports/ads";
import { AD_LEVELS, adsTable, type Table } from "@/lib/reports/tables";
import { delta, type AdLevel } from "@/lib/reports/calc";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireAdmin } from "@/lib/session";
import { formatters } from "@/i18n/core";
import { cn } from "@/lib/utils";

/** «Реклама» — только для администратора: расход Meta, цена лида и окупаемость по периодам */
export default async function AdsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAdmin();
  const f = await readFilters(params, user);
  const { t } = f;
  const fm = formatters(f.locale);
  const money = (n: number | null) => (n === null ? "—" : fm.money(n, f.currency));
  const group: AdGroup = AD_GROUPS.includes(sp(params, "group") as AdGroup) ? (sp(params, "group") as AdGroup) : defaultAdGroup(f.period);
  const level: AdLevel = (sp(params, "level") as AdLevel) in AD_LEVELS ? (sp(params, "level") as AdLevel) : "campaign";

  const [o, campaigns] = await Promise.all([loadAdsOverview(f, group), adsTable(f, level)]);
  const { totals: cur, prev } = o;

  const keep = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string") next.set(k, v);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    return `/ads?${next.toString()}`;
  };

  // подпись периода на оси и в таблице
  const label = (start: string) => {
    const d = `${start}T12:00:00Z`;
    if (group === "month") return formatDate(d).slice(3);
    return formatDate(d).slice(0, 5);
  };
  const chart = (k: "spend" | "cpl") => o.buckets.map((b) => ({ x: label(b.start), value: k === "spend" ? b.spend : b.cpl }));

  const tile = (labelKey: Parameters<typeof t>[0], k: keyof AdStats, fmt: (n: number | null) => string, invert = false) => (
    <KpiTile label={t(labelKey)} value={fmt(cur[k])} delta={delta(cur[k], prev[k])} prev={fmt(prev[k])} invert={invert} />
  );
  const int = (n: number | null) => (n === null ? "—" : formatNumber(n));
  const pct = (n: number | null) => (n === null ? "—" : formatPercent(n));

  const byPeriod: Table = {
    title: t("ads.byPeriodTitle"),
    columns: [
      { key: "name", label: t(`ads.col.${group}`), type: "text" },
      { key: "spend", label: t("rt.col.spend"), type: "money" },
      { key: "leads", label: t("rt.col.leads"), type: "int" },
      { key: "cpl", label: t("rt.col.cpl"), type: "money" },
      { key: "sales", label: t("rt.col.sales"), type: "int" },
      { key: "cps", label: t("rt.col.cps"), type: "money" },
      { key: "clicks", label: t("rt.col.clicks"), type: "int" },
      { key: "ctr", label: t("rt.col.ctr"), type: "pct" },
      { key: "cpc", label: t("rt.col.cpc"), type: "money" },
    ],
    // новые периоды сверху
    rows: [...o.buckets].reverse().map((b) => ({
      name: group === "week" ? `${label(b.start)} – ${formatDate(new Date(new Date(`${b.start}T12:00:00Z`).getTime() + 6 * 86_400_000)).slice(0, 5)}` : label(b.start),
      spend: b.spend,
      leads: b.leads,
      cpl: b.cpl,
      sales: b.sales,
      cps: b.cps,
      clicks: b.clicks,
      ctr: b.ctr,
      cpc: b.cpc,
    })),
    totals: { name: t("rt.total"), spend: cur.spend, leads: cur.leads, cpl: cur.cpl, sales: cur.sales, cps: cur.cps, clicks: cur.clicks, ctr: cur.ctr, cpc: cur.cpc },
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("ads.title")}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <span className="inline-flex items-center gap-1 text-primary">
              <Lock className="size-3.5" /> {t("finance.adminOnly")}
            </span>
            <span>
              {t("ads.subtitle", {
                from: formatDate(f.period.from),
                to: formatDate(new Date(f.period.to.getTime() - 1)),
                pfrom: formatDate(o.prevPeriod.from),
                pto: formatDate(new Date(o.prevPeriod.to.getTime() - 1)),
                cur: f.currency,
              })}
            </span>
          </span>
        }
      />
      <Suspense>
        <ReportFilters managers={null} exportHref={`/api/reports/export?tab=ads&level=${level}`} />
      </Suspense>

      {o.noSpend && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t("ads.noSpend")}{" "}
          <Link href="/settings?tab=integration" className="font-medium underline">
            {t("ads.noSpendLink")}
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        {tile("rt.col.spend", "spend", money, true)}
        {tile("rt.col.leads", "leads", int)}
        {tile("rt.col.cpl", "cpl", money, true)}
        {tile("rt.col.cps", "cps", money, true)}
        {tile("rt.col.sales", "sales", int)}
        {tile("ads.conversion", "conversion", pct)}
        {tile("rt.col.cpc", "cpc", money, true)}
        {tile("rt.col.roi", "roi", pct)}
      </div>

      <div className="space-y-2">
        <div className="inline-flex rounded-lg bg-slate-200/60 p-1 text-sm">
          {AD_GROUPS.map((g) => (
            <Link key={g} href={keep({ group: g })} className={cn("rounded-md px-3 py-1", group === g ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}>
              {t(`ads.group.${g}`)}
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t("rt.col.spend")}</CardTitle>
            </CardHeader>
            <div className="px-2 pb-3">
              <MoneyValueBars data={chart("spend")} currency={f.currency} label={t("rt.col.spend")} />
            </div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("rt.col.cpl")}</CardTitle>
              <span className="text-xs text-muted-foreground">{t("ads.cplHint")}</span>
            </CardHeader>
            <div className="px-2 pb-3">
              <MoneyValueBars data={chart("cpl")} currency={f.currency} label={t("rt.col.cpl")} />
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{byPeriod.title}</CardTitle>
        </CardHeader>
        <ReportTable table={byPeriod} currency={f.currency} />
      </Card>

      <Card>
        <CardHeader>
          <div className="no-scrollbar flex max-w-full overflow-x-auto whitespace-nowrap rounded-lg bg-slate-200/60 p-1 text-sm">
            {(Object.keys(AD_LEVELS) as AdLevel[]).map((l) => (
              <Link key={l} href={keep({ level: l })} className={cn("rounded-md px-3 py-1", level === l ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}>
                {t(AD_LEVELS[l])}
              </Link>
            ))}
          </div>
        </CardHeader>
        <ReportTable table={campaigns} currency={f.currency} />
        <p className="px-5 py-3 text-xs text-muted-foreground">{campaigns.note}</p>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t("ads.footnote", { leads: int(cur.leads), revenue: money(cur.revenue), profit: money(cur.profit) })}
      </p>
    </div>
  );
}

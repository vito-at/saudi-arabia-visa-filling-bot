import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";
import { CurrencySwitch } from "@/components/common/currency-switch";
import { SearchBox } from "@/components/common/search-box";
import { getClientAggregates } from "@/lib/clients";
import { formatDate, formatNumber } from "@/lib/format";
import { toNum } from "@/lib/money";
import { prettyPhone } from "@/lib/phone";
import { getSettings } from "@/lib/refs";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { TKey } from "@/i18n/core";
import { getI18n } from "@/i18n/server";

const PAGE = 50;
const SORTS = { revenue: "clients.sort.revenue", profit: "clients.sort.profit", deals: "clients.sort.deals", lastDeal: "clients.sort.lastDeal", name: "clients.sort.name" } as const satisfies Record<string, TKey>;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { t, f } = await getI18n();
  const settings = await getSettings();
  const currency = sp(params, "cur") === "UZS" ? "UZS" : "USD";
  const sort = (sp(params, "sort") ?? "revenue") as keyof typeof SORTS;
  const page = Math.max(1, Number(sp(params, "page")) || 1);
  const { rows, total } = await getClientAggregates({
    currency,
    usdRate: toNum(settings.usdRate),
    search: sp(params, "q"),
    managerId: user.role === "ADMIN" ? null : user.id,
    sort: sort in SORTS ? sort : "revenue",
    limit: PAGE,
    offset: (page - 1) * PAGE,
  });

  const sortHref = (k: string) => {
    const q = new URLSearchParams();
    for (const [key, v] of Object.entries(params)) if (typeof v === "string" && key !== "page") q.set(key, v);
    q.set("sort", k);
    return `/clients?${q.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title={t("clients.title")}
        description={t("clients.description", { cur: currency, rate: formatNumber(toNum(settings.usdRate), 2), sum: f.sum })}
        actions={
          <Suspense>
            <SearchBox placeholder={t("clients.search")} />
            <CurrencySwitch value={currency} />
          </Suspense>
        }
      />
      <Card>
        <div className="no-scrollbar flex gap-1 overflow-x-auto whitespace-nowrap border-b px-4 py-2 text-sm">
          <span className="py-1 pr-2 text-muted-foreground">{t("clients.sortBy")}</span>
          {Object.entries(SORTS).map(([k, v]) => (
            <Link key={k} href={sortHref(k)} className={cn("rounded-md px-2 py-1", sort === k ? "bg-primary text-white" : "hover:bg-accent")}>
              {t(v)}
            </Link>
          ))}
        </div>
        <Table>
          <THead>
            <tr>
              <TH>{t("clients.col.client")}</TH>
              <TH>{t("clients.col.phone")}</TH>
              <TH className="text-right">{t("clients.col.leads")}</TH>
              <TH className="text-right">{t("clients.col.deals")}</TH>
              <TH className="text-right">{t("clients.col.revenue")}</TH>
              <TH className="text-right">{t("clients.col.profit")}</TH>
              <TH>{t("clients.col.lastDeal")}</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </TD>
                <TD className="whitespace-nowrap">{prettyPhone(c.phone)}</TD>
                <TD className="text-right">{c.leads}</TD>
                <TD className="text-right">{c.deals}</TD>
                <TD className="text-right font-medium whitespace-nowrap">{c.deals ? f.money(c.revenue, currency) : "—"}</TD>
                <TD className={cn("text-right whitespace-nowrap", c.profit > 0 && "text-emerald-700")}>{c.deals ? f.money(c.profit, currency) : "—"}</TD>
                <TD>{c.lastDealAt ? formatDate(c.lastDealAt) : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {rows.length === 0 && <Empty>{t("clients.empty")}</Empty>}
        <Pagination page={page} pageSize={PAGE} total={total} params={params} basePath="/clients" />
      </Card>
    </div>
  );
}

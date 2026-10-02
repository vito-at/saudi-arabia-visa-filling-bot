import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { formatDate, toInputDate } from "@/lib/format";
import { readFilters } from "@/lib/reports/data";
import { buildWorkbook } from "@/lib/reports/excel";
import { AD_LEVELS, adsTable, clientsTable, dashboardTables, funnelTable, lossesTables, managersTable, REPORT_TABS, servicesTables, type ReportTab, type Table } from "@/lib/reports/tables";
import type { AdLevel } from "@/lib/reports/calc";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const tab = (params.tab in REPORT_TABS ? params.tab : "funnel") as ReportTab;
  const f = await readFilters(params, user);
  const { t } = f;

  let tables: Table[];
  switch (tab) {
    case "dashboard":
      tables = await dashboardTables(f);
      break;
    case "clients":
      tables = [await clientsTable(f)];
      break;
    case "funnel":
      tables = [(await funnelTable(f)).table];
      break;
    case "losses": {
      const t = await lossesTables(f);
      tables = user.role === "ADMIN" ? [t.main, t.byManager, t.byCampaign] : [t.main, t.byCampaign];
      break;
    }
    case "ads":
      tables = await Promise.all((Object.keys(AD_LEVELS) as AdLevel[]).map((l) => adsTable(f, l)));
      break;
    case "managers":
      tables = [(await managersTable(f)).table];
      break;
    case "services": {
      const t = await servicesTables(f);
      tables = [t.services, t.destinations];
      break;
    }
  }
  const to = new Date(f.period.to.getTime() - 1);
  const buf = await buildWorkbook(tables, {
    title: `Orient Travel — ${t(REPORT_TABS[tab])}`,
    subtitle: `${t("excel.subtitle", { from: formatDate(f.period.from), to: formatDate(to), cur: f.currency, rate: f.rate, costRate: f.costRate })}${user.role !== "ADMIN" ? `; ${t("excel.manager", { name: user.name })}` : ""}`,
    currency: f.currency,
    minutesLabel: t("excel.minutes"),
  });
  const file = `orient-${tab}-${toInputDate(f.period.from)}_${toInputDate(to)}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file}"`,
    },
  });
}

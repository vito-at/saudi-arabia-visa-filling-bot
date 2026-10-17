import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { leadScope } from "@/lib/access";
import { formatDateTime, toInputDate } from "@/lib/format";
import { buildLeadOrder, buildLeadWhere, viewWhere } from "@/lib/leads/query";
import { buildWorkbook } from "@/lib/reports/excel";
import { leadSourceLabel, reasonName, serviceLabel, statusName } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Список лидов с текущими фильтрами в Excel (менеджер — только свои и нераспределённые) */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { t } = await getI18n();
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const leads = await prisma.lead.findMany({
    where: { AND: [leadScope(user), buildLeadWhere(params), viewWhere(params)] },
    orderBy: buildLeadOrder(params),
    take: 5000,
    include: { status: true, manager: { select: { name: true } }, lossReason: true, deals: { select: { amount: true, currency: true } } },
  });
  const buf = await buildWorkbook(
    [
      {
        title: t("nav.leads"),
        columns: [
          { key: "created", label: t("leads.col.created"), type: "text" },
          { key: "name", label: t("lead.field.name"), type: "text" },
          { key: "phone", label: t("lead.field.phone"), type: "text" },
          { key: "source", label: t("leads.col.source"), type: "text" },
          { key: "campaign", label: t("lead.ad.campaign"), type: "text" },
          { key: "status", label: t("leads.col.status"), type: "text" },
          { key: "manager", label: t("rt.managers.manager"), type: "text" },
          { key: "service", label: t("lead.field.service"), type: "text" },
          { key: "destination", label: t("lead.field.destination"), type: "text" },
          { key: "loss", label: t("lead.lossReason"), type: "text" },
          { key: "sales", label: t("lead.deals"), type: "text" },
        ],
        rows: leads.map((l) => ({
          created: formatDateTime(l.createdAt),
          name: l.name,
          phone: l.phone ?? l.phoneRaw,
          source: leadSourceLabel(t, l),
          campaign: l.campaignName,
          status: statusName(t, l.status.name),
          manager: l.manager?.name ?? null,
          service: l.serviceType ? serviceLabel(t, l.serviceType) : null,
          destination: l.destination,
          loss: l.lossReason ? reasonName(t, l.lossReason.name) + (l.lossComment ? ` — ${l.lossComment}` : "") : null,
          sales: l.deals.map((d) => `${d.amount} ${d.currency}`).join(", ") || null,
        })),
      },
    ],
    { title: "Orient Travel — " + t("nav.leads"), subtitle: formatDateTime(new Date()), currency: "USD", minutesLabel: t("excel.minutes") },
  );
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orient-leads-${toInputDate(new Date())}.xlsx"`,
    },
  });
}

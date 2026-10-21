import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma, VisaStatus } from "@prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { VisaStatusBadge } from "@/components/visa/visa-status";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { FINAL_VISA, VISA_STATUSES, handedVisa, requirementsFor } from "@/lib/visa";
import { cn } from "@/lib/utils";
import type { TKey } from "@/i18n/core";
import { getI18n } from "@/i18n/server";

/** Кабинет визового специалиста: визовые заявки от менеджеров по продажам и с сайта */
export default async function VisaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  if (user.role !== "VISA" && user.role !== "ADMIN") redirect("/");
  const { t } = await getI18n();
  const status = sp(params, "s");
  const source = sp(params, "src");
  const mine = sp(params, "mine") === "1";

  const where: Prisma.LeadServiceWhereInput = {
    ...handedVisa,
    ...(status === "done" ? { status: { in: FINAL_VISA } } : status && VISA_STATUSES.includes(status as VisaStatus) ? { status: status as VisaStatus } : { status: { notIn: FINAL_VISA } }),
    ...(source === "SALES" || source === "WEBSITE" ? { source } : {}),
    ...(mine ? { assigneeId: user.id } : {}),
  };
  const [rows, counts] = await Promise.all([
    prisma.leadService.findMany({
      where,
      orderBy: [{ statusAt: "desc" }],
      take: 300,
      include: {
        lead: { select: { name: true, phone: true, phoneRaw: true, manager: { select: { name: true } } } },
        assignee: { select: { name: true } },
        documents: { select: { docType: true } },
      },
    }),
    prisma.leadService.groupBy({ by: ["status"], where: handedVisa, _count: { _all: true } }),
  ]);
  const reqs = await requirementsFor(rows);
  const count = (s: VisaStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const active = VISA_STATUSES.filter((s) => !FINAL_VISA.includes(s)).reduce((n, s) => n + count(s), 0);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ s: status, src: source, mine: mine ? "1" : null, ...patch })) if (v) p.set(k, v);
    const q = p.toString();
    return q ? `/visa?${q}` : "/visa";
  };
  const tab = (active: boolean) => cn("rounded-md px-2.5 py-1 text-sm whitespace-nowrap", active ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent");

  return (
    <div>
      <PageHeader title={t("visa.title")} description={t("visa.subtitle")} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Link href={href({ s: null })} className={tab(!status)}>
          {t("visa.active")} · {active}
        </Link>
        {VISA_STATUSES.filter((s) => !FINAL_VISA.includes(s)).map((s) => (
          <Link key={s} href={href({ s })} className={tab(status === s)}>
            {t(`visa.status.${s}` as TKey)} · {count(s)}
          </Link>
        ))}
        <Link href={href({ s: "done" })} className={tab(status === "done")}>
          {t("visa.done")} · {count("APPROVED") + count("REJECTED")}
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {[
          { v: null, label: t("visa.srcAll") },
          { v: "SALES", label: t("visa.srcSales") },
          { v: "WEBSITE", label: t("visa.srcSite") },
        ].map((o) => (
          <Link key={o.v ?? "all"} href={href({ src: o.v })} className={tab(source === o.v || (!source && !o.v))}>
            {o.label}
          </Link>
        ))}
        <Link href={href({ mine: mine ? null : "1" })} className={tab(mine)}>
          {t("visa.mine")}
        </Link>
      </div>

      <Card className="overflow-hidden">
        {!rows.length && <div className="p-6 text-center text-sm text-muted-foreground">{t("visa.empty")}</div>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t("visa.client")}</th>
                  <th className="px-3 py-2 font-medium">{t("lead.visaCountry")}</th>
                  <th className="px-3 py-2 font-medium">{t("visa.source")}</th>
                  <th className="px-3 py-2 font-medium">{t("visa.stage")}</th>
                  <th className="px-3 py-2 font-medium">{t("visa.docs")}</th>
                  <th className="px-3 py-2 font-medium">{t("visa.assignee")}</th>
                  <th className="px-4 py-2 font-medium">{t("visa.updated")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r, i) => {
                  const need = reqs[i].map((x) => x.name);
                  const have = need.filter((n) => r.documents.some((d) => d.docType === n)).length;
                  return (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/visa/${r.id}`} className="font-medium text-primary hover:underline">
                          {r.lead.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.lead.phone ? prettyPhone(r.lead.phone) : r.lead.phoneRaw || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5">{r.country ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs">{r.source === "WEBSITE" ? t("visa.fromSite") : t("visa.fromManager", { name: r.lead.manager?.name ?? "—" })}</td>
                      <td className="px-3 py-2.5">
                        <VisaStatusBadge status={r.status} />
                      </td>
                      <td className={cn("px-3 py-2.5 tabular-nums", need.length && have === need.length ? "text-emerald-600" : "")}>
                        {have}/{need.length}
                        {r.documents.length > have && <span className="text-xs text-muted-foreground"> +{r.documents.length - have}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{r.assignee?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(r.statusAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, MessageCircle, Phone, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocChecklist } from "@/components/visa/doc-checklist";
import { VisaPanel } from "@/components/visa/visa-panel";
import { SiteCard } from "@/components/visa/site-card";
import { readSiteData } from "@/lib/orient-visa";
import { toNum } from "@/lib/money";
import { VisaStatusBadge } from "@/components/visa/visa-status";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { prettyPhone, telegramLink, whatsappLink } from "@/lib/phone";
import { requireUser } from "@/lib/session";
import { handedVisa } from "@/lib/visa";
import { loadServiceViews } from "@/lib/visa-view";
import { leadSourceLabel } from "@/i18n/labels";
import type { TKey } from "@/i18n/core";
import { getI18n } from "@/i18n/server";

/** Визовая заявка в кабинете визового специалиста: клиент, документы, этап, история */
export default async function VisaApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (user.role !== "VISA" && user.role !== "ADMIN") redirect("/");
  const { t } = await getI18n();
  const s = await prisma.leadService.findFirst({
    where: { id, ...handedVisa },
    include: {
      assignee: { select: { id: true, name: true } },
      siteEvents: { orderBy: { createdAt: "desc" }, take: 20, select: { sentAt: true, lastError: true } },
      documents: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, docType: true, externalId: true, travelerName: true } },
      events: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          phoneRaw: true,
          source: true,
          createdAt: true,
          travelFrom: true,
          travelTo: true,
          travelers: true,
          visaApplications: true,
          manager: { select: { name: true } },
          client: { select: { email: true } },
        },
      },
    },
  });
  if (!s) notFound();
  const [view] = await loadServiceViews({ id: s.id });
  const site = !!s.externalId;
  const pendingEvents = s.siteEvents.filter((e) => !e.sentAt);
  const lastSent = s.siteEvents.find((e) => e.sentAt)?.sentAt ?? null;
  const lead = s.lead;
  // иностранный номер (клиент сайта из другой страны) хранится как есть в phoneRaw
  const phone = lead.phone ?? lead.phoneRaw;
  const wa = whatsappLink(phone);
  const tg = telegramLink(phone);
  const info: [string, React.ReactNode][] = [
    [t("field.phone"), phone ? prettyPhone(phone) : "—"],
    ["Email", lead.client.email ?? "—"],
    [t("visa.source"), s.source === "WEBSITE" ? t("visa.fromSite") : t("visa.fromManager", { name: lead.manager?.name ?? "—" })],
    [t("visa.leadSource"), leadSourceLabel(t, lead)],
    [t("visa.trip"), lead.travelFrom ? `${formatDate(lead.travelFrom)}${lead.travelTo ? ` — ${formatDate(lead.travelTo)}` : ""}` : "—"],
    [t("lead.field.visaApplications"), lead.visaApplications ?? lead.travelers ?? "—"],
    [t("visa.created"), formatDateTime(lead.createdAt)],
  ];

  return (
    <div>
      <Link href="/visa" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("visa.title")}
      </Link>
      <PageHeader
        title={`${lead.name}${s.country ? ` — ${t("docs.visa")}: ${s.country}` : ""}`}
        description={<VisaStatusBadge status={s.status} />}
        actions={
          user.role === "ADMIN" ? (
            <Link href={`/leads/${lead.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-sm hover:bg-accent">
              <ExternalLink className="size-4" /> {t("chats.openLead")}
            </Link>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("visa.client")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="divide-y text-sm">
                {info.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[10rem_1fr] gap-2 py-1.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              {phone && (
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:${phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent">
                    <Phone className="size-4" /> {t("visa.call")}
                  </a>
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent">
                      <MessageCircle className="size-4" /> WhatsApp
                    </a>
                  )}
                  {tg && (
                    <a href={tg} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent">
                      <Send className="size-4" /> Telegram
                    </a>
                  )}
                </div>
              )}
              {s.note && <p className="rounded-md bg-muted/50 p-2 text-sm whitespace-pre-wrap">{s.note}</p>}
            </CardContent>
          </Card>
          {site && (
            <Card>
              <CardHeader>
                <CardTitle>{t("ov.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <SiteCard
                  serviceId={s.id}
                  data={readSiteData(s.siteDataEnc)}
                  info={{
                    number: s.externalNumber,
                    url: s.externalUrl,
                    visaType: s.visaType,
                    nationality: s.nationality,
                    urgent: s.urgent,
                    paidAmount: s.paidAmount === null ? null : toNum(s.paidAmount),
                    agency: s.agencyName ? `${s.agencyName}${s.agencyInn ? `, ИНН ${s.agencyInn}` : ""}` : null,
                    fetchedAt: s.siteFetchedAt ? formatDateTime(s.siteFetchedAt) : null,
                    fetchError: s.siteFetchError,
                    fetchPending: s.siteFetchNeeded,
                    events: { pending: pendingEvents.length, failed: pendingEvents.find((e) => e.lastError)?.lastError ?? null, lastSentAt: lastSent ? formatDateTime(lastSent) : null },
                  }}
                />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t("visa.docs")}</CardTitle>
            </CardHeader>
            <CardContent>{view && <DocChecklist service={view} userId={user.id} isAdmin={user.role === "ADMIN"} />}</CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("visa.stage")}</CardTitle>
            </CardHeader>
            <CardContent>
              <VisaPanel
                serviceId={s.id}
                status={s.status}
                assignee={s.assignee?.name ?? null}
                isMine={s.assignee?.id === user.id}
                site={
                  site
                    ? {
                        siteDocs: s.documents.filter((d) => d.externalId).map((d) => ({ externalId: d.externalId!, title: d.docType, traveler: d.travelerName })),
                        files: s.documents.map((d) => ({ id: d.id, name: d.fileName, docType: d.docType })),
                        portalReference: s.portalReference,
                      }
                    : null
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("visa.history")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!s.events.length && <p className="text-sm text-muted-foreground">—</p>}
              <ol className="space-y-3">
                {s.events.map((e) => (
                  <li key={e.id} className="border-l-2 pl-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDateTime(e.createdAt)}</span>
                      {e.user && <span>· {e.user.name}</span>}
                      {e.status && <VisaStatusBadge status={e.status} />}
                    </div>
                    {e.comment && (
                      <p className="mt-1 whitespace-pre-wrap">
                        {e.fromClient && <span className="mr-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">{t("ov.fromClientBadge")}</span>}
                        {e.toClient && <span className="mr-1 rounded bg-sky-100 px-1 text-[10px] text-sky-800 dark:bg-sky-950 dark:text-sky-300">{t("ov.toClientBadge")}</span>}
                        {e.comment}
                      </p>
                    )}
                    {!e.comment && e.status && <p className="mt-1 text-muted-foreground">{t("visa.stageSet", { stage: t(`visa.status.${e.status}` as TKey) })}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

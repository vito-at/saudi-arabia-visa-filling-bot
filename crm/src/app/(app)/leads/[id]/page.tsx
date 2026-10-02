import { loadRateBook } from "@/lib/rate-history";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Phone, Repeat, Send, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Comments } from "@/components/leads/comments";
import { LeadDetailsForm } from "@/components/leads/lead-details-form";
import { DealsPanel, DeleteLeadButton, ManagerControl, TakeButton } from "@/components/leads/lead-side";
import { StatusControl } from "@/components/leads/status-control";
import { NewTaskForm, TaskRow } from "@/components/tasks/task-list";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/access";
import { fieldLabel, historyValue, reasonName, sourceLabel, statusName } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { formatDateTime, toInputDate } from "@/lib/format";
import { sumDeals, toNum } from "@/lib/money";
import { prettyPhone, telegramLink, whatsappLink } from "@/lib/phone";
import { getLossReasons, getManagers, getSettings, getStatuses } from "@/lib/refs";
import { isOverdueNew } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";

type Answer = { key: string; label?: string; value: string };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { t, f } = await getI18n();
  const lead = await prisma.lead.findFirst({
    where: { id, ...leadScope(user) },
    include: {
      status: true,
      manager: { select: { name: true } },
      lossReason: true,
      client: { include: { leads: { select: { id: true, createdAt: true, status: true, managerId: true, hiddenFromManagers: true }, orderBy: { createdAt: "desc" } }, deals: true } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      history: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      tasks: { include: { assignee: { select: { name: true } } }, orderBy: [{ doneAt: { sort: "asc", nulls: "first" } }, { dueAt: "asc" }] },
      deals: { include: { manager: { select: { name: true } } }, orderBy: { paidAt: "desc" } },
    },
  });
  if (!lead) notFound();

  const [statuses, reasons, users, settings] = await Promise.all([getStatuses(), getLossReasons(), getManagers(), getSettings()]);
  const rate = toNum(settings.usdRate);
  const answers = (Array.isArray(lead.formAnswers) ? lead.formAnswers : []) as Answer[];
  const overdue = isOverdueNew(lead, settings.unprocessedAlertMin);
  const clientTotals = sumDeals(lead.client.deals, "USD", await loadRateBook(settings));
  const otherLeads = lead.client.leads.filter((l) => l.id !== lead.id && (user.role === "ADMIN" || l.managerId === user.id || (!l.managerId && !l.hiddenFromManagers)));
  const wa = whatsappLink(lead.phone);
  const tg = telegramLink(lead.phone);
  const firstResponse = lead.firstResponseAt ? (lead.firstResponseAt.getTime() - lead.createdAt.getTime()) / 60000 : null;

  return (
    <div className="space-y-5">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("lead.back")}
      </Link>

      <Card className={overdue ? "border-red-300" : undefined}>
        <div className="flex items-start justify-between gap-6 p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{lead.name}</h1>
              {lead.isRepeat && (
                <Badge className="border-amber-300 bg-amber-50 text-amber-800">
                  <Repeat className="size-3" /> {t("leads.repeat")}
                </Badge>
              )}
              {overdue && (
                <Badge className="border-red-300 bg-red-50 text-red-700">
                  <Flame className="size-3" /> {t("lead.notTaken", { time: f.duration((Date.now() - lead.createdAt.getTime()) / 60000) })}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {lead.phone || lead.phoneRaw ? (
                <a href={`tel:${lead.phone ?? lead.phoneRaw}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                  <Phone className="size-4" /> {lead.phone ? prettyPhone(lead.phone) : lead.phoneRaw}
                </a>
              ) : null}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              )}
              {tg && (
                <a href={tg} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sky-600 hover:underline">
                  <Send className="size-4" /> Telegram
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline">
                  <Mail className="size-4" /> {lead.email}
                </a>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {sourceLabel(t, lead.source)} · {t("lead.createdAt", { date: formatDateTime(lead.createdAt) })}
              {firstResponse !== null && ` · ${t("lead.firstResponse", { time: f.duration(firstResponse) })}`}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {lead.status.kind === "NEW" && !lead.managerId && <TakeButton leadId={lead.id} />}
            {isAdmin && <DeleteLeadButton leadId={lead.id} name={lead.name} deals={lead.deals.length} fromMeta={!!lead.leadgenId} />}
          </div>
        </div>
        <div className="border-t px-5 py-4">
          <StatusControl
            leadId={lead.id}
            current={{ id: lead.status.id, name: statusName(t, lead.status.name), color: lead.status.color, kind: lead.status.kind }}
            statuses={statuses.map((s) => ({ id: s.id, name: statusName(t, s.name), color: s.color, kind: s.kind }))}
            reasons={reasons.map((r) => ({ id: r.id, name: reasonName(t, r.name) }))}
            rate={rate}
            callbackAt={lead.callbackAt?.toISOString() ?? null}
          />
          {lead.status.kind === "LOST" && lead.lossReason && (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {t("lead.lossReason")} <b>{reasonName(t, lead.lossReason.name)}</b>
              {lead.lossComment && <span> — {lead.lossComment}</span>}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t("lead.details")}</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadDetailsForm
                lead={{
                  id: lead.id,
                  name: lead.name,
                  phone: lead.phone,
                  phoneRaw: lead.phoneRaw,
                  email: lead.email,
                  serviceType: lead.serviceType,
                  destination: lead.destination,
                  travelFrom: toInputDate(lead.travelFrom),
                  travelTo: toInputDate(lead.travelTo),
                  travelers: lead.travelers,
                }}
              />
            </CardContent>
          </Card>

          {answers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{lead.formName ? t("lead.formAnswersNamed", { name: lead.formName }) : t("lead.formAnswers")}</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {answers.map((a) => (
                  <div key={a.key} className="grid grid-cols-1 gap-1 py-2 text-sm sm:grid-cols-[240px_1fr] sm:gap-3">
                    <span className="text-muted-foreground">{a.label || a.key}</span>
                    <span className="whitespace-pre-wrap">{a.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("lead.comments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Comments
                leadId={lead.id}
                currentUserId={user.id}
                comments={lead.comments.map((c) => ({
                  id: c.id,
                  text: c.text,
                  author: c.author.name,
                  authorId: c.authorId,
                  createdAt: c.createdAt.toISOString(),
                  editedAt: c.editedAt?.toISOString() ?? null,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("lead.history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-3 border-l pl-5">
                {lead.history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-card bg-slate-300" />
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(h.createdAt)} · {h.user?.name ?? t("history.system")}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{fieldLabel(t, h.field)}: </span>
                      {h.field === "created" ? (
                        <span>{historyValue(t, h.newValue)}</span>
                      ) : (
                        <>
                          {h.oldValue && <span className="text-muted-foreground line-through">{historyValue(t, h.oldValue)}</span>}
                          {h.oldValue && " → "}
                          <span className="font-medium">{historyValue(t, h.newValue) ?? "—"}</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t("lead.owner")}</CardTitle>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <ManagerControl leadId={lead.id} managerId={lead.managerId} managers={users.map((u) => ({ id: u.id, name: u.name }))} />
              ) : (
                <div className="text-sm">{lead.manager?.name ?? t("lead.ownerNone")}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("lead.tasks")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <NewTaskForm leadId={lead.id} assignees={isAdmin ? users.map((u) => ({ id: u.id, name: u.name })) : undefined} />
              {lead.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  t={{ id: task.id, title: task.title, dueAt: task.dueAt.toISOString(), doneAt: task.doneAt?.toISOString() ?? null, assignee: task.assignee.name, isCallback: task.isCallback }}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("lead.deals")}</CardTitle>
            </CardHeader>
            <CardContent>
              <DealsPanel
                leadId={lead.id}
                rate={rate}
                canManage={isAdmin}
                deals={lead.deals.map((d) => ({
                  id: d.id,
                  product: d.product,
                  amount: toNum(d.amount),
                  cost: toNum(d.cost),
                  currency: d.currency,
                  paidAt: d.paidAt.toISOString(),
                  manager: d.manager?.name ?? null,
                  costConfirmed: d.costConfirmed,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("lead.client")}</CardTitle>
              <Link href={`/clients/${lead.clientId}`} className="text-xs text-primary hover:underline">
                {t("common.open")}
              </Link>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("lead.clientLeads")}</span>
                <span>{lead.client.leads.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("lead.clientDeals")}</span>
                <span>{clientTotals.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("lead.clientRevenue")}</span>
                <span className="font-medium">{f.money(clientTotals.revenue, "USD")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("lead.clientProfit")}</span>
                <span className="font-medium text-emerald-700">{f.money(clientTotals.profit, "USD")}</span>
              </div>
              {otherLeads.length > 0 && (
                <div className="pt-2">
                  <div className="mb-1 text-xs text-muted-foreground">{t("lead.otherLeads")}</div>
                  {otherLeads.map((l) => (
                    <Link key={l.id} href={`/leads/${l.id}`} className="flex justify-between py-0.5 text-xs hover:underline">
                      <span>{formatDateTime(l.createdAt)}</span>
                      <span style={{ color: l.status.color }}>{statusName(t, l.status.name)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(lead.campaignName || lead.formName || lead.adName) && (
            <Card>
              <CardHeader>
                <CardTitle>{t("lead.ads")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {[
                  [t("lead.ad.platform"), lead.platform === "ig" ? "Instagram" : lead.platform === "fb" ? "Facebook" : lead.platform],
                  [t("lead.ad.campaign"), lead.campaignName],
                  [t("lead.ad.adset"), lead.adsetName],
                  [t("lead.ad.ad"), lead.adName],
                  [t("lead.ad.form"), lead.formName],
                  [t("lead.ad.date"), lead.metaCreatedAt ? formatDateTime(lead.metaCreatedAt) : null],
                  ["Lead ID", lead.leadgenId],
                ].map(([k, v]) =>
                  v ? (
                    <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="break-words">{v}</span>
                    </div>
                  ) : null,
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

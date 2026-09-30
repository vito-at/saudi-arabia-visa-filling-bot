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
import { FIELD_LABELS, SOURCE_LABELS } from "@/lib/constants";
import { formatDateTime, formatDuration, formatMoney, toInputDate } from "@/lib/format";
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
  const lead = await prisma.lead.findFirst({
    where: { id, ...leadScope(user) },
    include: {
      status: true,
      manager: { select: { name: true } },
      lossReason: true,
      client: { include: { leads: { select: { id: true, createdAt: true, status: true }, orderBy: { createdAt: "desc" } }, deals: true } },
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
  const clientTotals = sumDeals(lead.client.deals, "USD", rate);
  const otherLeads = lead.client.leads.filter((l) => l.id !== lead.id);
  const wa = whatsappLink(lead.phone);
  const tg = telegramLink(lead.phone);
  const firstResponse = lead.firstResponseAt ? (lead.firstResponseAt.getTime() - lead.createdAt.getTime()) / 60000 : null;

  return (
    <div className="space-y-5">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все лиды
      </Link>

      <Card className={overdue ? "border-red-300" : undefined}>
        <div className="flex items-start justify-between gap-6 p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{lead.name}</h1>
              {lead.isRepeat && (
                <Badge className="border-amber-300 bg-amber-50 text-amber-800">
                  <Repeat className="size-3" /> Повторное обращение
                </Badge>
              )}
              {overdue && (
                <Badge className="border-red-300 bg-red-50 text-red-700">
                  <Flame className="size-3" /> Не взят в работу {formatDuration((Date.now() - lead.createdAt.getTime()) / 60000)}
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
              {SOURCE_LABELS[lead.source]} · создан {formatDateTime(lead.createdAt)}
              {firstResponse !== null && ` · первая реакция через ${formatDuration(firstResponse)}`}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {lead.status.kind === "NEW" && (!lead.managerId || lead.managerId === user.id) && <TakeButton leadId={lead.id} />}
            {isAdmin && <DeleteLeadButton leadId={lead.id} name={lead.name} deals={lead.deals.length} fromMeta={!!lead.leadgenId} />}
          </div>
        </div>
        <div className="border-t px-5 py-4">
          <StatusControl
            leadId={lead.id}
            current={{ id: lead.status.id, name: lead.status.name, color: lead.status.color, kind: lead.status.kind }}
            statuses={statuses.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind }))}
            reasons={reasons.map((r) => ({ id: r.id, name: r.name }))}
            rate={rate}
          />
          {lead.status.kind === "LOST" && lead.lossReason && (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              Причина отказа: <b>{lead.lossReason.name}</b>
              {lead.lossComment && <span> — {lead.lossComment}</span>}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-[1fr_380px] gap-5">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Данные клиента и поездки</CardTitle>
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
                <CardTitle>Ответы из формы{lead.formName ? ` «${lead.formName}»` : ""}</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {answers.map((a) => (
                  <div key={a.key} className="grid grid-cols-[240px_1fr] gap-3 py-2 text-sm">
                    <span className="text-muted-foreground">{a.label || a.key}</span>
                    <span className="whitespace-pre-wrap">{a.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Комментарии</CardTitle>
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
              <CardTitle>История изменений</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-3 border-l pl-5">
                {lead.history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-white bg-slate-300" />
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(h.createdAt)} · {h.user?.name ?? "Система"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{FIELD_LABELS[h.field] ?? h.field}: </span>
                      {h.field === "created" ? (
                        <span>{h.newValue}</span>
                      ) : (
                        <>
                          {h.oldValue && <span className="text-muted-foreground line-through">{h.oldValue}</span>}
                          {h.oldValue && " → "}
                          <span className="font-medium">{h.newValue ?? "—"}</span>
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
              <CardTitle>Ответственный</CardTitle>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <ManagerControl leadId={lead.id} managerId={lead.managerId} managers={users.map((u) => ({ id: u.id, name: u.name }))} />
              ) : (
                <div className="text-sm">{lead.manager?.name ?? "Не назначен"}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Задачи и напоминания</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <NewTaskForm leadId={lead.id} assignees={isAdmin ? users.map((u) => ({ id: u.id, name: u.name })) : undefined} />
              {lead.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  t={{ id: t.id, title: t.title, dueAt: t.dueAt.toISOString(), doneAt: t.doneAt?.toISOString() ?? null, assignee: t.assignee.name }}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Сделки</CardTitle>
            </CardHeader>
            <CardContent>
              <DealsPanel
                leadId={lead.id}
                rate={rate}
                canDelete={isAdmin}
                deals={lead.deals.map((d) => ({
                  id: d.id,
                  product: d.product,
                  amount: toNum(d.amount),
                  cost: toNum(d.cost),
                  currency: d.currency,
                  paidAt: d.paidAt.toISOString(),
                  manager: d.manager?.name ?? null,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Клиент</CardTitle>
              <Link href={`/clients/${lead.clientId}`} className="text-xs text-primary hover:underline">
                Открыть
              </Link>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Обращений</span>
                <span>{lead.client.leads.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сделок</span>
                <span>{clientTotals.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Выручка за всё время</span>
                <span className="font-medium">{formatMoney(clientTotals.revenue, "USD")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Прибыль за всё время</span>
                <span className="font-medium text-emerald-700">{formatMoney(clientTotals.profit, "USD")}</span>
              </div>
              {otherLeads.length > 0 && (
                <div className="pt-2">
                  <div className="mb-1 text-xs text-muted-foreground">Другие обращения</div>
                  {otherLeads.map((l) => (
                    <Link key={l.id} href={`/leads/${l.id}`} className="flex justify-between py-0.5 text-xs hover:underline">
                      <span>{formatDateTime(l.createdAt)}</span>
                      <span style={{ color: l.status.color }}>{l.status.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(lead.campaignName || lead.formName || lead.adName) && (
            <Card>
              <CardHeader>
                <CardTitle>Реклама</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {[
                  ["Платформа", lead.platform === "ig" ? "Instagram" : lead.platform === "fb" ? "Facebook" : lead.platform],
                  ["Кампания", lead.campaignName],
                  ["Группа объявлений", lead.adsetName],
                  ["Объявление", lead.adName],
                  ["Форма", lead.formName],
                  ["Дата заявки", lead.metaCreatedAt ? formatDateTime(lead.metaCreatedAt) : null],
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

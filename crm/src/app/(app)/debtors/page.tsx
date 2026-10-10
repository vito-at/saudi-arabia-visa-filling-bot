import Link from "next/link";
import { Suspense } from "react";
import { MessageCircle, Phone, Send } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { SearchBox } from "@/components/common/search-box";
import { DebtActions, PaymentList } from "@/components/debtors/debt-dialogs";
import { prisma } from "@/lib/db";
import { compareDebts, debtLeft, debtTotals, dueState } from "@/lib/debts";
import { formatDate } from "@/lib/format";
import { toNum } from "@/lib/money";
import { normalizePhone, prettyPhone, telegramLink, whatsappLink } from "@/lib/phone";
import { getManagers } from "@/lib/refs";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export default async function DebtorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { t, f } = await getI18n();
  const isAdmin = user.role === "ADMIN";
  const managerId = isAdmin ? sp(params, "m") || null : user.id;
  const q = sp(params, "q")?.trim();
  const qPhone = q ? normalizePhone(q) : null;

  const where: Prisma.DealWhereInput = {
    // оплачено меньше суммы продажи
    paidAmount: { lt: prisma.deal.fields.amount },
    // менеджер видит долги по своим сделкам и своим лидам
    ...(managerId ? { OR: [{ managerId }, { lead: { managerId } }] } : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { lead: { name: { contains: q, mode: "insensitive" } } },
                { client: { name: { contains: q, mode: "insensitive" } } },
                { lead: { phone: { contains: qPhone ?? (q.replace(/\D/g, "") || q) } } },
                { product: { contains: q, mode: "insensitive" } },
              ],
            },
          ],
        }
      : {}),
  };
  const [deals, managers] = await Promise.all([
    prisma.deal.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, phoneRaw: true } },
        manager: { select: { name: true } },
        payments: { include: { user: { select: { name: true } } }, orderBy: { paidAt: "asc" } },
      },
      take: 500,
    }),
    isAdmin ? getManagers() : Promise.resolve([]),
  ]);
  const rows = deals
    .map((d) => ({ ...d, left: debtLeft(toNum(d.amount), toNum(d.paidAmount)), due: dueState(d.dueAt) }))
    .filter((d) => d.left > 0)
    .sort(compareDebts);
  const totals = debtTotals(rows);
  const overdue = rows.filter((r) => r.due.kind === "overdue").length;

  const href = (m: string | null) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (m) p.set("m", m);
    const s = p.toString();
    return s ? `/debtors?${s}` : "/debtors";
  };

  return (
    <div>
      <PageHeader
        title={t("debtors.title")}
        description={isAdmin ? t("debtors.description") : t("debtors.descriptionManager")}
        actions={
          <Suspense>
            <SearchBox placeholder={t("clients.search")} />
          </Suspense>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("debtors.totalUsd")} value={f.money(totals.USD, "USD")} tone={totals.USD > 0 ? "text-red-600" : undefined} />
        <Kpi label={t("debtors.totalUzs")} value={f.money(totals.UZS, "UZS")} tone={totals.UZS > 0 ? "text-red-600" : undefined} />
        <Kpi label={t("debtors.count")} value={String(new Set(rows.map((r) => r.clientId)).size)} />
        <Kpi label={t("debtors.overdue")} value={String(overdue)} tone={overdue > 0 ? "text-red-600" : undefined} />
      </div>

      {isAdmin && managers.length > 0 && (
        <div className="no-scrollbar -mx-3 mb-4 flex gap-1 overflow-x-auto whitespace-nowrap px-3 text-sm sm:mx-0 sm:px-0">
          {[{ id: null as string | null, name: t("debtors.allManagers") }, ...managers].map((m) => (
            <Link key={m.id ?? "all"} href={href(m.id)} className={cn("shrink-0 rounded-md px-2.5 py-1", managerId === m.id ? "bg-primary text-white" : "bg-card border hover:bg-accent")}>
              {m.name}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <Empty>{t("debtors.empty")}</Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => {
            const phone = d.lead.phone ?? d.lead.phoneRaw;
            const wa = whatsappLink(d.lead.phone);
            const tg = telegramLink(d.lead.phone);
            const dueText =
              d.due.kind === "none"
                ? t("debtors.dueNone")
                : d.due.kind === "today"
                  ? t("debtors.dueToday")
                  : d.due.kind === "overdue"
                    ? t("debtors.overdueBy", { n: d.due.days, date: formatDate(d.dueAt) })
                    : t("debtors.dueIn", { n: d.due.days, date: formatDate(d.dueAt) });
            return (
              <Card key={d.id} className={cn("p-4", d.due.kind === "overdue" && "border-red-300")}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link href={`/leads/${d.lead.id}`} className="text-base font-semibold hover:underline">
                        {d.lead.name}
                      </Link>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          d.due.kind === "overdue" ? "bg-red-50 text-red-700" : d.due.kind === "today" ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {dueText}
                      </span>
                    </div>
                    {phone && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 hover:underline" title={t("debtors.call")}>
                          <Phone className="size-4" /> {d.lead.phone ? prettyPhone(d.lead.phone) : phone}
                        </a>
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
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {d.product}
                      {" · "}
                      {t("debtors.saleDate", { date: formatDate(d.paidAt) })}
                      {d.manager && ` · ${d.manager.name}`}
                    </div>
                    {d.debtNote && <p className="whitespace-pre-line rounded-md bg-amber-50/70 px-2.5 py-1.5 text-sm text-amber-900">{d.debtNote}</p>}
                    <details className="text-sm">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        {t("debtors.payments")} · {d.payments.length}
                      </summary>
                      <div className="mt-1.5">
                        <PaymentList
                          currency={d.currency}
                          canDelete={isAdmin}
                          payments={d.payments.map((p) => ({ id: p.id, amount: toNum(p.amount), paidAt: p.paidAt.toISOString(), note: p.note, user: p.user?.name ?? null }))}
                        />
                      </div>
                    </details>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm lg:w-96 lg:shrink-0">
                    <Amount label={t("debtors.sold")} value={f.money(toNum(d.amount), d.currency)} />
                    <Amount label={t("debtors.paid")} value={f.money(toNum(d.paidAmount), d.currency)} />
                    <Amount label={t("debtors.left")} value={f.money(d.left, d.currency)} tone="text-red-600 font-semibold" />
                    <div className="col-span-3 flex flex-wrap gap-2">
                      <DebtActions debt={{ dealId: d.id, name: d.lead.name, currency: d.currency, left: d.left, dueAt: d.dueAt?.toISOString() ?? null, note: d.debtNote }} />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums", tone)}>{value}</div>
    </Card>
  );
}

function Amount({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("truncate tabular-nums", tone ?? "font-medium")}>{value}</div>
    </div>
  );
}

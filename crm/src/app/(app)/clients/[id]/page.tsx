import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";
import { prisma } from "@/lib/db";
import { clientScope } from "@/lib/access";
import { SOURCE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { calcProfit, convert, sumDeals, toNum } from "@/lib/money";
import { prettyPhone } from "@/lib/phone";
import { getSettings } from "@/lib/refs";
import { requireUser } from "@/lib/session";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone ?? ""}`}>{value}</div>
    </Card>
  );
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const client = await prisma.client.findFirst({
    where: { id, ...clientScope(user) },
    include: {
      leads: { include: { status: true, manager: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      deals: { include: { manager: { select: { name: true } }, lead: { select: { id: true } } }, orderBy: { paidAt: "desc" } },
    },
  });
  if (!client) notFound();
  const settings = await getSettings();
  const rate = toNum(settings.usdRate);
  const deals = isAdmin ? client.deals : client.deals.filter((d) => d.managerId === user.id);
  const leads = isAdmin ? client.leads : client.leads.filter((l) => l.managerId === user.id || !l.managerId);
  const usd = sumDeals(deals, "USD", rate);
  const uzs = sumDeals(deals, "UZS", rate);

  return (
    <div className="space-y-5">
      <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все клиенты
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
          {client.phone && (
            <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Phone className="size-4" />
              {prettyPhone(client.phone)}
            </a>
          )}
          {client.email && <span>{client.email}</span>}
          <span>Клиент с {formatDate(client.createdAt)}</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        <Stat label="Обращений" value={String(leads.length)} />
        <Stat label="Сделок" value={String(usd.count)} />
        <Stat label="Выручка за всё время" value={formatMoney(usd.revenue, "USD")} />
        <Stat label="Прибыль за всё время" value={formatMoney(usd.profit, "USD")} tone="text-emerald-700" />
        <Stat label="Прибыль в сумах" value={formatMoney(uzs.profit, "UZS")} tone="text-emerald-700" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сделки</CardTitle>
          <span className="text-xs text-muted-foreground">Пересчёт в $ по текущему курсу</span>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Дата оплаты</TH>
              <TH>Продукт</TH>
              <TH className="text-right">Продажа</TH>
              <TH className="text-right">Себестоимость</TH>
              <TH className="text-right">Прибыль</TH>
              <TH className="text-right">Прибыль, $</TH>
              <TH>Менеджер</TH>
            </tr>
          </THead>
          <TBody>
            {deals.map((d) => {
              const profit = calcProfit(d.amount, d.cost);
              return (
                <TR key={d.id}>
                  <TD>{formatDate(d.paidAt)}</TD>
                  <TD>
                    <Link href={`/leads/${d.lead.id}`} className="hover:underline">
                      {d.product}
                    </Link>
                  </TD>
                  <TD className="text-right whitespace-nowrap">{formatMoney(toNum(d.amount), d.currency)}</TD>
                  <TD className="text-right whitespace-nowrap">{formatMoney(toNum(d.cost), d.currency)}</TD>
                  <TD className="text-right whitespace-nowrap text-emerald-700">{formatMoney(profit, d.currency)}</TD>
                  <TD className="text-right whitespace-nowrap">{formatMoney(convert(profit, d.currency, "USD", rate), "USD")}</TD>
                  <TD>{d.manager?.name ?? "—"}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {deals.length === 0 && <Empty>Сделок пока нет</Empty>}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Обращения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {leads.map((l) => (
            <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center gap-4 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">
              <span className="w-36 text-muted-foreground">{formatDateTime(l.createdAt)}</span>
              <StatusBadge name={l.status.name} color={l.status.color} />
              <span className="flex-1">{l.destination ?? l.campaignName ?? SOURCE_LABELS[l.source]}</span>
              <span className="text-muted-foreground">{l.manager?.name ?? "не назначен"}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

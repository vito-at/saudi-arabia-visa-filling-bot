"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Search } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { DealDialog } from "@/components/deals/deal-dialog";
import { formatDate, formatPercent, toInputDate } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { sourceLabel } from "@/i18n/labels";
import { useI18n } from "@/i18n/client";
import type { FinanceDeal, FinanceLead } from "@/lib/finance";

type Sort = "date" | "profit" | "revenue";

/** Прибыль и выручка по каждому лиду; администратор может поправить сумму и себестоимость сделки */
export function FinanceLeads({ leads, currency, rate }: { leads: FinanceLead[]; currency: "UZS" | "USD"; rate: number }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("date");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{
    leadId: string;
    deal: FinanceDeal;
  } | null>(null);
  const money = (n: number) => f.money(n, currency);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const list = leads.filter((l) => !needle || l.name.toLowerCase().includes(needle) || (digits.length >= 3 && (l.phone ?? "").includes(digits)));
    if (sort === "profit") return [...list].sort((a, b) => b.profit - a.profit);
    if (sort === "revenue") return [...list].sort((a, b) => b.revenue - a.revenue);
    return list;
  }, [leads, q, sort]);

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };
  const tot = (k: "revenue" | "cost" | "profit") => rows.reduce((s, r) => s + r[k], 0);
  const profitCls = (n: number) => (n < 0 ? "text-red-600" : "text-emerald-700");

  const dealLine = (leadId: string, d: FinanceDeal) => (
    <div key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-sm">
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
        <div className="font-medium">{d.product}</div>
        <div className="text-xs text-muted-foreground">{t("finance.paid", { date: formatDate(d.paidAt) })}</div>
      </div>
      <div className="text-xs">
        <span className="text-muted-foreground">{t("finance.revenue")}:</span> {f.money(d.amount, d.currency)}
      </div>
      <div className="text-xs">
        <span className="text-muted-foreground">{t("finance.cost")}:</span> {f.money(d.cost, d.currency)}
      </div>
      <div className={cn("text-xs font-medium", profitCls(d.amount - d.cost))}>{f.money(d.amount - d.cost, d.currency)}</div>
      <Button size="sm" variant="outline" onClick={() => setEditing({ leadId, deal: d })}>
        <Pencil /> {t("common.edit")}
      </Button>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={t("finance.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <NativeSelect className="w-full sm:w-56" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="date">{t("finance.sortDate")}</option>
          <option value="profit">{t("finance.sortProfit")}</option>
          <option value="revenue">{t("finance.sortRevenue")}</option>
        </NativeSelect>
      </div>

      {rows.length === 0 ? (
        <Empty>{t("finance.empty")}</Empty>
      ) : (
        <>
          {/* телефон — карточки */}
          <ul className="divide-y md:hidden">
            {rows.map((l) => (
              <li key={l.id} className="px-3 py-3">
                <button type="button" className="flex w-full items-start gap-2 text-left cursor-pointer" onClick={() => toggle(l.id)}>
                  {open.has(l.id) ? <ChevronDown className="mt-0.5 size-4 shrink-0" /> : <ChevronRight className="mt-0.5 size-4 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{l.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{[formatDate(l.lastPaidAt), l.manager, sourceLabel(t, l.source)].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("font-semibold", profitCls(l.profit))}>{money(l.profit)}</div>
                    <div className="text-xs text-muted-foreground">{money(l.revenue)}</div>
                  </div>
                </button>
                {open.has(l.id) && (
                  <div className="mt-2 rounded-lg border bg-muted/40 px-3 py-1">
                    {l.deals.map((d) => dealLine(l.id, d))}
                    <Link href={`/leads/${l.id}`} className="block py-1.5 text-xs text-primary hover:underline">
                      {prettyPhone(l.phone)} · {t("common.open")}
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* компьютер — таблица */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="h-10 w-8 px-2" />
                  <th className="px-2 text-left font-medium">{t("finance.lead")}</th>
                  <th className="px-2 text-left font-medium">{t("finance.lastPaid")}</th>
                  <th className="px-2 text-left font-medium">{t("finance.manager")}</th>
                  <th className="px-2 text-left font-medium">{t("finance.source")}</th>
                  <th className="hidden px-2 text-right font-medium 2xl:table-cell">{t("finance.deals")}</th>
                  <th className="px-2 text-right font-medium">{t("finance.revenue")}</th>
                  <th className="px-2 text-right font-medium">{t("finance.cost")}</th>
                  <th className="px-2 text-right font-medium">{t("finance.profit")}</th>
                  <th className="px-2 text-right font-medium">{t("finance.margin")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <Fragment key={l.id}>
                    <tr className="cursor-pointer border-b hover:bg-slate-50/70" onClick={() => toggle(l.id)}>
                      <td className="px-2 py-2.5 text-muted-foreground">{open.has(l.id) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                      <td className="px-2 py-2.5">
                        <Link href={`/leads/${l.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">
                          {l.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{prettyPhone(l.phone)}</div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground">{formatDate(l.lastPaidAt)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5">{l.manager ?? <span className="text-muted-foreground">{t("common.notAssigned")}</span>}</td>
                      <td className="max-w-48 px-2 py-2.5 text-muted-foreground">
                        <div className="whitespace-nowrap">{sourceLabel(t, l.source)}</div>
                        {l.campaign && (
                          <div className="truncate text-xs" title={l.campaign}>
                            {l.campaign}
                          </div>
                        )}
                      </td>
                      <td className="hidden px-2 py-2.5 text-right tabular-nums 2xl:table-cell">{l.deals.length}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{money(l.revenue)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-muted-foreground">{money(l.cost)}</td>
                      <td className={cn("whitespace-nowrap px-2 py-2.5 text-right font-semibold tabular-nums", profitCls(l.profit))}>{money(l.profit)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-muted-foreground">{l.margin === null ? "—" : formatPercent(l.margin)}</td>
                    </tr>
                    {open.has(l.id) && (
                      <tr className="border-b bg-muted/30">
                        <td />
                        <td colSpan={9} className="px-2 py-1">
                          {l.deals.map((d) => dealLine(l.id, d))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                <tr className="border-t-2 bg-slate-50 font-semibold">
                  <td />
                  <td className="px-2 py-2.5" colSpan={4}>
                    {t("finance.total")}
                  </td>
                  <td className="hidden px-2 py-2.5 text-right tabular-nums 2xl:table-cell">{rows.reduce((s, r) => s + r.deals.length, 0)}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{money(tot("revenue"))}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{money(tot("cost"))}</td>
                  <td className={cn("whitespace-nowrap px-2 py-2.5 text-right tabular-nums", profitCls(tot("profit")))}>{money(tot("profit"))}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{tot("revenue") > 0 ? formatPercent(tot("profit") / tot("revenue")) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <DealDialog
          open
          onOpenChange={(v) => !v && setEditing(null)}
          leadId={editing.leadId}
          rate={rate}
          onSaved={() => router.refresh()}
          deal={{
            id: editing.deal.id,
            amount: String(editing.deal.amount),
            cost: String(editing.deal.cost),
            currency: editing.deal.currency,
            paidAt: toInputDate(new Date(editing.deal.paidAt)),
            product: editing.deal.product,
          }}
        />
      )}
    </div>
  );
}

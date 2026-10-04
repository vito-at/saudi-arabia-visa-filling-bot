"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { useRates } from "@/components/layout/role-context";
import { dealProfitInSale } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { deleteDealAction, setDealCostAction } from "@/app/(app)/deals/actions";
import type { PendingDeal } from "@/lib/finance";

const OPEN_KEY = "pending-costs-open";

/** Очередь администратора: сделки, закрытые менеджерами, — указать себестоимость. Сворачивается; состояние запоминается. */
export function PendingCosts({ deals }: { deals: PendingDeal[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === "0") setOpen(false);
    } catch {}
  }, []);
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, open ? "0" : "1");
    } catch {}
  };
  if (!deals.length) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-amber-800 cursor-pointer">
        <AlertTriangle className="size-4 shrink-0" />
        <span className="flex-1">{t("finance.pendingTitle", { n: deals.length })}</span>
        <span className="text-xs font-normal text-amber-800/80">{open ? t("finance.pendingHide") : t("finance.pendingShow")}</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3">
          <p className="mb-2 text-xs text-amber-800/80">{t("finance.pendingHint")}</p>
          <div className="overflow-hidden rounded-lg border border-amber-200 bg-card">
            {/* подписи колонок — один раз, а не в каждой строке */}
            <div className="hidden grid-cols-[minmax(0,1fr)_8.5rem_7.5rem_5rem_7rem_4rem] items-center gap-2 border-b border-amber-200 px-3 py-1.5 text-xs text-muted-foreground md:grid">
              <span>{t("finance.lead")}</span>
              <span className="text-right">{t("finance.revenue")}</span>
              <span>{t("finance.cost")}</span>
              <span>{t("finance.currency")}</span>
              <span className="text-right">{t("finance.profit")}</span>
              <span />
            </div>
            <ul className="divide-y divide-amber-200">
              {deals.map((d) => (
                <PendingRow key={d.id} deal={d} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingRow({ deal }: { deal: PendingDeal }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [cost, setCost] = useState("");
  const [costCurrency, setCostCurrency] = useState(deal.currency);
  const [pending, start] = useTransition();
  const rates = useRates();
  const amount = deal.amount;
  const parsed = Number(cost.replace(/\s/g, "").replace(",", "."));
  const valid = cost.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  // прибыль в валюте продажи; себестоимость в другой валюте — по текущему курсу, при котором она больше
  const profit = valid && (costCurrency === deal.currency || rates.sale > 0) ? dealProfitInSale({ amount, cost: parsed, currency: deal.currency, costCurrency }, rates) : null;

  const save = () => {
    if (!valid) return;
    start(async () => {
      const res = await setDealCostAction(deal.id, cost, costCurrency);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("finance.costSaved"));
      router.refresh();
    });
  };

  return (
    <li>
      <form
        className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-x-2 gap-y-1.5 px-3 py-2 text-sm md:grid-cols-[minmax(0,1fr)_8.5rem_7.5rem_5rem_7rem_4rem]"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="col-span-2 min-w-0 md:col-span-1">
          <Link href={`/leads/${deal.leadId}`} className="font-medium hover:underline">
            {deal.leadName}
          </Link>
          <div className="truncate text-xs text-muted-foreground" title={deal.product}>
            {[deal.product, formatDate(deal.paidAt), deal.manager && t("finance.closedBy", { name: deal.manager })].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="whitespace-nowrap text-right font-semibold tabular-nums">{f.money(amount, deal.currency)}</div>
        <Input className="h-8" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" aria-label={t("finance.cost")} />
        <NativeSelect className="h-8" value={costCurrency} onChange={(e) => setCostCurrency(e.target.value as "UZS" | "USD")} aria-label={t("deal.costCurrency")}>
          <option value="USD">USD</option>
          <option value="UZS">UZS</option>
        </NativeSelect>
        {/* на телефоне прибыль — отдельной строкой и только когда себестоимость введена */}
        <div className={cn("col-span-3 text-xs font-medium tabular-nums md:order-none md:col-span-1 md:block md:text-right", profit === null ? "hidden text-muted-foreground" : profit < 0 ? "order-last text-red-600" : "order-last text-emerald-700")}>
          <span className="md:hidden">{t("finance.profit")}: </span>
          {profit === null ? "—" : f.money(profit, deal.currency)}
        </div>
        <div className="flex justify-end gap-0.5">
          <Button type="submit" size="icon-sm" title={t("common.save")} aria-label={t("common.save")} disabled={!valid || pending}>
            <Check />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title={t("common.delete")}
            aria-label={t("common.delete")}
            disabled={pending}
            onClick={() => {
              if (!confirm(t("finance.dealDeleteConfirm", { name: deal.product }))) return;
              start(async () => {
                const res = await deleteDealAction(deal.id);
                if (!res.ok) return void toast.error(res.error);
                toast.success(t("finance.dealDeleted"));
                router.refresh();
              });
            }}
          >
            <Trash2 className="text-red-600" />
          </Button>
        </div>
      </form>
    </li>
  );
}

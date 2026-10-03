"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { useRates } from "@/components/layout/role-context";
import { dealProfitInSale } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import { deleteDealAction, setDealCostAction } from "@/app/(app)/deals/actions";
import type { PendingDeal } from "@/lib/finance";

/** Очередь администратора: сделки, закрытые менеджерами, — указать себестоимость */
export function PendingCosts({ deals }: { deals: PendingDeal[] }) {
  const { t } = useI18n();
  if (!deals.length) return null;
  return (
    <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
        <AlertTriangle className="size-4" /> {t("finance.pendingTitle", { n: deals.length })}
      </div>
      <p className="mt-1 text-xs text-amber-800/80">{t("finance.pendingHint")}</p>
      <ul className="mt-3 divide-y divide-amber-200 rounded-lg border border-amber-200 bg-card">
        {deals.map((d) => (
          <PendingRow key={d.id} deal={d} />
        ))}
      </ul>
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

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 text-sm">
      <div className="min-w-0 flex-1 basis-56">
        <Link href={`/leads/${deal.leadId}`} className="font-medium hover:underline">
          {deal.leadName}
        </Link>
        <div className="truncate text-xs text-muted-foreground">
          {[deal.product, formatDate(deal.paidAt), deal.manager && t("finance.closedBy", { name: deal.manager })].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-muted-foreground">{t("finance.revenue")}</div>
        <div className="font-semibold tabular-nums">{f.money(amount, deal.currency)}</div>
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          start(async () => {
            const res = await setDealCostAction(deal.id, cost, costCurrency);
            if (!res.ok) return void toast.error(res.error);
            toast.success(t("finance.costSaved"));
            router.refresh();
          });
        }}
      >
        <label className="block">
          <span className="text-xs text-muted-foreground">{t("finance.cost")}</span>
          <Input className="w-36" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" aria-label={t("finance.cost")} />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">{t("deal.costCurrency")}</span>
          <NativeSelect className="w-24" value={costCurrency} onChange={(e) => setCostCurrency(e.target.value as "UZS" | "USD")} aria-label={t("deal.costCurrency")}>
            <option value="USD">USD</option>
            <option value="UZS">UZS</option>
          </NativeSelect>
        </label>
        {profit !== null && (
          <div className="pb-2 text-xs text-muted-foreground">
            {t("finance.profit")}: <span className={profit < 0 ? "font-medium text-red-600" : "font-medium text-emerald-700"}>{f.money(profit, deal.currency)}</span>
          </div>
        )}
        <Button type="submit" size="sm" disabled={!valid || pending}>
          <Check /> {t("common.save")}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="mb-0.5"
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
      </form>
    </li>
  );
}

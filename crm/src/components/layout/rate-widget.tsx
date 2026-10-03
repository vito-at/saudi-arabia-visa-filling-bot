"use client";

import { useState } from "react";
import { Copy, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/format";
import { useI18n } from "@/i18n/client";

/**
 * Курс доллара для всех сотрудников: менеджер считает цену в сумах для клиента.
 * Берём курс покупки $ (дорогой) — так агентство не теряет на обмене.
 */
export function RateWidget({ rate, updatedAt }: { rate: number; updatedAt: string | null }) {
  const { t, f } = useI18n();
  const [usd, setUsd] = useState("");
  if (!rate) return null;
  const amount = Number(usd.replace(/\s/g, "").replace(",", "."));
  const sum = Number.isFinite(amount) && amount > 0 ? Math.round(amount * rate) : null;
  return (
    <div className="rounded-lg border border-sidebar-border px-3 py-2.5" title={t("nav.rateHint", { date: updatedAt ? formatDate(updatedAt) : "—" })}>
      <div className="flex items-center gap-1 text-xs text-sidebar-muted">
        <DollarSign className="size-3.5 shrink-0" /> <span className="truncate">{t("nav.rateTitle")}</span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="whitespace-nowrap text-sm font-semibold text-foreground tabular-nums">
          1 $ = {formatNumber(rate)} {f.sum}
        </span>
        {updatedAt && <span className="text-[11px] text-sidebar-muted">{formatDate(updatedAt).slice(0, 5)}</span>}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={usd}
          onChange={(e) => setUsd(e.target.value)}
          inputMode="decimal"
          placeholder={t("nav.rateUsd")}
          aria-label={t("nav.rateUsd")}
          className="h-8 w-full min-w-0 rounded-md border border-sidebar-border bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-sidebar-muted focus:border-brand"
        />
      </div>
      {sum !== null && (
        <button
          type="button"
          title={t("nav.rateCopy")}
          className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-md bg-sidebar-hover px-2 py-1 text-left text-sm font-medium text-foreground tabular-nums cursor-pointer"
          onClick={() => {
            void navigator.clipboard?.writeText(formatNumber(sum)).then(() => toast.success(t("nav.rateCopied")));
          }}
        >
          <span>
            = {formatNumber(sum)} {f.sum}
          </span>
          <Copy className="size-3.5 shrink-0 text-sidebar-muted" />
        </button>
      )}
    </div>
  );
}

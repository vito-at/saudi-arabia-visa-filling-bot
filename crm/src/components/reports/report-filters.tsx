"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { PeriodRange } from "@/components/common/period-range";
import type { PeriodKey } from "@/lib/period";
import type { TKey } from "@/i18n/core";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

const PERIODS: PeriodKey[] = ["today", "7d", "30d", "month", "year", "custom"];

export function ReportFilters({ managers, exportHref, defaultPeriod = "30d" }: { managers: { id: string; name: string }[] | null; exportHref?: string; defaultPeriod?: PeriodKey }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const period = (params.get("period") ?? defaultPeriod) as PeriodKey;
  const cur = params.get("cur") === "UZS" ? "UZS" : "USD";
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`);
  };
  const exportUrl = exportHref ? `${exportHref}${exportHref.includes("?") ? "&" : "?"}${params.toString()}` : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* период — одна кнопка со списком (на телефоне открывается системный список) */}
      <label className="relative w-[calc(50%-0.25rem)] sm:w-44">
        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <NativeSelect
          className="pl-8"
          aria-label={t("period.label")}
          value={PERIODS.includes(period) ? period : defaultPeriod}
          onChange={(e) => {
            const p = e.target.value as PeriodKey;
            set({ period: p, ...(p !== "custom" ? { from: null, to: null } : {}) });
          }}
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {t(`period.${p}` as TKey)}
            </option>
          ))}
        </NativeSelect>
      </label>
      {period === "custom" && <PeriodRange from={params.get("from") ?? ""} to={params.get("to") ?? ""} onApply={(from, to) => set({ period: "custom", from, to })} />}
      {managers && (
        <NativeSelect className="w-[calc(50%-0.25rem)] sm:w-52" value={params.get("manager") ?? ""} onChange={(e) => set({ manager: e.target.value })}>
          <option value="">{t("common.allManagers")}</option>
          <option value="none">{t("common.notAssignedOption")}</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
      )}
      <div className="flex rounded-lg bg-slate-200/60 p-1 text-sm">
        {(["USD", "UZS"] as const).map((c) => (
          <button key={c} onClick={() => set({ cur: c })} className={cn("rounded-md px-3 py-1 cursor-pointer", cur === c ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}>
            {c}
          </button>
        ))}
      </div>
      {exportUrl && (
        <Button variant="outline" size="sm" asChild className="ml-auto">
          <a href={exportUrl}>
            <Download /> Excel
          </a>
        </Button>
      )}
    </div>
  );
}

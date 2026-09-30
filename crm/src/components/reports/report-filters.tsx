"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { PERIOD_LABELS, type PeriodKey } from "@/lib/period";
import { cn } from "@/lib/utils";

const PERIODS: PeriodKey[] = ["today", "7d", "30d", "month", "prev_month", "quarter", "year", "custom"];

export function ReportFilters({ managers, exportHref, defaultPeriod = "30d" }: { managers: { id: string; name: string }[] | null; exportHref?: string; defaultPeriod?: PeriodKey }) {
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
      <div className="flex rounded-lg bg-slate-200/60 p-1 text-sm">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => set({ period: p, ...(p !== "custom" ? { from: null, to: null } : {}) })}
            className={cn("rounded-md px-2.5 py-1 cursor-pointer whitespace-nowrap", period === p ? "bg-card font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <>
          <Input type="date" className="w-40" value={params.get("from") ?? ""} onChange={(e) => set({ from: e.target.value })} aria-label="С даты" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" className="w-40" value={params.get("to") ?? ""} onChange={(e) => set({ to: e.target.value })} aria-label="По дату" />
        </>
      )}
      {managers && (
        <NativeSelect className="w-52" value={params.get("manager") ?? ""} onChange={(e) => set({ manager: e.target.value })}>
          <option value="">Все менеджеры</option>
          <option value="none">— Не назначен —</option>
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

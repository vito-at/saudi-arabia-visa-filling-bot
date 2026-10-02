import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";

/** Плитка показателя: значение + изменение к прошлому периоду (стрелка и знак — не только цвет) */
export async function KpiTile({ label, value, delta, prev }: { label: string; value: string; delta: number | null; prev: string }) {
  const { t } = await getI18n();
  const up = delta !== null && delta > 0.0005;
  const down = delta !== null && delta < -0.0005;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <Card className="min-w-0 p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 whitespace-nowrap text-xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1 text-xs">
        <span className={cn("inline-flex items-center gap-0.5 font-medium", up && "text-emerald-700", down && "text-red-600", !up && !down && "text-muted-foreground")}>
          {delta !== null && <Icon className="size-3.5" />}
          {delta === null ? "" : `${delta > 0 ? "+" : ""}${formatPercent(delta)}`}
        </span>
        {/* «нет данных для сравнения» переносится на узкой плитке, «было …» держим в одну строку */}
        <span className={cn("min-w-0 text-muted-foreground", delta !== null && "whitespace-nowrap")}>{delta === null ? t("dashboard.noCompare") : t("dashboard.was", { v: prev })}</span>
      </div>
    </Card>
  );
}

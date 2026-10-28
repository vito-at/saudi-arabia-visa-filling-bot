import type { VisaKind } from "@prisma/client";
import { cn } from "@/lib/utils";

const COLORS: Record<VisaKind, string> = {
  EVISA: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  STICKER: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  ON_ARRIVAL: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  VISA_FREE: "bg-muted text-muted-foreground",
};

/** Вид визы цветной меткой: e-виза, стикер, по прилёту, без визы */
export function KindBadge({ kind, label, className }: { kind: VisaKind; label: string; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", COLORS[kind], className)}>{label}</span>;
}

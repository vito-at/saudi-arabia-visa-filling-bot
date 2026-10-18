"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/core";

export const VISA_STATUS_STYLE: Record<string, string> = {
  NEW: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  IN_PROGRESS: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  PAID_WAITING: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  DOCS_REQUESTED: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function VisaStatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", VISA_STATUS_STYLE[status], className)}>{t(`visa.status.${status}` as TKey)}</span>;
}

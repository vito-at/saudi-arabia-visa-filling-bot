"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setShiftAction } from "@/app/(app)/shift-actions";
import { useI18n } from "@/i18n/client";

/** «В работе / Не в работе» менеджера: при автораспределении лиды приходят только тем, кто в работе */
export function ShiftToggle({ on }: { on: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const res = await setShiftAction(!on);
      if (!res.ok) toast.error(res.error);
    });
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={toggle}
      title={t("nav.shiftHint")}
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60",
        on ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-sidebar-hover text-sidebar-muted",
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", on ? "bg-emerald-500" : "bg-sidebar-muted/60")} />
        {on ? t("nav.shiftOn") : t("nav.shiftOff")}
      </span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-sidebar-muted/40")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

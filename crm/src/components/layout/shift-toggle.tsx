"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setShiftAction, touchActivityAction } from "@/app/(app)/shift-actions";
import { useI18n } from "@/i18n/client";

/** Отмечать действие на сервере не чаще раза в минуту */
const TOUCH_EVERY_MS = 60_000;

/** «В работе / Не в работе» менеджера; activeSec — сколько он сегодня в работе */
export function ShiftToggle({ on, activeSec }: { on: boolean; activeSec: number }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const res = await setShiftAction(!on);
      if (!res.ok) toast.error(res.error);
    });
  const h = Math.floor(activeSec / 3600);
  const m = Math.floor((activeSec % 3600) / 60);
  return (
    <div className="space-y-1">
      <button
        type="button"
        role="switch"
        data-shift-control
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
      {activeSec > 0 && <div className="px-1 text-[11px] text-sidebar-muted">{t("nav.shiftToday", { h, m })}</div>}
    </div>
  );
}

/**
 * Следит за действиями менеджера (нажатия, ввод текста) и сообщает о них серверу: так «В работе» не выключается,
 * пока менеджер работает, и копится время работы за день. Если «В работе» выключилось само (час без действий) —
 * обновляет страницу и говорит об этом.
 */
export function ActivityTracker({ on }: { on: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const last = useRef(0);
  const state = useRef(on);
  useEffect(() => {
    state.current = on;
  }, [on]);
  useEffect(() => {
    const onAction = (e: Event) => {
      // сам переключатель отмечает действие на сервере; отдельная отметка могла бы прийти позже и спутать состояние
      if (e.target instanceof Element && e.target.closest("[data-shift-control]")) return;
      const now = Date.now();
      if (now - last.current < TOUCH_EVERY_MS) return;
      last.current = now;
      touchActivityAction()
        .then((onShift) => {
          if (onShift === null || onShift === state.current) return;
          if (state.current && !onShift) toast.warning(t("nav.shiftAutoOff"));
          state.current = onShift;
          router.refresh();
        })
        .catch(() => {
          last.current = 0;
        });
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", onAction, opts);
    window.addEventListener("keydown", onAction, opts);
    return () => {
      window.removeEventListener("pointerdown", onAction, opts);
      window.removeEventListener("keydown", onAction, opts);
    };
  }, [router, t]);
  return null;
}

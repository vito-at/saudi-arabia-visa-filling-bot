"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";

/**
 * Небольшое уведомление всем сотрудникам: курс USD за сегодня не обновился.
 * Показывается один раз в день каждому пользователю (закрытие запоминается в браузере).
 */
export function RateNotice({ day, rate, since, isAdmin }: { day: string; rate: string; since: string | null; isAdmin: boolean }) {
  const { t, f } = useI18n();
  useEffect(() => {
    const key = `rate-notice-${day}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      /* localStorage недоступен — просто покажем уведомление */
    }
    const remember = () => {
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* ничего страшного */
      }
    };
    // постоянный id: повторный вызов не создаёт дубликат
    toast.warning(t("rateNotice.title"), {
      id: key,
      description: `${t("rateNotice.text", { rate, sum: f.sum, since: since ?? t("common.unknownDate") })}${isAdmin ? ` ${t("rateNotice.adminHint")}` : ""}`,
      duration: Infinity,
      action: isAdmin ? { label: t("nav.settings"), onClick: () => (remember(), (window.location.href = "/settings?tab=general")) } : { label: t("common.gotIt"), onClick: remember },
      // закрытие крестиком — «прочитано» до завтра
      onDismiss: remember,
    });
  }, [day, rate, since, isAdmin, t, f.sum]);
  return null;
}

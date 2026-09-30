"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Небольшое уведомление всем сотрудникам: курс USD за сегодня не обновился.
 * Показывается один раз в день каждому пользователю (закрытие запоминается в браузере).
 */
export function RateNotice({ day, rate, since, isAdmin }: { day: string; rate: string; since: string; isAdmin: boolean }) {
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
    toast.warning("Курс доллара сегодня не обновился", {
      id: key,
      description: `Используется курс ${rate} сум от ${since}.${isAdmin ? " Можно ввести курс вручную в настройках." : ""}`,
      duration: Infinity,
      action: isAdmin ? { label: "Настройки", onClick: () => (remember(), (window.location.href = "/settings?tab=general")) } : { label: "Понятно", onClick: remember },
      // закрытие крестиком — «прочитано» до завтра
      onDismiss: remember,
    });
  }, [day, rate, since, isAdmin]);
  return null;
}

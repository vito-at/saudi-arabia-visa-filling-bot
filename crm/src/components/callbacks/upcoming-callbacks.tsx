"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, PhoneCall } from "lucide-react";
import { callbackState } from "@/lib/callback";
import type { CallbackItem } from "@/lib/callbacks-data";
import { CallbackCard } from "./callback-list";
import { useNow } from "./use-now";
import { useI18n } from "@/i18n/client";

const MOBILE_VISIBLE = 2;

/** Блок над таблицей лидов: звонки, до которых осталось 10 минут и меньше */
export function UpcomingCallbacks({ items }: { items: CallbackItem[] }) {
  const { t } = useI18n();
  const now = useNow(15_000);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  // раз в минуту подтягиваем свежие данные (новые назначенные звонки, смена статусов)
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  const visible = items.filter((i) => callbackState(i.callbackAt, now).remind);
  if (!visible.length) return null;
  return (
    <div className="mb-4 rounded-xl border border-brand/40 bg-accent p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <PhoneCall className="size-4" /> {t("callback.soonTitle", { n: visible.length })}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((i, idx) => (
          // на телефоне сначала показываем только два звонка, остальные — по кнопке
          <div key={i.id} className={idx >= MOBILE_VISIBLE && !expanded ? "hidden sm:block" : undefined}>
            <CallbackCard item={i} now={now} onChanged={() => router.refresh()} />
          </div>
        ))}
      </div>
      {visible.length > MOBILE_VISIBLE && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-3 flex w-full items-center justify-center gap-1 text-sm font-medium text-primary sm:hidden cursor-pointer">
          {expanded ? (
            <>
              <ChevronUp className="size-4" /> {t("callback.collapse")}
            </>
          ) : (
            <>
              <ChevronDown className="size-4" /> {t("callback.showAll", { n: visible.length })}
            </>
          )}
        </button>
      )}
    </div>
  );
}

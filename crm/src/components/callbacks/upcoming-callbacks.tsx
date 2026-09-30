"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { callbackState } from "@/lib/callback";
import type { CallbackItem } from "@/lib/callbacks-data";
import { CallbackCard } from "./callback-list";
import { useNow } from "./use-now";
import { useI18n } from "@/i18n/client";

/** Блок над таблицей лидов: звонки, до которых осталось 10 минут и меньше */
export function UpcomingCallbacks({ items }: { items: CallbackItem[] }) {
  const { t } = useI18n();
  const now = useNow(15_000);
  const router = useRouter();
  // раз в минуту подтягиваем свежие данные (новые назначенные звонки, смена статусов)
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  const visible = items.filter((i) => callbackState(i.callbackAt, now).remind);
  if (!visible.length) return null;
  return (
    <div className="mb-4 rounded-xl border border-brand/40 bg-accent p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <PhoneCall className="size-4" /> {t("callback.soonTitle", { n: visible.length })}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {visible.map((i) => (
          <CallbackCard key={i.id} item={i} now={now} onChanged={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}

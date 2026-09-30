"use client";

import Link from "next/link";
import { useTransition } from "react";
import { AlarmClockPlus, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { callbackLabel, callbackState } from "@/lib/callback";
import type { CallbackItem } from "@/lib/callbacks-data";
import { formatTime } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { snoozeCallbackAction } from "@/app/(app)/leads/actions";
import { useI18n } from "@/i18n/client";

/** Карточка напоминания: имя, телефон, отсчёт и действия */
export function CallbackCard({ item, now, onChanged, compact }: { item: CallbackItem; now: number; onChanged?: () => void; compact?: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const s = callbackState(item.callbackAt, now);
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm", s.due && "border-brand ring-2 ring-brand/30")}>
      <div className={cn("flex size-10 shrink-0 flex-col items-center justify-center rounded-lg text-white", s.due ? "animate-pulse bg-brand" : "bg-primary/80")}>
        {s.due ? <Phone className="size-5" /> : <span className="text-sm font-bold leading-none">{s.minutesLeft}</span>}
        {!s.due && <span className="text-[9px] leading-none">{t("common.minutesShort")}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-xs font-semibold", s.due ? "text-primary" : "text-muted-foreground")}>
          {s.due ? t("callback.dueExcl") : t("callback.callIn", { when: callbackLabel(s, t) })} · {formatTime(item.callbackAt)}
        </div>
        <Link href={`/leads/${item.id}`} className="block truncate text-sm font-medium hover:underline">
          {item.name}
        </Link>
        {item.phone && (
          <a href={`tel:${item.phone}`} className="block whitespace-nowrap text-xs text-primary hover:underline">
            {prettyPhone(item.phone)}
          </a>
        )}
        {!compact && item.manager && <div className="truncate text-xs text-muted-foreground">{item.manager}</div>}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        title={t("callback.snoozeTitle")}
        onClick={() =>
          start(async () => {
            const res = await snoozeCallbackAction(item.id, 10);
            if (!res.ok) toast.error(res.error);
            else toast.success(t("callback.snoozed", { name: item.name }));
            onChanged?.();
          })
        }
      >
        <AlarmClockPlus /> {t("callback.snooze")}
      </Button>
    </div>
  );
}

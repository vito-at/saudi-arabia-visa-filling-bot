"use client";

import { PhoneCall } from "lucide-react";
import { callbackLabel, callbackState } from "@/lib/callback";
import { formatDateTime, formatTime, toInputDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNow } from "./use-now";

/** Время повторного звонка; за 10 минут превращается в обратный отсчёт */
export function CallbackBadge({ at, className }: { at: string; className?: string }) {
  const now = useNow();
  const s = callbackState(at, now);
  const sameDay = toInputDate(at) === toInputDate(now);
  if (!s.remind) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)} title={`Перезвонить ${formatDateTime(at)}`}>
        <PhoneCall className="size-3" /> {sameDay ? `сегодня ${formatTime(at)}` : formatDateTime(at)}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        s.due ? "animate-pulse bg-brand text-white" : "bg-accent text-primary",
        className,
      )}
      title={`Перезвонить ${formatDateTime(at)}`}
    >
      <PhoneCall className="size-3" /> {callbackLabel(s)}
    </span>
  );
}

import type { ChatChannel } from "@prisma/client";
import { cn } from "@/lib/utils";

/** Логотипы мессенджеров (в наборе иконок lucide фирменных знаков нет) */
export function ChannelIcon({ channel, className }: { channel: ChatChannel; className?: string }) {
  if (channel === "INSTAGRAM")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("size-4 text-pink-600", className)}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn("size-4 text-sky-500", className)}>
      <path d="M21.4 4.3 2.9 11.5c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.8-1.4-1.6Zm-3.3 3.4-8.8 7.9-.4 3.6-1.5-4.8 10.3-6.5c.5-.3.9-.1.4.3Z" />
    </svg>
  );
}

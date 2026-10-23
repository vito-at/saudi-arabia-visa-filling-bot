import type { ChatChannel } from "@prisma/client";
import { ChannelIcon } from "./channel-icon";
import { cn } from "@/lib/utils";

/** Цвета аватарок Telegram: у каждого собеседника свой, по его id */
const COLORS = [
  ["#ff885e", "#ff516a"],
  ["#ffcd6a", "#ffa85c"],
  ["#82b1ff", "#665fff"],
  ["#a0de7e", "#54cb68"],
  ["#53edd6", "#28c9b7"],
  ["#72d5fd", "#2a9ef1"],
  ["#e0a2f3", "#d669ed"],
];

function colorOf(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Инициалы: «Orient Travel | Abdulahad» → «OT» */
function initials(title: string) {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Круглая аватарка, как в Telegram: фото или инициалы на цветном градиенте; значок мессенджера в углу */
export function ChatAvatar({ id, title, url, channel, size = 54, ring = false }: { id: string; title: string; url: string | null; channel: ChatChannel; size?: number; ring?: boolean }) {
  const [a, b] = colorOf(id);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full rounded-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center rounded-full font-semibold text-white" style={{ background: `linear-gradient(180deg, ${a}, ${b})`, fontSize: Math.round(size * 0.36) }}>
          {initials(title)}
        </div>
      )}
      <span className={cn("absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full p-[3px]", ring ? "bg-white" : "bg-[var(--tg-list)]")}>
        <ChannelIcon channel={channel} className="size-3.5" />
      </span>
    </div>
  );
}

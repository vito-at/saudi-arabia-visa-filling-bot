import Link from "next/link";
import { ArrowLeft, ExternalLink, MessageCircle } from "lucide-react";
import type { ChatChannel, Prisma } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { AiToggle, ChatAutoRefresh, ChatComposer, ChatMessages } from "@/components/chats/chat-thread";
import { getAiSettings } from "@/lib/chats/ai";
import { ChannelIcon } from "@/components/chats/channel-icon";
import { prisma } from "@/lib/db";
import { conversationScope } from "@/lib/access";
import { igCanReply } from "@/lib/chats/instagram";
import { toMessageView } from "@/lib/chats/view";
import { formatDate, formatTime, toInputDate } from "@/lib/format";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { statusName } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";

const CHANNELS: ChatChannel[] = ["INSTAGRAM", "TELEGRAM"];

function Avatar({ title, url, channel }: { title: string; url: string | null; channel: ChatChannel }) {
  return (
    <div className="relative shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-10 rounded-full object-cover" />
      ) : (
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">{title.slice(0, 1).toUpperCase()}</div>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
        <ChannelIcon channel={channel} className="size-3" />
      </span>
    </div>
  );
}

/** «Чаты»: переписки Instagram Direct и Telegram — список слева, открытый чат справа (на телефоне — по очереди) */
export default async function ChatsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { t } = await getI18n();
  const channel = CHANNELS.find((c) => c === sp(params, "ch")) ?? null;
  const q = sp(params, "q")?.trim();
  const selectedId = sp(params, "c");

  const where: Prisma.ConversationWhereInput = {
    ...conversationScope(user),
    ...(channel ? { channel } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }, { lead: { phone: { contains: q.replace(/\D/g, "") || q } } }] } : {}),
  };
  const [list, selected, ai] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: 200,
      include: { lead: { select: { id: true, manager: { select: { name: true } } } } },
    }),
    selectedId
      ? prisma.conversation.findFirst({
          where: { id: selectedId, ...conversationScope(user) },
          include: {
            lead: { select: { id: true, name: true, phone: true, status: true, manager: { select: { name: true } } } },
            messages: { orderBy: { createdAt: "desc" }, take: 300, include: { sender: { select: { name: true } } } },
          },
        })
      : null,
    getAiSettings(),
  ]);
  const aiOn = ai.enabled && !!ai.apiKeyEnc;

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ch: channel, q: q ?? null, c: selectedId ?? null, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/chats?${s}` : "/chats";
  };
  const today = toInputDate(new Date());
  const when = (d: Date) => (toInputDate(d) === today ? formatTime(d) : formatDate(d).slice(0, 5));
  const igClosed = selected?.channel === "INSTAGRAM" && !igCanReply(selected.lastInboundAt);

  return (
    <div className="-mx-3 -my-4 sm:-mx-4 lg:-mx-8 lg:-my-6">
      <ChatAutoRefresh />
      <Card className="flex h-[calc(100dvh-3.5rem)] overflow-hidden rounded-none border-0 lg:h-dvh">
        {/* список переписок */}
        <aside className={cn("flex w-full flex-col border-r lg:w-[340px] lg:shrink-0", selected && "hidden lg:flex")}>
          <div className="space-y-2 border-b p-3">
            <h1 className="text-lg font-semibold">{t("chats.title")}</h1>
            <form action="/chats" className="flex gap-2">
              {channel && <input type="hidden" name="ch" value={channel} />}
              <input name="q" defaultValue={q} placeholder={t("chats.search")} className="h-9 w-full rounded-md border bg-card px-3 text-sm" />
            </form>
            <div className="flex gap-1 text-sm">
              {[null, ...CHANNELS].map((c) => (
                <Link key={c ?? "all"} href={href({ ch: c, c: null })} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1", channel === c ? "bg-primary text-white" : "hover:bg-accent")}>
                  {c && <ChannelIcon channel={c} className={cn("size-3.5", channel === c && "text-white")} />}
                  {c ? t(c === "INSTAGRAM" ? "chats.channelIg" : "chats.channelTg") : t("chats.all")}
                </Link>
              ))}
            </div>
          </div>
          <ul className="flex-1 divide-y overflow-y-auto">
            {list.map((c) => (
              <li key={c.id}>
                <Link href={href({ c: c.id })} className={cn("flex gap-3 px-3 py-2.5 hover:bg-accent", c.id === selectedId && "bg-accent")}>
                  <Avatar title={c.title} url={c.avatarUrl} channel={c.channel} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={cn("flex-1 truncate text-sm", c.unreadCount > 0 ? "font-semibold" : "font-medium")}>{c.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{when(c.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-xs text-muted-foreground">{c.lastMessageText || "—"}</span>
                      {c.unreadCount > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">{c.unreadCount}</span>}
                    </div>
                    {user.role === "ADMIN" && <div className="truncate text-[11px] text-muted-foreground">{c.lead?.manager?.name ?? t("common.notAssigned")}</div>}
                  </div>
                </Link>
              </li>
            ))}
            {!list.length && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                <MessageCircle className="mx-auto mb-2 size-6" />
                {t("chats.empty")}
              </li>
            )}
          </ul>
        </aside>

        {/* открытый чат */}
        <section className={cn("min-w-0 flex-1 flex-col bg-muted/30", selected ? "flex" : "hidden lg:flex")}>
          {selected ? (
            <>
              <header className="flex items-center gap-3 border-b bg-card px-3 py-2.5">
                <Link href={href({ c: null })} className="rounded-md p-1 text-muted-foreground hover:bg-accent lg:hidden" aria-label={t("common.back")}>
                  <ArrowLeft className="size-5" />
                </Link>
                <Avatar title={selected.title} url={selected.avatarUrl} channel={selected.channel} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{selected.lead?.name ?? selected.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[selected.username ? `@${selected.username}` : null, selected.lead?.phone, selected.lead?.manager?.name].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {aiOn && ai.channels.includes(selected.channel) && <AiToggle conversationId={selected.id} paused={selected.aiPaused} />}
                {selected.lead && (
                  <>
                    <StatusBadge name={statusName(t, selected.lead.status.name)} color={selected.lead.status.color} className="hidden sm:inline-flex" />
                    <Link href={`/leads/${selected.lead.id}`} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-accent">
                      <ExternalLink className="size-3.5" /> {t("chats.openLead")}
                    </Link>
                  </>
                )}
              </header>
              <ChatMessages conversationId={selected.id} unread={selected.unreadCount} messages={[...selected.messages].reverse().map(toMessageView)} />
              <ChatComposer conversationId={selected.id} blockedReason={igClosed ? t("chats.igWindow") : null} />
            </>
          ) : (
            <div className="m-auto text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 size-8" />
              {t("chats.pick")}
            </div>
          )}
        </section>
      </Card>
    </div>
  );
}

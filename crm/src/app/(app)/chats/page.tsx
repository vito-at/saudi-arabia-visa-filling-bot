import Link from "next/link";
import { ArrowLeft, CheckCheck, ExternalLink, Search, Send } from "lucide-react";
import type { ChatChannel, Prisma } from "@prisma/client";
import { StatusBadge } from "@/components/ui/badge";
import { AiToggle, ChatAutoRefresh, ChatComposer, ChatMessages } from "@/components/chats/chat-thread";
import { ChatAvatar } from "@/components/chats/chat-avatar";
import { getAiSettings } from "@/lib/chats/ai";
import { getChatTemplates } from "@/lib/refs";
import { prisma } from "@/lib/db";
import { canWriteConversation, conversationScope, inboxScope } from "@/lib/access";
import { igCanReply } from "@/lib/chats/instagram";
import { toMessageView } from "@/lib/chats/view";
import { formatDate, formatTime, toInputDate } from "@/lib/format";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { statusName } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";

const CHANNELS: ChatChannel[] = ["INSTAGRAM", "TELEGRAM"];

/** Превью последнего сообщения: «Вы: …» хранится в базе по-русски — показываем галочки, как в Telegram */
function preview(text: string | null): { out: boolean; text: string } {
  if (!text) return { out: false, text: "" };
  if (text.startsWith("Вы: ")) return { out: true, text: text.slice(4) };
  if (text.startsWith("🤖 ")) return { out: true, text };
  return { out: false, text };
}

/**
 * «Чаты» в стиле Telegram: папки и список переписок слева, открытый чат справа (на телефоне — по очереди).
 * Instagram Direct, сам бот и личный Telegram сотрудника; администратор может открыть переписки сотрудников (только чтение).
 */
export default async function ChatsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { t } = await getI18n();
  const isAdmin = user.role === "ADMIN";
  const channel = CHANNELS.find((c) => c === sp(params, "ch")) ?? null;
  const q = sp(params, "q")?.trim();
  const selectedId = sp(params, "c");
  // администратор: чьи переписки показать — свои (по умолчанию) или личного Telegram сотрудника
  const staffId = isAdmin ? (sp(params, "u") ?? null) : null;

  const scope: Prisma.ConversationWhereInput = staffId ? { AND: [conversationScope(user), { account: { userId: staffId } }] } : inboxScope(user);
  const where: Prisma.ConversationWhereInput = {
    AND: [
      scope,
      channel ? { channel } : {},
      q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }, { lead: { phone: { contains: q.replace(/\D/g, "") || q } } }] } : {},
    ],
  };
  const [list, selected, ai, templates, unreadByChannel, staff] = await Promise.all([
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
            account: { select: { userId: true, user: { select: { name: true } } } },
            messages: { orderBy: { createdAt: "desc" }, take: 300, include: { sender: { select: { name: true } } } },
          },
        })
      : null,
    getAiSettings(),
    getChatTemplates(),
    prisma.conversation.groupBy({ by: ["channel"], where: { AND: [scope, { unreadCount: { gt: 0 } }] }, _count: { _all: true } }),
    // сотрудники с подключённым личным Telegram — для контроля их переписок
    isAdmin
      ? prisma.telegramAccount.findMany({ where: { user: { role: { not: "ADMIN" } } }, select: { userId: true, user: { select: { name: true, isActive: true } } }, orderBy: { user: { name: "asc" } } })
      : Promise.resolve([]),
  ]);
  const aiOn = ai.enabled && !!ai.apiKeyEnc;
  const unread = (c: ChatChannel | null) => unreadByChannel.filter((r) => !c || r.channel === c).reduce((s, r) => s + r._count._all, 0);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ch: channel, q: q ?? null, u: staffId, c: selectedId ?? null, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/chats?${s}` : "/chats";
  };
  const today = toInputDate(new Date());
  const when = (d: Date) => (toInputDate(d) === today ? formatTime(d) : formatDate(d).slice(0, 5));
  const igClosed = selected?.channel === "INSTAGRAM" && !igCanReply(selected.lastInboundAt);
  const readOnly = selected && !canWriteConversation(user, selected) ? t("chats.readOnly", { name: selected.account?.user.name ?? "" }) : null;

  return (
    <div className="-mx-3 -my-4 sm:-mx-4 lg:-mx-8 lg:-my-6">
      <ChatAutoRefresh />
      <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden lg:h-dvh">
        {/* список переписок */}
        <aside className={cn("flex w-full flex-col border-r lg:w-[380px] lg:shrink-0", selected && "hidden lg:flex")} style={{ background: "var(--tg-list)" }}>
          <div className="px-3 pt-3">
            <div className="flex items-center gap-2">
              <form action="/chats" className="relative flex-1">
                {channel && <input type="hidden" name="ch" value={channel} />}
                {staffId && <input type="hidden" name="u" value={staffId} />}
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder={t("chats.search")}
                  className="h-10 w-full rounded-full border border-transparent bg-muted pl-10 pr-4 text-[15px] outline-none focus:border-[var(--tg-accent)] focus:bg-transparent"
                />
              </form>
              <Link href="/chats/telegram" title={t("tgacc.title")} aria-label={t("tgacc.title")} className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-[var(--tg-accent)]">
                <Send className="size-5" />
              </Link>
            </div>
            {isAdmin && staff.length > 0 && (
              <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto text-[13px]">
                <Link href={href({ u: null, c: null })} className={cn("shrink-0 rounded-full px-3 py-1", !staffId ? "text-white" : "bg-muted hover:bg-accent")} style={!staffId ? { background: "var(--tg-accent)" } : undefined}>
                  {t("chats.mine")}
                </Link>
                {staff.map((s) => (
                  <Link key={s.userId} href={href({ u: s.userId, c: null })} className={cn("shrink-0 rounded-full px-3 py-1", staffId === s.userId ? "text-white" : "bg-muted hover:bg-accent")} style={staffId === s.userId ? { background: "var(--tg-accent)" } : undefined} title={t("chats.staffChats")}>
                    {s.user.name}
                    {!s.user.isActive && ` (${t("plans.inactive")})`}
                  </Link>
                ))}
              </div>
            )}
            {/* папки, как в Telegram */}
            <nav className="no-scrollbar mt-1 flex gap-1 overflow-x-auto border-b text-[15px]">
              {[null, ...CHANNELS].map((c) => {
                const active = channel === c;
                const n = unread(c);
                return (
                  <Link key={c ?? "all"} href={href({ ch: c, c: null })} className={cn("relative flex shrink-0 items-center gap-1.5 px-3 pb-2.5 pt-2 font-medium", active ? "text-[var(--tg-accent)]" : "text-muted-foreground hover:text-foreground")}>
                    {c ? t(c === "INSTAGRAM" ? "chats.channelIg" : "chats.channelTg") : t("chats.all")}
                    {n > 0 && (
                      <span className="min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 text-white" style={{ background: active ? "var(--tg-accent)" : "var(--tg-meta)" }}>
                        {n}
                      </span>
                    )}
                    {active && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full" style={{ background: "var(--tg-accent)" }} />}
                  </Link>
                );
              })}
            </nav>
          </div>
          <ul className="flex-1 overflow-y-auto px-1.5 py-1">
            {list.map((c) => {
              const active = c.id === selectedId;
              const p = preview(c.lastMessageText);
              return (
                <li key={c.id}>
                  <Link href={href({ c: c.id })} className={cn("flex items-center gap-3 rounded-xl px-2.5 py-2", active ? "text-white" : "hover:bg-[var(--tg-list-hover)]")} style={active ? { background: "var(--tg-selected)" } : undefined}>
                    <ChatAvatar id={c.id} title={c.title} url={c.avatarUrl} channel={c.channel} size={54} ring={active} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="flex-1 truncate text-[15px] font-semibold">{c.title}</span>
                        <span className={cn("flex shrink-0 items-center gap-0.5 text-xs", active ? "text-white/80" : "text-muted-foreground")}>
                          {p.out && <CheckCheck className={cn("size-4", !active && "text-[var(--tg-accent)]")} />}
                          {when(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className={cn("flex-1 truncate text-[14px]", active ? "text-white/85" : "text-muted-foreground")}>{p.text || "—"}</span>
                        {c.unreadCount > 0 && (
                          <span className="min-w-[22px] rounded-full px-1.5 text-center text-xs font-semibold leading-[22px]" style={active ? { background: "white", color: "var(--tg-selected)" } : { background: "var(--tg-accent)", color: "white" }}>
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      {isAdmin && !staffId && !c.accountId && <div className={cn("truncate text-[11px]", active ? "text-white/70" : "text-muted-foreground")}>{c.lead?.manager?.name ?? t("common.notAssigned")}</div>}
                    </div>
                  </Link>
                </li>
              );
            })}
            {!list.length && <li className="p-8 text-center text-sm text-muted-foreground">{t("chats.empty")}</li>}
          </ul>
        </aside>

        {/* открытый чат */}
        <section className={cn("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden lg:flex")}>
          {selected ? (
            <>
              <header className="flex items-center gap-3 border-b px-3 py-2" style={{ background: "var(--tg-list)" }}>
                <Link href={href({ c: null })} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted lg:hidden" aria-label={t("common.back")}>
                  <ArrowLeft className="size-5" />
                </Link>
                <ChatAvatar id={selected.id} title={selected.title} url={selected.avatarUrl} channel={selected.channel} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold">{selected.lead?.name ?? selected.title}</div>
                  <div className="truncate text-[13px] text-muted-foreground">
                    {[
                      selected.username ? `@${selected.username}` : null,
                      selected.lead?.phone,
                      selected.account ? t("chats.viaAccount", { name: selected.account.user.name }) : selected.lead?.manager?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {aiOn && ai.channels.includes(selected.channel) && !readOnly && <AiToggle conversationId={selected.id} paused={selected.aiPaused} />}
                {selected.lead && (
                  <>
                    <StatusBadge name={statusName(t, selected.lead.status.name)} color={selected.lead.status.color} className="hidden sm:inline-flex" />
                    <Link href={`/leads/${selected.lead.id}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs hover:bg-muted">
                      <ExternalLink className="size-3.5" /> <span className="hidden sm:inline">{t("chats.openLead")}</span>
                    </Link>
                  </>
                )}
              </header>
              <ChatMessages conversationId={selected.id} unread={readOnly ? 0 : selected.unreadCount} messages={[...selected.messages].reverse().map(toMessageView)} canSaveDocs={!!selected.lead && !readOnly} />
              <ChatComposer conversationId={selected.id} readOnly={readOnly} blockedReason={igClosed ? t("chats.igWindow") : null} templates={templates} clientName={selected.lead?.name ?? selected.title} />
            </>
          ) : (
            <div className="tg-chat-bg flex flex-1 items-center justify-center">
              <span className="rounded-full px-3 py-1 text-sm text-white" style={{ background: "var(--tg-day)" }}>
                {t("chats.pick")}
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


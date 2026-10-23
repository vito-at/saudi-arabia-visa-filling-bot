import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChatAutoRefresh } from "@/components/chats/chat-thread";
import { MyTelegram, StaffUnlinkButton } from "@/components/chats/my-telegram";
import { getTelegram } from "@/lib/chats/telegram";
import { getAiSettings } from "@/lib/chats/ai";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { getI18n } from "@/i18n/server";

/** «Мой Telegram»: сотрудник подключает свой личный Telegram к CRM; администратор видит, кто подключён */
export default async function MyTelegramPage() {
  const user = await requireUser();
  if (user.role === "VISA") redirect("/visa");
  const { t } = await getI18n();
  const isAdmin = user.role === "ADMIN";
  const [tg, account, ai, staff] = await Promise.all([
    getTelegram(),
    prisma.telegramAccount.findUnique({ where: { userId: user.id } }),
    getAiSettings(),
    isAdmin
      ? prisma.user.findMany({
          where: { role: { not: "ADMIN" }, OR: [{ isActive: true }, { telegram: { isNot: null } }], NOT: { role: "VISA" } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, isActive: true, telegram: { select: { tgName: true, tgUsername: true, tgUserId: true, connected: true, canReply: true, connectedAt: true, _count: { select: { conversations: true } } } } },
        })
      : Promise.resolve([]),
  ]);
  const botReady = tg.enabled && !!tg.botUsername;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* статус обновляется сам: сотрудник привязывает Telegram в телефоне, а страница открыта на компьютере */}
      <ChatAutoRefresh ms={4000} />
      <div className="flex items-center gap-2">
        <Link href="/chats" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label={t("common.back")}>
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t("tgacc.title")}</h1>
      </div>
      <MyTelegram
        botReady={botReady}
        bot={tg.botUsername}
        aiAvailable={ai.enabled && !!ai.apiKeyEnc && ai.channels.includes("TELEGRAM")}
        isAdmin={isAdmin}
        account={
          account
            ? {
                linked: !!account.tgUserId,
                tgName: account.tgName,
                tgUsername: account.tgUsername,
                connected: account.connected,
                canReply: account.canReply,
                createLeads: account.createLeads,
                aiEnabled: account.aiEnabled,
              }
            : null
        }
      />

      {isAdmin && (
        <Card className="overflow-hidden">
          <div className="border-b px-5 py-3">
            <div className="font-semibold">{t("tgacc.staffTitle")}</div>
            <div className="text-sm text-muted-foreground">{t("tgacc.staffHint")}</div>
          </div>
          <ul className="divide-y">
            {staff.map((s) => {
              const a = s.telegram;
              const state = !a?.tgUserId ? "none" : !a.connected ? "linked" : !a.canReply ? "noReply" : "ok";
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <div className="min-w-40 flex-1">
                    <div className="font-medium">
                      {s.name}
                      {!s.isActive && <span className="ml-1 text-xs font-normal text-muted-foreground">({t("plans.inactive")})</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a?.tgName ? `${a.tgName}${a.tgUsername ? ` · @${a.tgUsername}` : ""}` : "—"}
                      {a?.connectedAt ? ` · ${formatDateTime(a.connectedAt)}` : ""}
                    </div>
                  </div>
                  <span
                    className={
                      state === "ok"
                        ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                        : state === "none"
                          ? "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          : "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
                    }
                  >
                    {t(`tgacc.state.${state}`)}
                  </span>
                  {a && a._count.conversations > 0 && (
                    <Link href={`/chats?u=${s.id}`} className="text-xs font-medium text-[var(--tg-accent)] hover:underline">
                      {t("tgacc.viewChats", { n: a._count.conversations })}
                    </Link>
                  )}
                  {a?.tgUserId && <StaffUnlinkButton userId={s.id} />}
                </li>
              );
            })}
            {!staff.length && <li className="px-5 py-4 text-sm text-muted-foreground">{t("tgacc.noStaff")}</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}

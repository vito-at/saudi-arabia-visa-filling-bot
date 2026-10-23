/** Входящие события мессенджеров → переписки CRM */
import { prisma } from "@/lib/db";
import { getIntegration, pageClient, readSecrets } from "@/lib/meta/integration";
import type { FetchFn as GraphFetch } from "@/lib/meta/graph";
import { parseIgWebhook, type IgWebhookPayload } from "./instagram";
import { recordChatMessage } from "./store";
import { getTelegram, telegramBot, tgAttachments, tgName, tgText, type TgMessage, type TgUpdate } from "./telegram";
import { accountByConnection, applyBusinessConnection, handleLinkStart, type AccountWithOwner } from "./accounts";

/** Instagram Direct: входящие и эхо (ответы из приложения Instagram). Возвращает число записанных сообщений. */
export async function handleInstagramWebhook(payload: IgWebhookPayload, opts: { fetchFn?: GraphFetch } = {}): Promise<number> {
  const integration = await getIntegration();
  if (!integration.igEnabled) return 0;
  const secrets = readSecrets(integration);
  const own = [integration.igAccountId, integration.pageId].filter(Boolean) as string[];
  const messages = parseIgWebhook(payload, own);
  let saved = 0;
  for (const m of messages) {
    const rec = await recordChatMessage({
      channel: "INSTAGRAM",
      externalId: m.userId,
      direction: m.outgoing ? "OUT" : "IN",
      text: m.text,
      attachments: m.attachments,
      externalMessageId: m.mid,
      at: m.at,
      profile: async () => {
        if (!secrets) return { title: "Instagram" };
        const p = await pageClient(secrets, opts.fetchFn).get<{ name?: string; username?: string; profile_pic?: string }>(m.userId, { fields: "name,username,profile_pic" });
        return { title: p.name || (p.username ? `@${p.username}` : "Instagram"), username: p.username ?? null, avatarUrl: p.profile_pic ?? null };
      },
    });
    if (rec) saved++;
  }
  if (messages.length) await prisma.metaIntegration.update({ where: { id: 1 }, data: { igLastEventAt: new Date() } });
  return saved;
}

async function recordTelegram(msg: TgMessage, business: boolean, account: AccountWithOwner | null = null) {
  // только личные чаты: группы и каналы — не клиенты
  if (msg.chat.type !== "private") return null;
  const outgoing = business && !!msg.from && msg.from.id !== msg.chat.id;
  return recordChatMessage({
    channel: "TELEGRAM",
    account,
    externalId: String(msg.chat.id),
    businessConnectionId: business ? (msg.business_connection_id ?? null) : null,
    direction: outgoing ? "OUT" : "IN",
    text: tgText(msg),
    attachments: tgAttachments(msg),
    externalMessageId: String(msg.message_id),
    at: new Date(msg.date * 1000),
    profile: async () => ({ title: tgName(msg.chat), username: msg.chat.username ?? null }),
  });
}

/** Обновление Telegram: сообщение боту, сообщение в личку подключённого бизнес-аккаунта, подключение Telegram Business */
export async function handleTelegramUpdate(u: TgUpdate): Promise<boolean> {
  const integration = await getTelegram();
  if (!integration.enabled) return false;
  await prisma.telegramIntegration.update({ where: { id: 1 }, data: { lastEventAt: new Date() } });
  if (u.business_connection) {
    // подключение Telegram Business принимается только от сотрудника, привязавшего свой Telegram (см. accounts.ts)
    await applyBusinessConnection(u.business_connection);
    return false;
  }
  if (u.business_message) {
    const connectionId = u.business_message.business_connection_id;
    const account = connectionId ? await accountByConnection(connectionId) : null;
    // подключение старой версии CRM (один общий аккаунт, ещё не привязанный к сотруднику) работает как раньше
    const legacy = !account && !!connectionId && connectionId === integration.businessConnectionId;
    // чужой аккаунт подключил нашего бота — его переписки в CRM не попадают
    if (!account && !legacy) return false;
    return !!(await recordTelegram(u.business_message, true, account));
  }
  if (u.message) {
    // /start link_<код> — сотрудник привязывает свой Telegram; это не клиент
    const reply = await handleLinkStart(u.message);
    if (reply !== null) {
      await telegramBot(integration)?.call("sendMessage", { chat_id: u.message.chat.id, text: reply }).catch(() => undefined);
      return false;
    }
    // /start — служебная команда, клиенту отвечать нечего, но переписку создаём
    return !!(await recordTelegram(u.message, false));
  }
  return false;
}

/**
 * Ответ клиенту из CRM: Instagram — через страницу (Messenger Platform), Telegram — через бота
 * (в чат Telegram Business — от имени подключённого аккаунта).
 */
import type { Conversation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getIntegration, pageClient, readSecrets } from "@/lib/meta/integration";
import type { FetchFn as GraphFetch } from "@/lib/meta/graph";
import { ValidationError } from "@/lib/leads/service";
import { igCanReply } from "./instagram";
import { getTelegram, telegramBot, type FetchFn } from "./telegram";
import { previewText } from "./store";

export async function sendToInstagram(conv: Conversation, text: string, fetchFn?: GraphFetch): Promise<string> {
  const secrets = readSecrets(await getIntegration());
  if (!secrets) throw new ValidationError("err.chatIgOff");
  const r = await pageClient(secrets, fetchFn).postJson<{ message_id?: string }>(
    `${secrets.pageId}/messages`,
    JSON.stringify({ recipient: { id: conv.externalId }, messaging_type: "RESPONSE", message: { text } }),
  );
  return r.message_id ?? "";
}

export async function sendToTelegram(conv: Conversation, text: string, fetchFn?: FetchFn): Promise<string> {
  const bot = telegramBot(await getTelegram(), fetchFn);
  if (!bot) throw new ValidationError("err.chatTgOff");
  const r = await bot.call<{ message_id: number }>("sendMessage", {
    chat_id: conv.externalId,
    text,
    ...(conv.businessConnectionId ? { business_connection_id: conv.businessConnectionId } : {}),
  });
  return String(r.message_id);
}

/**
 * Отправить сообщение и записать его в переписку. Ошибка мессенджера (например, у Instagram прошло 24 часа) —
 * исключение с текстом Meta/Telegram; в переписку такое сообщение не попадает.
 */
export async function sendChatMessage(conversationId: string, text: string, senderId: string, opts: { fetchFn?: FetchFn } = {}) {
  const body = text.trim();
  if (!body) throw new ValidationError("err.chatEmpty");
  if (body.length > 4000) throw new ValidationError("err.chatTooLong");
  const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  if (conv.channel === "INSTAGRAM" && !igCanReply(conv.lastInboundAt)) throw new ValidationError("err.chatIgWindow");

  const externalId = conv.channel === "INSTAGRAM" ? await sendToInstagram(conv, body, opts.fetchFn) : await sendToTelegram(conv, body, opts.fetchFn);
  const now = new Date();
  const msg = await prisma.chatMessage.create({
    data: { conversationId, direction: "OUT", text: body, externalId: externalId || null, senderId, createdAt: now },
  });
  await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, lastMessageText: `Вы: ${previewText(body)}`.slice(0, 200), unreadCount: 0 } });
  // ответ клиенту — первая реакция по лиду
  if (conv.leadId) await prisma.lead.updateMany({ where: { id: conv.leadId, firstResponseAt: null }, data: { firstResponseAt: now } });
  return msg;
}

/**
 * Ответ клиенту из CRM: Instagram — через страницу (Messenger Platform), Telegram — через бота
 * (в чат Telegram Business — от имени подключённого аккаунта).
 */
import crypto from "node:crypto";
import type { Conversation, Prisma } from "@prisma/client";
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

/**
 * От чьего имени уходит ответ в Telegram: переписка в личном Telegram сотрудника — через его текущее подключение
 * Telegram Business (если он разрешил боту отвечать), иначе — как раньше.
 */
async function businessConnectionFor(conv: Conversation): Promise<string | null> {
  if (!conv.accountId) return conv.businessConnectionId;
  const account = await prisma.telegramAccount.findUnique({ where: { id: conv.accountId } });
  if (!account?.connectionId || !account.connected || !account.canReply) throw new ValidationError("err.tgAccountCannotReply");
  return account.connectionId;
}

export async function sendToTelegram(conv: Conversation, text: string, fetchFn?: FetchFn): Promise<string> {
  const bot = telegramBot(await getTelegram(), fetchFn);
  if (!bot) throw new ValidationError("err.chatTgOff");
  const connectionId = await businessConnectionFor(conv);
  const r = await bot.call<{ message_id: number }>("sendMessage", {
    chat_id: conv.externalId,
    text,
    ...(connectionId ? { business_connection_id: connectionId } : {}),
  });
  return String(r.message_id);
}

/**
 * Отправить сообщение и записать его в переписку. Ошибка мессенджера (например, у Instagram прошло 24 часа) —
 * исключение с текстом Meta/Telegram; в переписку такое сообщение не попадает.
 */
export async function sendChatMessage(conversationId: string, text: string, senderId: string | null, opts: { fetchFn?: FetchFn; isAi?: boolean } = {}) {
  const body = text.trim();
  if (!body) throw new ValidationError("err.chatEmpty");
  if (body.length > 4000) throw new ValidationError("err.chatTooLong");
  const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  if (conv.channel === "INSTAGRAM" && !igCanReply(conv.lastInboundAt)) throw new ValidationError("err.chatIgWindow");

  const externalId = conv.channel === "INSTAGRAM" ? await sendToInstagram(conv, body, opts.fetchFn) : await sendToTelegram(conv, body, opts.fetchFn);
  const now = new Date();
  const msg = await prisma.chatMessage.create({
    data: { conversationId, direction: "OUT", text: body, externalId: externalId || null, senderId, isAi: !!opts.isAi, createdAt: now },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: opts.isAi
      ? { lastMessageAt: now, lastMessageText: `🤖 ${previewText(body)}`.slice(0, 200), aiReplies: { increment: 1 } }
      : // ответил сотрудник — ИИ-ассистент в этой переписке замолкает
        { lastMessageAt: now, lastMessageText: `Вы: ${previewText(body)}`.slice(0, 200), unreadCount: 0, aiPaused: true },
  });
  // ответ сотрудника клиенту — первая реакция по лиду (ответ ассистента не считается)
  if (conv.leadId && !opts.isAi) await prisma.lead.updateMany({ where: { id: conv.leadId, firstResponseAt: null }, data: { firstResponseAt: now } });
  return msg;
}

/** Файлы клиенту: не больше 20 МБ (у Instagram изображения — до 8 МБ) */
export const CHAT_FILE_MAX = 20 * 1024 * 1024;

export type OutFileKind = "image" | "video" | "audio" | "file";

export function fileKind(mime: string): OutFileKind {
  if (/^image\/(jpeg|png|gif|webp)$/.test(mime)) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

const TG_METHOD: Record<OutFileKind, [string, string]> = { image: ["sendPhoto", "photo"], video: ["sendVideo", "video"], audio: ["sendAudio", "audio"], file: ["sendDocument", "document"] };

const publicBase = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Отправить клиенту файл (фото, документ, видео) с подписью. Файл хранится в CRM: Instagram скачивает его по ссылке,
 * в Telegram он загружается напрямую.
 */
export async function sendChatFile(
  conversationId: string,
  file: { name: string; mime: string; data: Uint8Array },
  caption: string,
  senderId: string,
  opts: { fetchFn?: FetchFn; graphFetch?: GraphFetch } = {},
) {
  if (!file.data.length) throw new ValidationError("err.chatFileEmpty");
  if (file.data.length > CHAT_FILE_MAX) throw new ValidationError("err.chatFileTooBig");
  const text = caption.trim();
  if (text.length > 1000) throw new ValidationError("err.chatCaptionTooLong");
  const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  if (conv.channel === "INSTAGRAM" && !igCanReply(conv.lastInboundAt)) throw new ValidationError("err.chatIgWindow");
  const kind = fileKind(file.mime);
  if (conv.channel === "INSTAGRAM" && kind === "image" && file.data.length > 8 * 1024 * 1024) throw new ValidationError("err.chatFileTooBig");

  const name = file.name.replace(/[\r\n"]/g, "").slice(0, 200) || "file";
  const token = crypto.randomBytes(18).toString("base64url");
  await prisma.chatFile.create({ data: { token, name, mime: file.mime || "application/octet-stream", size: file.data.length, data: Buffer.from(file.data) } });
  const url = `/api/chats/out/${token}`;

  let externalId = "";
  let captionId: string | null = null;
  if (conv.channel === "TELEGRAM") {
    const bot = telegramBot(await getTelegram(), opts.fetchFn);
    if (!bot) throw new ValidationError("err.chatTgOff");
    const [method, field] = TG_METHOD[kind];
    const r = await bot.upload<{ message_id: number }>(
      method,
      { chat_id: conv.externalId, caption: text || undefined, business_connection_id: (await businessConnectionFor(conv)) ?? undefined },
      { field, name, mime: file.mime, data: file.data },
    );
    externalId = String(r.message_id);
  } else {
    const secrets = readSecrets(await getIntegration());
    if (!secrets) throw new ValidationError("err.chatIgOff");
    const client = pageClient(secrets, opts.graphFetch);
    const r = await client.postJson<{ message_id?: string }>(
      `${secrets.pageId}/messages`,
      JSON.stringify({ recipient: { id: conv.externalId }, messaging_type: "RESPONSE", message: { attachment: { type: kind, payload: { url: `${publicBase()}${url}`, is_reusable: false } } } }),
    );
    externalId = r.message_id ?? "";
    // у Instagram подпись к вложению не поддерживается — отдельным сообщением (со своим id, чтобы эхо не задвоилось)
    if (text) {
      const c = await client.postJson<{ message_id?: string }>(`${secrets.pageId}/messages`, JSON.stringify({ recipient: { id: conv.externalId }, messaging_type: "RESPONSE", message: { text } }));
      captionId = c.message_id ?? null;
    }
  }

  const now = new Date();
  const attachments = [{ type: kind, url, name }] as unknown as Prisma.InputJsonValue;
  const separateCaption = conv.channel === "INSTAGRAM" && !!text;
  const msg = await prisma.chatMessage.create({
    data: { conversationId, direction: "OUT", text: separateCaption ? null : text || null, attachments, externalId: externalId || null, senderId, createdAt: now },
  });
  if (separateCaption) {
    await prisma.chatMessage.create({ data: { conversationId, direction: "OUT", text, externalId: captionId, senderId, createdAt: new Date(now.getTime() + 1) } });
  }
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: now, lastMessageText: `Вы: ${previewText(text || null, [{ type: kind, name }])}`.slice(0, 200), unreadCount: 0, aiPaused: true },
  });
  if (conv.leadId) await prisma.lead.updateMany({ where: { id: conv.leadId, firstResponseAt: null }, data: { firstResponseAt: now } });
  return msg;
}

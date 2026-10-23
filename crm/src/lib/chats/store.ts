/**
 * Сохранение сообщений мессенджеров: переписка, сообщение, лид для нового собеседника, телефон из текста.
 */
import type { ChatChannel, ChatDirection, LeadSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createLead } from "@/lib/leads/service";
import { normalizePhone } from "@/lib/phone";
import { notify } from "@/lib/notify";
import type { ParsedAttachment } from "./telegram";

export interface Profile {
  title: string;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface IncomingChatMessage {
  channel: ChatChannel;
  externalId: string;
  businessConnectionId?: string | null;
  direction: ChatDirection;
  text: string | null;
  attachments?: ParsedAttachment[];
  externalMessageId?: string | null;
  at?: Date;
  /** профиль собеседника — запрашивается только для новой переписки */
  profile: () => Promise<Profile>;
}

const SOURCE: Record<ChatChannel, LeadSource> = { INSTAGRAM: "INSTAGRAM_DIRECT", TELEGRAM: "TELEGRAM" };

/** Узбекский номер в тексте сообщения: «+998 90 123 45 67», «901234567», «8 90 123-45-67» */
export function extractPhone(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const m of text.matchAll(/(?:\+?\d[\d\s\-().]{7,18}\d)/g)) {
    const p = normalizePhone(m[0]);
    if (p) return p;
  }
  return null;
}

/** Краткий текст для списка переписок */
export function previewText(text: string | null, attachments: ParsedAttachment[] = []): string {
  if (text?.trim()) return text.trim().slice(0, 200);
  const a = attachments[0];
  if (!a) return "";
  return { image: "📷 Фото", audio: "🎤 Голосовое", video: "🎬 Видео", file: "📎 Файл", sticker: `${a.name ?? "🙂"} Стикер`, location: "📍 Геолокация" }[a.type];
}

/**
 * Записать сообщение. Новая переписка с входящим сообщением — сразу лид в CRM (источник Instagram Direct / Telegram),
 * дальше он распределяется как любой новый лид. Номер телефона из сообщения клиента записывается в лид, если там пусто.
 * Возвращает null, если такое сообщение уже записано.
 */
export async function recordChatMessage(m: IncomingChatMessage) {
  const at = m.at ?? new Date();
  let conv = await prisma.conversation.findUnique({ where: { channel_externalId: { channel: m.channel, externalId: m.externalId } } });
  if (m.externalMessageId && conv) {
    const dup = await prisma.chatMessage.findUnique({ where: { conversationId_externalId: { conversationId: conv.id, externalId: m.externalMessageId } } });
    if (dup) {
      // повторная доставка после сбоя: сообщение записано, но лид мог не создаться — доводим до конца
      if (m.direction === "IN" && !conv.leadId) await ensureLead(conv.id, m.channel, conv.title, extractPhone(m.text));
      return null;
    }
  }
  if (!conv) {
    const profile = await m.profile().catch(() => ({ title: m.channel === "INSTAGRAM" ? "Instagram" : "Telegram" }) as Profile);
    conv = await prisma.conversation.upsert({
      where: { channel_externalId: { channel: m.channel, externalId: m.externalId } },
      update: {},
      create: {
        channel: m.channel,
        externalId: m.externalId,
        businessConnectionId: m.businessConnectionId ?? null,
        title: profile.title,
        username: profile.username ?? null,
        avatarUrl: profile.avatarUrl ?? null,
        lastMessageAt: at,
      },
    });
  }

  const attachments = m.attachments ?? [];
  const inbound = m.direction === "IN";
  const convId = conv.id;
  // сообщение и обновление переписки — вместе: при сбое между ними повторная доставка не потеряет «непрочитанное»
  const msg = await prisma
    .$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId: convId,
          direction: m.direction,
          text: m.text,
          attachments: attachments.length ? (attachments as unknown as Prisma.InputJsonValue) : undefined,
          externalId: m.externalMessageId ?? null,
          createdAt: at,
        },
      });
      await tx.conversation.update({
        where: { id: convId },
        data: {
          lastMessageAt: at,
          lastMessageText: `${inbound ? "" : "Вы: "}${previewText(m.text, attachments)}`.slice(0, 200),
          // ответ из приложения Instagram/Telegram — менеджер ведёт диалог сам, ассистент молчит
          ...(inbound ? { lastInboundAt: at, unreadCount: { increment: 1 } } : { aiPaused: true }),
          ...(m.businessConnectionId ? { businessConnectionId: m.businessConnectionId } : {}),
        },
      });
      return created;
    })
    .catch((e: { code?: string }) => {
      if (e.code === "P2002") return null; // дубль (повторная доставка вебхука)
      throw e;
    });
  if (!msg) return null;

  if (inbound) {
    await ensureLead(conv.id, m.channel, conv.title, extractPhone(m.text));
    // первое непрочитанное сообщение (новая «пачка») — уведомление ответственному
    if (conv.unreadCount === 0) {
      const lead = await prisma.conversation.findUnique({ where: { id: conv.id }, select: { lead: { select: { id: true, managerId: true } } } });
      if (lead?.lead?.managerId)
        await notify([{ userId: lead.lead.managerId, type: "chat", key: `chat:${msg.id}`, link: `/chats?c=${conv.id}`, data: { name: conv.title, channel: m.channel } }]);
    }
  }
  // ответ из приложения Instagram/Telegram (не из CRM) — тоже первая реакция по лиду
  else if (conv.leadId) await prisma.lead.updateMany({ where: { id: conv.leadId, firstResponseAt: null }, data: { firstResponseAt: at } });
  return msg;
}

/**
 * Сообщения одной переписки обрабатываются по очереди: альбом фото в Telegram приходит несколькими доставками сразу,
 * и без очереди каждая создала бы свой лид.
 */
const leadQueue = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = leadQueue.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  leadQueue.set(key, run);
  return run.finally(() => {
    if (leadQueue.get(key) === run) leadQueue.delete(key);
  });
}

/** Лид для переписки: создаётся при первом сообщении клиента; телефон из текста дописывается в пустой лид */
function ensureLead(conversationId: string, channel: ChatChannel, title: string, phone: string | null) {
  return serialized(conversationId, async () => {
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: { lead: { select: { id: true, phone: true, clientId: true } } } });
    if (!conv.lead) {
      const lead = await createLead({ source: SOURCE[channel], name: title, phone }, null);
      if (!lead) return;
      // привязываем, только если лида у переписки всё ещё нет (второй процесс мог успеть раньше) — лишний лид удаляем
      const { count } = await prisma.conversation.updateMany({ where: { id: conversationId, leadId: null }, data: { leadId: lead.id } });
      if (!count) await prisma.lead.delete({ where: { id: lead.id } }).catch(() => undefined);
      return;
    }
    if (phone && !conv.lead.phone) await setLeadPhone(conv.lead.id, conv.lead.clientId, phone);
  });
}

/** Номер из переписки: в лид и клиента (или привязка к клиенту, у которого этот номер уже есть) */
export async function setLeadPhone(leadId: string, clientId: string, phone: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.client.findUnique({ where: { phone } });
    const data: Prisma.LeadUncheckedUpdateInput = { phone };
    if (existing && existing.id !== clientId) {
      data.clientId = existing.id;
      data.isRepeat = true;
    } else if (!existing) {
      await tx.client.update({ where: { id: clientId }, data: { phone } }).catch(() => undefined);
    }
    await tx.lead.update({ where: { id: leadId }, data });
    await tx.leadHistory.create({ data: { leadId, userId: null, field: "phone", oldValue: null, newValue: `${phone} (из переписки)` } });
  });
}

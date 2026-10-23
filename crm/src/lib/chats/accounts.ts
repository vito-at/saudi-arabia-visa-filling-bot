/**
 * Личный Telegram каждого сотрудника (Telegram Business).
 *
 * 1. Сотрудник в CRM («Чаты → Мой Telegram») получает ссылку t.me/<бот>?start=link_<код> и открывает её из своего Telegram:
 *    бот получает /start с кодом и узнаёт Telegram id сотрудника.
 * 2. Сотрудник подключает бота в Telegram: Настройки → Telegram для бизнеса → Чат-боты.
 *    Бот получает business_connection; подключение принимается, только если его владелец привязан в шаге 1.
 *    Чужой аккаунт подключить бота к CRM не может.
 * Переписки идут с отметкой аккаунта: их видит только сам сотрудник, а администратор — переписки сотрудников (не других админов).
 */
import crypto from "node:crypto";
import type { Role, TelegramAccount } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTelegram, telegramBot, tgName, type TgMessage, type TgUser } from "./telegram";

/** Код привязки действует час */
export const LINK_CODE_TTL_MS = 60 * 60_000;
export const LINK_PREFIX = "link_";

export interface TgBusinessConnection {
  id: string;
  user: TgUser;
  is_enabled: boolean;
  /** устаревшее поле Bot API; в новых версиях — rights.can_reply */
  can_reply?: boolean;
  rights?: { can_reply?: boolean };
}

export type AccountWithOwner = TelegramAccount & { user: { id: string; role: Role; isActive: boolean; name: string } };

const withOwner = { user: { select: { id: true, role: true, isActive: true, name: true } } } as const;

const canReplyOf = (c: TgBusinessConnection) => !!(c.rights?.can_reply ?? c.can_reply);

/** Новый код привязки для сотрудника (старый перестаёт действовать) */
export async function newLinkCode(userId: string): Promise<string> {
  const code = crypto.randomBytes(12).toString("hex");
  await prisma.telegramAccount.upsert({
    where: { userId },
    update: { linkCode: code, linkCodeAt: new Date() },
    create: { userId, linkCode: code, linkCodeAt: new Date() },
  });
  return code;
}

/**
 * Переписки, пришедшие через это подключение раньше (до привязки аккаунта), переходят к аккаунту — становятся личными.
 * Конфликт уникальности (такая переписка у аккаунта уже есть) пропускаем: старая остаётся общей.
 */
async function adoptConversations(account: { id: string; connectionId: string | null }) {
  if (!account.connectionId) return;
  const legacy = await prisma.conversation.findMany({ where: { channel: "TELEGRAM", businessConnectionId: account.connectionId, accountId: null }, select: { id: true } });
  for (const c of legacy) {
    await prisma.conversation.update({ where: { id: c.id }, data: { accountId: account.id, scope: account.id } }).catch(() => undefined);
  }
}

/** Подключение Telegram Business: принимаем только от привязанного сотрудника */
export async function applyBusinessConnection(c: TgBusinessConnection): Promise<AccountWithOwner | null> {
  const account = await prisma.telegramAccount.findUnique({ where: { tgUserId: String(c.user.id) }, include: withOwner });
  if (!account) {
    await prisma.telegramIntegration.update({
      where: { id: 1 },
      data: { lastError: `Отклонено подключение Telegram Business от непривязанного аккаунта ${tgName(c.user)} (id ${c.user.id})` },
    });
    return null;
  }
  // прежнее подключение этим id (аккаунт переподключили) — освобождаем
  await prisma.telegramAccount.updateMany({ where: { connectionId: c.id, NOT: { id: account.id } }, data: { connectionId: null, connected: false } });
  const updated = await prisma.telegramAccount.update({
    where: { id: account.id },
    data: {
      connectionId: c.id,
      connected: c.is_enabled,
      canReply: c.is_enabled && canReplyOf(c),
      tgName: tgName(c.user),
      tgUsername: c.user.username ?? null,
      ...(c.is_enabled ? { connectedAt: new Date() } : {}),
    },
    include: withOwner,
  });
  await adoptConversations(updated);
  return updated;
}

/**
 * Аккаунт сотрудника по id подключения из сообщения. Подключение, которое бот ещё не видел (было сделано до этой версии CRM),
 * узнаём у Telegram (getBusinessConnection) и принимаем, если его владелец привязан. Иначе — null.
 */
export async function accountByConnection(connectionId: string): Promise<AccountWithOwner | null> {
  const known = await prisma.telegramAccount.findUnique({ where: { connectionId }, include: withOwner });
  if (known) return known;
  const bot = telegramBot(await getTelegram());
  if (!bot) return null;
  const c = await bot.call<TgBusinessConnection>("getBusinessConnection", { business_connection_id: connectionId }).catch(() => null);
  if (!c) return null;
  const linked = await prisma.telegramAccount.findUnique({ where: { tgUserId: String(c.user.id) } });
  return linked ? applyBusinessConnection(c) : null;
}

/**
 * /start link_<код> из личного Telegram сотрудника: запоминаем его Telegram id. Возвращает текст ответа боту или null,
 * если это не команда привязки.
 */
export async function handleLinkStart(msg: TgMessage): Promise<string | null> {
  const m = msg.text?.trim().match(/^\/start\s+link_([a-f0-9]{24})$/);
  if (!m || !msg.from || msg.chat.type !== "private") return null;
  const account = await prisma.telegramAccount.findUnique({ where: { linkCode: m[1] }, include: { user: { select: { name: true, isActive: true } } } });
  if (!account || !account.linkCodeAt || Date.now() - account.linkCodeAt.getTime() > LINK_CODE_TTL_MS || !account.user.isActive) {
    return "Ссылка устарела. Откройте в CRM «Чаты → Мой Telegram» и получите новую.";
  }
  const tgUserId = String(msg.from.id);
  const other = await prisma.telegramAccount.findUnique({ where: { tgUserId } });
  if (other && other.id !== account.id) return "Этот Telegram уже привязан к другому сотруднику CRM. Пусть администратор отключит его там.";
  const changed = account.tgUserId && account.tgUserId !== tgUserId;
  await prisma.telegramAccount.update({
    where: { id: account.id },
    data: {
      tgUserId,
      tgName: tgName(msg.from),
      tgUsername: msg.from.username ?? null,
      linkCode: null,
      linkCodeAt: null,
      // привязали другой Telegram — прежнее подключение больше не его
      ...(changed ? { connectionId: null, connected: false, canReply: false } : {}),
    },
  });
  // подключение Telegram Business, сделанное этим аккаунтом раньше (единственное подключение старой версии CRM), — сразу к нему
  const integration = await getTelegram();
  if (integration.businessConnectionId) {
    const acc = await accountByConnection(integration.businessConnectionId);
    if (acc?.id === account.id) await prisma.telegramIntegration.update({ where: { id: 1 }, data: { businessConnectionId: null, businessUser: null } });
  }
  return `Готово: Telegram привязан к CRM (${account.user.name}). Теперь подключите этого бота: Настройки → Telegram для бизнеса → Чат-боты, и разрешите ему отвечать на сообщения.`;
}

/** Отвязать Telegram сотрудника: переписки остаются в истории (личными), новые сообщения не принимаются */
export async function unlinkAccount(userId: string) {
  await prisma.telegramAccount.updateMany({ where: { userId }, data: { tgUserId: null, connectionId: null, connected: false, canReply: false, linkCode: null, linkCodeAt: null } });
}

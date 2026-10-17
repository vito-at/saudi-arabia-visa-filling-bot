"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { encrypt } from "@/lib/crypto";
import { requireAdmin } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { getIntegration, pageClient, readSecrets } from "@/lib/meta/integration";
import { GraphError } from "@/lib/meta/graph";
import { getTelegram, TelegramBot, TelegramError, telegramBot } from "@/lib/chats/telegram";
import { getI18n } from "@/i18n/server";

const appUrl = () => (process.env.APP_URL || "").replace(/\/$/, "");

/** Подключить Telegram-бота: проверка токена (getMe) и вебхук с секретом */
export async function saveTelegramAction(token: string) {
  return runAction(async () => {
    await requireAdmin();
    const current = await getTelegram();
    const t = token.trim();
    const bot = t ? new TelegramBot(t) : telegramBot(current);
    if (!bot) throw new ValidationError("err.tgToken");
    if (!appUrl().startsWith("https://")) throw new ValidationError("err.tgHttps");
    const secret = current.webhookSecret ?? crypto.randomBytes(24).toString("hex");
    try {
      const me = await bot.call<{ username: string }>("getMe");
      await bot.call("setWebhook", {
        url: `${appUrl()}/api/webhooks/telegram`,
        secret_token: secret,
        allowed_updates: ["message", "business_connection", "business_message"],
        drop_pending_updates: false,
      });
      await prisma.telegramIntegration.update({
        where: { id: 1 },
        data: { ...(t ? { botTokenEnc: encrypt(t) } : {}), botUsername: me.username, webhookSecret: secret, enabled: true, lastError: null },
      });
    } catch (e) {
      if (e instanceof TelegramError) throw new ValidationError("err.tgApi", { error: e.message });
      throw e;
    }
    revalidatePath("/settings");
    return (await getI18n()).t("chatset.tgConnected");
  });
}

export async function disableTelegramAction() {
  return runAction(async () => {
    await requireAdmin();
    const bot = telegramBot(await getTelegram());
    await bot?.call("deleteWebhook").catch(() => undefined);
    await prisma.telegramIntegration.update({ where: { id: 1 }, data: { enabled: false } });
    revalidatePath("/settings");
  });
}

/**
 * Включить переписку Instagram: находим аккаунт Instagram, привязанный к странице, и подписываем страницу на сообщения.
 * Нужен токен страницы с правами instagram_basic, instagram_manage_messages, pages_manage_metadata.
 */
export async function connectInstagramAction() {
  return runAction(async () => {
    await requireAdmin();
    const secrets = readSecrets(await getIntegration());
    if (!secrets) throw new ValidationError("err.integrationSetup");
    const client = pageClient(secrets);
    try {
      const page = await client.get<{ instagram_business_account?: { id: string; username?: string } }>(secrets.pageId, { fields: "instagram_business_account{id,username}" });
      const ig = page.instagram_business_account;
      if (!ig) throw new ValidationError("err.igNoAccount");
      await client.post(`${secrets.pageId}/subscribed_apps`, { subscribed_fields: "leadgen,messages" });
      await prisma.metaIntegration.update({ where: { id: 1 }, data: { igEnabled: true, igAccountId: ig.id, igUsername: ig.username ?? null } });
      revalidatePath("/settings");
      return (await getI18n()).t("chatset.igConnected", { name: ig.username ? `@${ig.username}` : ig.id });
    } catch (e) {
      if (e instanceof GraphError) throw new ValidationError("err.igApi", { error: e.message });
      throw e;
    }
  });
}

export async function disableInstagramAction() {
  return runAction(async () => {
    await requireAdmin();
    await prisma.metaIntegration.update({ where: { id: 1 }, data: { igEnabled: false } });
    revalidatePath("/settings");
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { requireAdmin, requireUser, AccessError } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { getTelegram } from "@/lib/chats/telegram";
import { LINK_PREFIX, newLinkCode, unlinkAccount } from "@/lib/chats/accounts";

/** Ссылка для привязки своего Telegram: t.me/<бот>?start=link_<код> (действует час) */
export async function telegramLinkAction() {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role === "VISA") throw new AccessError();
    const tg = await getTelegram();
    if (!tg.enabled || !tg.botUsername) throw new ValidationError("err.tgBotOff");
    const code = await newLinkCode(user.id);
    return { url: `https://t.me/${tg.botUsername}?start=${LINK_PREFIX}${code}`, bot: tg.botUsername };
  });
}

/** Отвязать свой Telegram */
export async function telegramUnlinkAction() {
  return runAction(async () => {
    const user = await requireUser();
    await unlinkAccount(user.id);
    revalidatePath("/chats/telegram");
  });
}

/** Настройки своего аккаунта: создавать ли лиды из новых переписок, отвечает ли ИИ-ассистент */
export async function telegramOptionsAction(input: { createLeads?: boolean; aiEnabled?: boolean }) {
  return runAction(async () => {
    const user = await requireUser();
    const data = {
      ...(typeof input.createLeads === "boolean" ? { createLeads: input.createLeads } : {}),
      ...(typeof input.aiEnabled === "boolean" ? { aiEnabled: input.aiEnabled } : {}),
    };
    await prisma.telegramAccount.updateMany({ where: { userId: user.id }, data });
    revalidatePath("/chats/telegram");
  });
}

/** Администратор отвязывает Telegram сотрудника (например, уволенного): новые сообщения перестают приходить */
export async function telegramUnlinkUserAction(userId: string) {
  return runAction(async () => {
    await requireAdmin();
    await unlinkAccount(userId);
    revalidatePath("/chats/telegram");
  });
}

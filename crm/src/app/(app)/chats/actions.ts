"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { conversationScope } from "@/lib/access";
import { requireUser, AccessError } from "@/lib/session";
import { takeLead, ValidationError } from "@/lib/leads/service";
import { sendChatMessage } from "@/lib/chats/send";
import { TelegramError } from "@/lib/chats/telegram";
import { GraphError } from "@/lib/meta/graph";

async function getConversation(conversationId: string) {
  const user = await requireUser();
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, ...conversationScope(user) }, include: { lead: { select: { id: true, managerId: true, status: { select: { kind: true } } } } } });
  if (!conv) throw new AccessError("err.chatNotFound");
  return { user, conv };
}

/** Ответ клиенту. Менеджер, ответивший по нераспределённому или новому лиду, берёт его в работу. */
export async function sendChatMessageAction(conversationId: string, text: string) {
  return runAction(async () => {
    const { user, conv } = await getConversation(conversationId);
    try {
      await sendChatMessage(conversationId, text, user.id);
    } catch (e) {
      // ошибки мессенджера показываем как есть (например, «прошло больше 24 часов» у Instagram)
      if (e instanceof GraphError || e instanceof TelegramError) throw new ValidationError("err.chatSend", { error: e.message });
      throw e;
    }
    const lead = conv.lead;
    if (lead && user.role === "MANAGER" && (!lead.managerId || (lead.managerId === user.id && lead.status.kind === "NEW"))) {
      await takeLead(lead.id, user).catch(() => undefined);
    }
    revalidatePath("/chats");
    if (lead) revalidatePath(`/leads/${lead.id}`);
  });
}

export async function markChatReadAction(conversationId: string) {
  return runAction(async () => {
    const { conv } = await getConversation(conversationId);
    if (conv.unreadCount > 0) await prisma.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } });
  });
}

/** Включить или выключить ИИ-ассистента в переписке */
export async function setAiPausedAction(conversationId: string, paused: boolean) {
  return runAction(async () => {
    const { conv } = await getConversation(conversationId);
    // при включении счётчик ответов начинается заново
    await prisma.conversation.update({ where: { id: conversationId }, data: paused ? { aiPaused: true } : { aiPaused: false, aiReplies: 0 } });
    revalidatePath("/chats");
    if (conv.leadId) revalidatePath(`/leads/${conv.leadId}`);
  });
}

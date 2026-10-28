import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./session";
import { prisma } from "./db";
import { AccessError } from "./session";

/** Фильтр видимости лидов: менеджер видит свои и нераспределённые (кроме созданных администратором). */
export function leadScope(user: CurrentUser): Prisma.LeadWhereInput {
  if (user.role === "ADMIN") return {};
  // визовый специалист работает только с визовыми заявками — лидов и переписок он не видит и не меняет
  if (user.role === "VISA") return { id: { in: [] } };
  // нераспределённые лиды из Meta и от менеджеров видны всем; созданные администратором — только после назначения
  return { OR: [{ managerId: user.id }, { managerId: null, hiddenFromManagers: false }] };
}

/** Клиенты менеджера — те, у кого есть его лиды или его продажи (лид могли потом передать другому). */
export function clientScope(user: CurrentUser): Prisma.ClientWhereInput {
  if (user.role === "ADMIN") return {};
  return { OR: [{ leads: { some: { managerId: user.id } } }, { deals: { some: { managerId: user.id } } }] };
}

/** Фильтр для отчётов: менеджер видит только свои данные. */
export function reportLeadScope(user: CurrentUser, managerId?: string | null): Prisma.LeadWhereInput {
  if (user.role !== "ADMIN") return { managerId: user.id };
  if (managerId === "none") return { managerId: null };
  return managerId ? { managerId } : {};
}

export async function getLeadForUser(user: CurrentUser, leadId: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...leadScope(user) } });
  if (!lead) throw new AccessError("err.leadNotFound");
  return lead;
}

/**
 * Переписки отвязанного Telegram скрыты от всех: сотрудник (или владелец) отвязал свой Telegram — его старые чаты
 * исчезают из CRM. Сюда же — переписки общего подключения старой версии CRM (личный Telegram владельца без аккаунта).
 * Данные не удаляются: привяжет Telegram снова — переписки вернутся.
 */
const unlinkedTelegram: Prisma.ConversationWhereInput = { OR: [{ accountId: null, businessConnectionId: { not: null } }, { account: { tgUserId: null } }] };
const visible = (where: Prisma.ConversationWhereInput): Prisma.ConversationWhereInput => ({ AND: [where, { NOT: unlinkedTelegram }] });

/**
 * Переписки, которые пользователь может открыть.
 * - Общие (Instagram, сам бот): менеджер — чаты своих лидов и нераспределённых (как и сами лиды), администратор — все.
 * - Личный Telegram сотрудника: только сам сотрудник; администратор — ещё и переписки сотрудников (для контроля),
 *   но не других администраторов: личный Telegram владельца не видит никто.
 * - Telegram отвязан — его переписки не видит никто (см. unlinkedTelegram).
 */
export function conversationScope(user: CurrentUser): Prisma.ConversationWhereInput {
  if (user.role === "VISA") return { id: { in: [] } };
  if (user.role === "ADMIN") return visible({ OR: [{ accountId: null }, { account: { userId: user.id } }, { account: { user: { role: { not: "ADMIN" } } } }] });
  return visible({ OR: [{ accountId: null, OR: [{ leadId: null }, { lead: leadScope(user) }] }, { account: { userId: user.id } }] });
}

/**
 * «Мои» переписки — список чатов и счётчик непрочитанных: без переписок сотрудников, которые администратор открывает
 * только когда хочет проверить (фильтр по сотруднику в «Чатах»).
 */
export function inboxScope(user: CurrentUser): Prisma.ConversationWhereInput {
  if (user.role !== "ADMIN") return conversationScope(user);
  return visible({ OR: [{ accountId: null }, { account: { userId: user.id } }] });
}

/** Отвечать в переписке личного Telegram может только его хозяин; администратор переписки сотрудников только читает */
export function canWriteConversation(user: CurrentUser, conv: { accountId: string | null; account?: { userId: string } | null }): boolean {
  return !conv.accountId || conv.account?.userId === user.id;
}

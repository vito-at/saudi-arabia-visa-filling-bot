import type { LeadSource, Prisma, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { formatDate } from "@/lib/format";
import { SERVICE_LABELS, SOURCE_LABELS } from "@/lib/constants";
import { pickNextManager } from "./distribution";

type Tx = Prisma.TransactionClient;

export class ValidationError extends Error {}

export interface NewLeadInput {
  source: LeadSource;
  name: string;
  phone?: string | null;
  email?: string | null;
  serviceType?: ServiceType | null;
  destination?: string | null;
  travelFrom?: Date | null;
  travelTo?: Date | null;
  travelers?: number | null;
  formAnswers?: Prisma.InputJsonValue;
  leadgenId?: string | null;
  formId?: string | null;
  formName?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  adsetId?: string | null;
  adsetName?: string | null;
  adId?: string | null;
  adName?: string | null;
  platform?: string | null;
  metaCreatedAt?: Date | null;
  managerId?: string | null;
  comment?: string | null;
}

/**
 * Создание лида: нормализация телефона, поиск клиента (повторное обращение),
 * начальный статус, автораспределение, запись в историю.
 * Возвращает null, если лид с таким leadgenId уже есть (дубль из Meta).
 */
export async function createLead(input: NewLeadInput, actorId: string | null) {
  if (input.leadgenId) {
    const [dup, deleted] = await Promise.all([
      prisma.lead.findUnique({ where: { leadgenId: input.leadgenId }, select: { id: true } }),
      prisma.deletedLeadgen.findUnique({ where: { leadgenId: input.leadgenId } }),
    ]);
    // удалённый администратором лид Meta не загружаем повторно
    if (dup || deleted) return null;
  }
  const phone = normalizePhone(input.phone);
  const name = input.name?.trim() || "Без имени";

  try {
    return await prisma.$transaction(async (tx) => {
      const newStatus = await tx.leadStatus.findFirst({ where: { kind: "NEW" }, orderBy: { order: "asc" } });
      const status = newStatus ?? (await tx.leadStatus.findFirst({ orderBy: { order: "asc" } }));
      if (!status) throw new ValidationError("Не настроены статусы лидов");

      let client = phone ? await tx.client.findUnique({ where: { phone } }) : null;
      let isRepeat = false;
      if (client) {
        isRepeat = (await tx.lead.count({ where: { clientId: client.id } })) > 0;
        if (!client.email && input.email) client = await tx.client.update({ where: { id: client.id }, data: { email: input.email } });
      } else {
        client = await tx.client.create({ data: { name, phone, email: input.email || null } });
      }

      let managerId = input.managerId ?? null;
      let autoAssigned = false;
      if (!managerId) {
        // повторного клиента отдаём тому же менеджеру, что вёл его раньше
        if (isRepeat) {
          const prev = await tx.lead.findFirst({
            where: { clientId: client.id, managerId: { not: null }, manager: { isActive: true } },
            orderBy: { createdAt: "desc" },
            select: { managerId: true },
          });
          managerId = prev?.managerId ?? null;
        }
        if (!managerId) managerId = await pickNextManager(tx);
        autoAssigned = !!managerId;
      }

      const now = new Date();
      const lead = await tx.lead.create({
        data: {
          leadgenId: input.leadgenId || null,
          source: input.source,
          name,
          phone,
          phoneRaw: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          clientId: client.id,
          isRepeat,
          statusId: status.id,
          managerId,
          assignedAt: managerId ? now : null,
          serviceType: input.serviceType ?? null,
          destination: input.destination?.trim() || null,
          travelFrom: input.travelFrom ?? null,
          travelTo: input.travelTo ?? null,
          travelers: input.travelers ?? null,
          formAnswers: input.formAnswers ?? undefined,
          formId: input.formId ?? null,
          formName: input.formName ?? null,
          campaignId: input.campaignId ?? null,
          campaignName: input.campaignName ?? null,
          adsetId: input.adsetId ?? null,
          adsetName: input.adsetName ?? null,
          adId: input.adId ?? null,
          adName: input.adName ?? null,
          platform: input.platform ?? null,
          metaCreatedAt: input.metaCreatedAt ?? null,
          createdAt: input.metaCreatedAt ?? now,
          statusChangedAt: input.metaCreatedAt ?? now,
        },
      });

      const history: Prisma.LeadHistoryCreateManyInput[] = [
        {
          leadId: lead.id,
          userId: actorId,
          field: "created",
          newValue: `${SOURCE_LABELS[input.source]}${isRepeat ? " · повторное обращение" : ""}`,
          toStatusId: status.id,
          createdAt: lead.createdAt,
        },
      ];
      if (managerId && autoAssigned) {
        const m = await tx.user.findUnique({ where: { id: managerId }, select: { name: true } });
        history.push({ leadId: lead.id, userId: null, field: "manager", newValue: `${m?.name ?? ""} (автоматически)`, createdAt: lead.createdAt });
      }
      await tx.leadHistory.createMany({ data: history });
      if (input.comment?.trim() && actorId) {
        await tx.comment.create({ data: { leadId: lead.id, authorId: actorId, text: input.comment.trim() } });
      }
      return lead;
    });
  } catch (e) {
    // гонка вебхука и опроса: второй вставляющий получает нарушение уникальности leadgenId
    if (input.leadgenId && (e as { code?: string }).code === "P2002") return null;
    throw e;
  }
}

/** Отметка первой реакции менеджера на лид (для отчёта о скорости реакции). */
async function markFirstResponse(tx: Tx, leadId: string, at = new Date()) {
  await tx.lead.updateMany({ where: { id: leadId, firstResponseAt: null }, data: { firstResponseAt: at } });
}

export interface StatusChange {
  statusId: string;
  lossReasonId?: string | null;
  lossComment?: string | null;
}

/** Смена статуса с проверками: «Отказ» требует причину, «Продано» — сделку. */
export async function changeStatus(leadId: string, change: StatusChange, actor: { id: string; role: string }) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId }, include: { status: true, _count: { select: { deals: true } } } });
    const target = await tx.leadStatus.findUnique({ where: { id: change.statusId } });
    if (!target) throw new ValidationError("Статус не найден");
    if (target.id === lead.statusId && target.kind !== "LOST") return lead;

    const data: Prisma.LeadUncheckedUpdateInput = { statusId: target.id, statusChangedAt: new Date() };
    const history: Prisma.LeadHistoryCreateManyInput[] = [];

    if (target.kind === "LOST") {
      if (!change.lossReasonId) throw new ValidationError("Укажите причину отказа");
      const reason = await tx.lossReason.findUnique({ where: { id: change.lossReasonId } });
      if (!reason) throw new ValidationError("Причина отказа не найдена");
      data.lossReasonId = reason.id;
      data.lossComment = change.lossComment?.trim() || null;
      history.push({ leadId, userId: actor.id, field: "lossReason", oldValue: null, newValue: reason.name + (data.lossComment ? ` — ${data.lossComment}` : "") });
    } else if (lead.lossReasonId) {
      // лид вернули из отказа — причину сбрасываем
      data.lossReasonId = null;
      data.lossComment = null;
    }

    if (target.kind === "WON" && lead._count.deals === 0) {
      throw new ValidationError("Для статуса «Продано» нужно заполнить сделку");
    }

    // менеджер, взявший нераспределённый лид в работу, становится ответственным
    if (!lead.managerId && actor.role === "MANAGER") {
      data.managerId = actor.id;
      data.assignedAt = new Date();
      const me = await tx.user.findUnique({ where: { id: actor.id }, select: { name: true } });
      history.push({ leadId, userId: actor.id, field: "manager", oldValue: null, newValue: me?.name ?? "" });
    }

    if (target.id !== lead.statusId) {
      history.push({ leadId, userId: actor.id, field: "status", oldValue: lead.status.name, newValue: target.name, toStatusId: target.id });
    }
    const updated = await tx.lead.update({ where: { id: leadId }, data });
    if (history.length) await tx.leadHistory.createMany({ data: history });
    if (lead.status.kind === "NEW" && target.kind !== "NEW") await markFirstResponse(tx, leadId);
    return updated;
  });
}

/** Назначение ответственного (одного или нескольких лидов). */
export async function assignManager(leadIds: string[], managerId: string | null, actorId: string) {
  if (!leadIds.length) return 0;
  const manager = managerId ? await prisma.user.findFirst({ where: { id: managerId, isActive: true } }) : null;
  if (managerId && !manager) throw new ValidationError("Менеджер не найден");
  return prisma.$transaction(async (tx) => {
    const leads = await tx.lead.findMany({ where: { id: { in: leadIds } }, include: { manager: { select: { name: true } } } });
    const changed = leads.filter((l) => l.managerId !== managerId);
    if (!changed.length) return 0;
    await tx.lead.updateMany({
      where: { id: { in: changed.map((l) => l.id) } },
      data: { managerId, assignedAt: managerId ? new Date() : null },
    });
    await tx.leadHistory.createMany({
      data: changed.map((l) => ({
        leadId: l.id,
        userId: actorId,
        field: "manager",
        oldValue: l.manager?.name ?? null,
        newValue: manager?.name ?? null,
      })),
    });
    return changed.length;
  });
}

/** «Взять в работу»: менеджер назначает себя и переводит лид в статус «В работе». */
export async function takeLead(leadId: string, actor: { id: string; role: string }) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { status: true } });
  if (lead.managerId && lead.managerId !== actor.id && actor.role !== "ADMIN") {
    throw new ValidationError("Лид уже взят другим менеджером");
  }
  if (lead.managerId !== actor.id) await assignManager([leadId], actor.id, actor.id);
  if (lead.status.kind === "NEW") {
    const inProgress =
      (await prisma.leadStatus.findFirst({ where: { kind: "IN_PROGRESS" }, orderBy: { order: "asc" } })) ??
      (await prisma.leadStatus.findFirst({ where: { order: { gt: lead.status.order } }, orderBy: { order: "asc" } }));
    if (inProgress) await changeStatus(leadId, { statusId: inProgress.id }, actor);
  }
}

export interface LeadFieldsPatch {
  name?: string;
  phone?: string | null;
  email?: string | null;
  serviceType?: ServiceType | null;
  destination?: string | null;
  travelFrom?: Date | null;
  travelTo?: Date | null;
  travelers?: number | null;
  source?: LeadSource;
}

function show(field: keyof LeadFieldsPatch, v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return formatDate(v);
  if (field === "serviceType") return SERVICE_LABELS[v as ServiceType];
  if (field === "source") return SOURCE_LABELS[v as LeadSource];
  return String(v);
}

/** Изменение полей лида с записью каждого изменения в историю. */
export async function updateLeadFields(leadId: string, patch: LeadFieldsPatch, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    const data: Prisma.LeadUncheckedUpdateInput = {};
    const history: Prisma.LeadHistoryCreateManyInput[] = [];

    if (patch.phone !== undefined) {
      const normalized = normalizePhone(patch.phone);
      if (patch.phone && !normalized) throw new ValidationError("Телефон должен быть узбекским номером: +998XXXXXXXXX");
      patch = { ...patch, phone: normalized };
    }

    for (const key of Object.keys(patch) as (keyof LeadFieldsPatch)[]) {
      const next = patch[key];
      if (next === undefined) continue;
      const prev = lead[key as keyof typeof lead];
      const same = prev instanceof Date && next instanceof Date ? prev.getTime() === next.getTime() : (prev ?? null) === (next ?? null);
      if (same) continue;
      (data as Record<string, unknown>)[key] = next;
      history.push({ leadId, userId: actorId, field: key, oldValue: show(key, prev), newValue: show(key, next) });
    }
    if (!history.length) return lead;

    // телефон изменился — перепривязываем к клиенту с этим номером
    if (data.phone) {
      const existing = await tx.client.findUnique({ where: { phone: data.phone as string } });
      if (existing && existing.id !== lead.clientId) {
        data.clientId = existing.id;
        data.isRepeat = true;
      } else if (!existing) {
        await tx.client.update({ where: { id: lead.clientId }, data: { phone: data.phone as string } }).catch(() => undefined);
      }
    }
    const updated = await tx.lead.update({ where: { id: leadId }, data });
    await tx.leadHistory.createMany({ data: history });
    await markFirstResponse(tx, leadId);
    return updated;
  });
}

export async function addComment(leadId: string, authorId: string, text: string) {
  const t = text.trim();
  if (!t) throw new ValidationError("Комментарий пустой");
  return prisma.$transaction(async (tx) => {
    const c = await tx.comment.create({ data: { leadId, authorId, text: t } });
    await markFirstResponse(tx, leadId);
    return c;
  });
}

export async function editComment(commentId: string, authorId: string, text: string) {
  const t = text.trim();
  if (!t) throw new ValidationError("Комментарий пустой");
  const c = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!c || c.authorId !== authorId) throw new ValidationError("Можно редактировать только свои комментарии");
  return prisma.comment.update({ where: { id: commentId }, data: { text: t, editedAt: new Date() } });
}

/**
 * Удаление лида вместе с комментариями, историей, задачами и сделками.
 * Клиент удаляется, если у него не осталось других лидов.
 * ID лида Meta запоминается, чтобы синхронизация не загрузила его снова.
 */
export async function deleteLead(leadId: string) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { clientId: true, leadgenId: true } });
    if (!lead) throw new ValidationError("Лид не найден");
    if (lead.leadgenId) {
      await tx.deletedLeadgen.upsert({ where: { leadgenId: lead.leadgenId }, update: {}, create: { leadgenId: lead.leadgenId } });
    }
    await tx.lead.delete({ where: { id: leadId } });
    const rest = await tx.lead.count({ where: { clientId: lead.clientId } });
    if (rest === 0) await tx.client.delete({ where: { id: lead.clientId } });
    return { clientDeleted: rest === 0 };
  });
}

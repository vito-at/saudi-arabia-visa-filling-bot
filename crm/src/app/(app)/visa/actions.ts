"use server";

import { revalidatePath } from "next/cache";
import type { ServiceType, VisaStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { conversationScope, getLeadForUser } from "@/lib/access";
import { AccessError, requireUser, type CurrentUser } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { SERVICE_TYPES } from "@/lib/constants";
import { getTelegram, telegramBot } from "@/lib/chats/telegram";
import { notify } from "@/lib/notify";
import { DOC_MAX, FINAL_VISA, VISA_STATUSES, ensureLeadServices, guessMime, requirementsFor, serviceScope } from "@/lib/visa";

async function getService(user: CurrentUser, serviceId: string) {
  const s = await prisma.leadService.findFirst({ where: { id: serviceId, ...serviceScope(user) }, include: { lead: { select: { id: true, name: true, managerId: true } } } });
  if (!s) throw new AccessError("err.serviceNotFound");
  return s;
}

function revalidate(leadId: string, serviceId?: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/visa");
  if (serviceId) revalidatePath(`/visa/${serviceId}`);
  revalidatePath("/chats");
}

async function visaUsers() {
  return (await prisma.user.findMany({ where: { role: "VISA", isActive: true }, select: { id: true } })).map((u) => u.id);
}

// ——— Заявки по лиду ———

/** Новая заявка: виза в другую страну, авиабилеты, тур… — менеджер добавляет в карточке лида */
export async function addServiceAction(leadId: string, input: { type: string; country: string; note: string }) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role === "VISA") throw new AccessError();
    await getLeadForUser(user, leadId);
    const type = input.type as ServiceType;
    if (!SERVICE_TYPES.includes(type)) throw new ValidationError("err.serviceType");
    const country = input.country.trim().slice(0, 100) || null;
    if (type === "VISA" && !country) throw new ValidationError("err.visaCountry");
    await prisma.leadService.create({ data: { leadId, type, country, note: input.note.trim().slice(0, 500) || null, createdById: user.id } });
    revalidate(leadId);
  });
}

/** Закрыть или вернуть в работу заявку (не визовую — у визы это делает визовый специалист этапом) */
export async function setServiceClosedAction(serviceId: string, closed: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    const s = await getService(user, serviceId);
    if (s.type === "VISA" && s.handedAt) throw new ValidationError("err.visaClosedBySpecialist");
    await prisma.leadService.update({ where: { id: s.id }, data: { closed } });
    revalidate(s.leadId, s.id);
  });
}

/** Удалить заявку без документов (добавили по ошибке) */
export async function deleteServiceAction(serviceId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const s = await getService(user, serviceId);
    if (s.handedAt && user.role !== "ADMIN") throw new ValidationError("err.serviceHanded");
    if (await prisma.leadDocument.count({ where: { serviceId: s.id } })) throw new ValidationError("err.serviceHasDocs");
    await prisma.leadService.delete({ where: { id: s.id } });
    revalidate(s.leadId);
  });
}

/** Передать визовую заявку визовым специалистам */
export async function handOverAction(serviceId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const s = await getService(user, serviceId);
    if (s.type !== "VISA") throw new ValidationError("err.serviceType");
    if (s.handedAt) return;
    await prisma.$transaction([
      prisma.leadService.update({ where: { id: s.id }, data: { handedAt: new Date(), status: "NEW", statusAt: new Date() } }),
      prisma.visaEvent.create({ data: { serviceId: s.id, userId: user.id, status: "NEW", comment: null } }),
      prisma.leadHistory.create({ data: { leadId: s.leadId, userId: user.id, field: "visa", newValue: `Виза${s.country ? `: ${s.country}` : ""} — передана визовому специалисту` } }),
    ]);
    await notify((await visaUsers()).map((userId) => ({ userId, type: "visaNew" as const, key: `visaNew:${s.id}`, link: `/visa/${s.id}`, data: { name: s.lead.name, product: s.country } })));
    revalidate(s.leadId, s.id);
  });
}

// ——— Этапы визы (визовый специалист и администратор) ———

export async function setVisaStatusAction(serviceId: string, status: string, comment: string) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== "VISA" && user.role !== "ADMIN") throw new AccessError();
    const s = await getService(user, serviceId);
    if (s.type !== "VISA" || !s.handedAt) throw new AccessError("err.serviceNotFound");
    const st = status as VisaStatus;
    if (!VISA_STATUSES.includes(st)) throw new ValidationError("err.visaStatus");
    const text = comment.trim().slice(0, 2000) || null;
    if (st === "DOCS_REQUESTED" && !text) throw new ValidationError("err.visaDocsComment");
    if (st === s.status && !text) return;
    const now = new Date();
    await prisma.$transaction([
      prisma.leadService.update({
        where: { id: s.id },
        data: { status: st, statusAt: now, closed: FINAL_VISA.includes(st), ...(user.role === "VISA" && !s.assigneeId ? { assigneeId: user.id } : {}) },
      }),
      prisma.visaEvent.create({ data: { serviceId: s.id, userId: user.id, status: st === s.status ? null : st, comment: text } }),
      prisma.leadHistory.create({ data: { leadId: s.leadId, userId: user.id, field: "visa", newValue: `Виза${s.country ? `: ${s.country}` : ""} — ${STATUS_RU[st]}${text ? ` (${text})` : ""}` } }),
    ]);
    // менеджеру лида — что изменилось по визе его клиента
    if (s.lead.managerId && s.lead.managerId !== user.id && st !== s.status) {
      await notify([{ userId: s.lead.managerId, type: "visa", key: `visa:${s.id}:${st}:${now.getTime()}`, link: `/leads/${s.leadId}`, data: { name: s.lead.name, status: st } }]);
    }
    revalidate(s.leadId, s.id);
  });
}

const STATUS_RU: Record<VisaStatus, string> = {
  NEW: "новая",
  IN_PROGRESS: "в процессе",
  PAID_WAITING: "оплачено, ожидается результат",
  DOCS_REQUESTED: "запрос доп. документов",
  APPROVED: "виза одобрена",
  REJECTED: "отказ",
};

export async function visaCommentAction(serviceId: string, comment: string) {
  return runAction(async () => {
    const user = await requireUser();
    const s = await getService(user, serviceId);
    const text = comment.trim().slice(0, 2000);
    if (!text) throw new ValidationError("err.commentEmpty");
    await prisma.visaEvent.create({ data: { serviceId: s.id, userId: user.id, comment: text } });
    revalidate(s.leadId, s.id);
  });
}

/** Визовый специалист берёт заявку себе */
export async function takeVisaAction(serviceId: string) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== "VISA" && user.role !== "ADMIN") throw new AccessError();
    const s = await getService(user, serviceId);
    await prisma.leadService.update({ where: { id: s.id }, data: { assigneeId: user.id, ...(s.status === "NEW" ? { status: "IN_PROGRESS", statusAt: new Date() } : {}) } });
    if (s.status === "NEW") await prisma.visaEvent.create({ data: { serviceId: s.id, userId: user.id, status: "IN_PROGRESS" } });
    revalidate(s.leadId, s.id);
  });
}

// ——— Документы ———

export async function deleteDocumentAction(documentId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const d = await prisma.leadDocument.findUnique({ where: { id: documentId }, select: { id: true, serviceId: true, leadId: true, uploadedById: true } });
    if (!d) throw new AccessError("err.docNotFound");
    await getService(user, d.serviceId);
    if (user.role !== "ADMIN" && d.uploadedById !== user.id) throw new AccessError();
    await prisma.leadDocument.delete({ where: { id: d.id } });
    revalidate(d.leadId, d.serviceId);
  });
}

export interface DocOption {
  id: string;
  title: string;
  type: ServiceType;
  country: string | null;
  docTypes: { id: string; name: string; saved: number }[];
}

/** Для окна «Сохранить в CRM»: открытые заявки лида этой переписки и нужные для них документы */
export async function docOptionsAction(conversationId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const conv = await prisma.conversation.findFirst({ where: { id: conversationId, ...conversationScope(user) }, include: { lead: { select: { id: true, name: true, serviceType: true, destination: true } } } });
    if (!conv) throw new AccessError("err.chatNotFound");
    if (!conv.lead) throw new ValidationError("err.chatNoLead");
    await ensureLeadServices(conv.lead);
    const services = await prisma.leadService.findMany({ where: { leadId: conv.lead.id, closed: false }, orderBy: { createdAt: "asc" }, include: { documents: { select: { docType: true } } } });
    const reqs = await requirementsFor(services);
    const options: DocOption[] = services.map((s, i) => ({
      id: s.id,
      title: "",
      type: s.type,
      country: s.country,
      docTypes: reqs[i].map((r) => ({ ...r, saved: s.documents.filter((d) => d.docType === r.name).length })),
    }));
    return { leadId: conv.lead.id, leadName: conv.lead.name, options };
  });
}

/** Сохранить вложение из переписки как документ заявки (файл копируется в CRM) */
export async function saveChatDocumentAction(input: { messageId: string; index: number; serviceId: string; docType: string }) {
  return runAction(async () => {
    const user = await requireUser();
    const msg = await prisma.chatMessage.findFirst({ where: { id: input.messageId, conversation: conversationScope(user) }, include: { conversation: { select: { leadId: true } } } });
    if (!msg) throw new AccessError("err.chatNotFound");
    const s = await getService(user, input.serviceId);
    if (s.leadId !== msg.conversation.leadId) throw new AccessError("err.serviceNotFound");
    const docType = input.docType.trim().slice(0, 120);
    if (!docType) throw new ValidationError("err.docType");
    const att = (Array.isArray(msg.attachments) ? (msg.attachments as { type?: string; fileId?: string; url?: string; name?: string }[]) : [])[input.index];
    if (!att) throw new ValidationError("err.docNoFile");

    let data: Uint8Array;
    let name = att.name || "";
    let mime = "";
    try {
      if (att.fileId) {
        const bot = telegramBot(await getTelegram());
        if (!bot) throw new ValidationError("err.chatTgOff");
        const f = await bot.download(att.fileId);
        data = new Uint8Array(f.body);
        if (!name) name = f.path.split("/").pop() || "file";
      } else if (att.url && /^https?:\/\//.test(att.url)) {
        const res = await fetch(att.url, { signal: AbortSignal.timeout(60_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        mime = res.headers.get("content-type")?.split(";")[0] ?? "";
        data = new Uint8Array(await res.arrayBuffer());
        if (!name) name = `${att.type ?? "file"}.${mime.split("/")[1] ?? "bin"}`;
      } else throw new ValidationError("err.docNoFile");
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw new ValidationError("err.docDownload", { error: e instanceof Error ? e.message : String(e) });
    }
    if (data.length > DOC_MAX) throw new ValidationError("err.chatFileTooBig");
    if (att.type === "image" && !/\.\w+$/.test(name)) name = `${name || "photo"}.jpg`;
    await prisma.leadDocument.create({
      data: { serviceId: s.id, leadId: s.leadId, docType, fileName: name.slice(0, 200), mime: guessMime(name, mime || (att.type === "image" ? "image/jpeg" : null)), size: data.length, data: Buffer.from(data), chatMessageId: msg.id, uploadedById: user.id },
    });
    revalidate(s.leadId, s.id);
  });
}

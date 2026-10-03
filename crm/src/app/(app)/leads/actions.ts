"use server";

import { revalidatePath } from "next/cache";
import type { LeadSource, ServiceType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getLeadForUser } from "@/lib/access";
import { runAction } from "@/lib/actions";
import { MANUAL_SOURCES, SERVICE_LABELS } from "@/lib/constants";
import { parseInputDate, parseInputDateTime } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { AccessError, requireUser } from "@/lib/session";
import {
  addComment,
  assignManager,
  changeStatus,
  createLead,
  deleteLead,
  editComment,
  takeLead,
  updateLeadFields,
  ValidationError,
} from "@/lib/leads/service";

function revalidateLeads(leadId?: string) {
  revalidatePath("/leads");
  revalidatePath("/kanban");
  revalidatePath("/");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);
const serviceTypes = Object.keys(SERVICE_LABELS) as [ServiceType, ...ServiceType[]];

function parseTravelers(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > 500) throw new ValidationError("err.travelers");
  return n;
}

function parseService(v: FormDataEntryValue | null): ServiceType | null {
  const s = str(v);
  if (!s) return null;
  return z.enum(serviceTypes).parse(s);
}

/** Количество заявлений — только для «Визовой поддержки», целое число от 1 */
function parseVisaApplications(formData: FormData): number | null {
  if (formData.get("serviceType") !== "VISA") return null;
  const raw = str(formData.get("visaApplications"));
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 500) throw new ValidationError("err.visaApplications");
  return n;
}

export async function createLeadAction(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const source = str(formData.get("source")) as LeadSource;
    if (!MANUAL_SOURCES.includes(source)) throw new ValidationError("err.source");
    const name = str(formData.get("name"));
    if (!name) throw new ValidationError("err.name");
    const phoneRaw = str(formData.get("phone"));
    if (!phoneRaw) throw new ValidationError("err.phone");
    if (!normalizePhone(phoneRaw)) throw new ValidationError("err.phoneUz");

    let managerId = str(formData.get("managerId"));
    if (user.role === "MANAGER") managerId = managerId === "none" ? null : user.id;
    if (managerId === "none" || managerId === "auto") managerId = null;

    const lead = await createLead(
      {
        source,
        name,
        phone: phoneRaw,
        email: str(formData.get("email")),
        serviceType: parseService(formData.get("serviceType")),
        destination: str(formData.get("destination")),
        travelFrom: parseInputDate(str(formData.get("travelFrom"))),
        travelTo: parseInputDate(str(formData.get("travelTo"))),
        travelers: parseTravelers(formData.get("travelers")),
        visaApplications: parseVisaApplications(formData),
        managerId,
        hiddenFromManagers: user.role === "ADMIN",
        comment: str(formData.get("comment")),
      },
      user.id,
    );
    revalidateLeads();
    return { id: lead!.id, isRepeat: lead!.isRepeat };
  });
}

export async function updateLeadAction(leadId: string, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await getLeadForUser(user, leadId);
    const name = str(formData.get("name"));
    if (!name) throw new ValidationError("err.name");
    const travelFrom = parseInputDate(str(formData.get("travelFrom")));
    const travelTo = parseInputDate(str(formData.get("travelTo")));
    if (travelFrom && travelTo && travelTo < travelFrom) throw new ValidationError("err.travelDates");
    await updateLeadFields(
      leadId,
      {
        name,
        phone: str(formData.get("phone")),
        email: str(formData.get("email")),
        serviceType: parseService(formData.get("serviceType")),
        destination: str(formData.get("destination")),
        travelFrom,
        travelTo,
        travelers: parseTravelers(formData.get("travelers")),
        visaApplications: parseVisaApplications(formData),
      },
      user.id,
    );
    revalidateLeads(leadId);
  });
}

export async function changeStatusAction(
  leadId: string,
  statusId: string,
  extra: { lossReasonId?: string | null; lossComment?: string | null; callbackAt?: string | null } = {},
) {
  return runAction(async () => {
    const user = await requireUser();
    await getLeadForUser(user, leadId);
    const callbackAt = extra.callbackAt ? parseInputDateTime(extra.callbackAt) : null;
    if (extra.callbackAt && !callbackAt) throw new ValidationError("err.callbackInvalid");
    await changeStatus(leadId, { statusId, lossReasonId: extra.lossReasonId, lossComment: extra.lossComment, callbackAt }, user);
    revalidateLeads(leadId);
    revalidatePath("/tasks");
  });
}

/** «Отложить» звонок на N минут от текущего момента */
export async function snoozeCallbackAction(leadId: string, minutes: number) {
  return runAction(async () => {
    const user = await requireUser();
    const lead = await getLeadForUser(user, leadId);
    const status = await prisma.leadStatus.findUniqueOrThrow({ where: { id: lead.statusId } });
    if (status.kind !== "CALLBACK") throw new ValidationError("err.notCallback");
    const m = Math.min(Math.max(Math.round(minutes), 1), 24 * 60);
    await changeStatus(leadId, { statusId: lead.statusId, callbackAt: new Date(Date.now() + m * 60_000) }, user);
    revalidateLeads(leadId);
    revalidatePath("/tasks");
  });
}

export async function takeLeadAction(leadId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await getLeadForUser(user, leadId);
    await takeLead(leadId, user);
    revalidateLeads(leadId);
  });
}

export async function assignManagerAction(leadIds: string[], managerId: string | null) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      // менеджер может назначить только себя на свои/нераспределённые лиды
      if (managerId !== user.id) throw new AccessError("err.onlyAdminAssign");
      for (const id of leadIds) {
        const lead = await getLeadForUser(user, id);
        if (lead.managerId && lead.managerId !== user.id) throw new AccessError();
      }
    }
    const n = await assignManager(leadIds, managerId, user.id);
    revalidateLeads(leadIds.length === 1 ? leadIds[0] : undefined);
    return n;
  });
}

export async function addCommentAction(leadId: string, text: string) {
  return runAction(async () => {
    const user = await requireUser();
    await getLeadForUser(user, leadId);
    await addComment(leadId, user.id, text);
    revalidateLeads(leadId);
  });
}

export async function editCommentAction(commentId: string, text: string) {
  return runAction(async () => {
    const user = await requireUser();
    const c = await editComment(commentId, user.id, text);
    revalidatePath(`/leads/${c.leadId}`);
  });
}

export async function createTaskAction(input: { leadId?: string | null; title: string; dueAt: string; assigneeId?: string | null }) {
  return runAction(async () => {
    const user = await requireUser();
    const title = input.title.trim();
    if (!title) throw new ValidationError("err.taskTitle");
    const dueAt = parseInputDateTime(input.dueAt);
    if (!dueAt) throw new ValidationError("err.dateTime");
    let assigneeId = user.id;
    if (input.leadId) {
      const lead = await getLeadForUser(user, input.leadId);
      if (user.role === "ADMIN") assigneeId = input.assigneeId || lead.managerId || user.id;
    } else if (user.role === "ADMIN" && input.assigneeId) {
      assigneeId = input.assigneeId;
    }
    await prisma.task.create({ data: { leadId: input.leadId || null, title, dueAt, assigneeId, createdById: user.id } });
    revalidatePath("/tasks");
    revalidatePath("/");
    if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  });
}

async function getTaskForUser(taskId: string) {
  const user = await requireUser();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || (user.role !== "ADMIN" && task.assigneeId !== user.id && task.createdById !== user.id)) throw new AccessError("err.taskNotFound");
  return task;
}

export async function toggleTaskAction(taskId: string) {
  return runAction(async () => {
    const task = await getTaskForUser(taskId);
    await prisma.task.update({ where: { id: taskId }, data: { doneAt: task.doneAt ? null : new Date() } });
    revalidatePath("/tasks");
    revalidatePath("/");
    if (task.leadId) revalidatePath(`/leads/${task.leadId}`);
  });
}

export async function deleteTaskAction(taskId: string) {
  return runAction(async () => {
    const task = await getTaskForUser(taskId);
    await prisma.task.delete({ where: { id: taskId } });
    revalidatePath("/tasks");
    revalidatePath("/");
    if (task.leadId) revalidatePath(`/leads/${task.leadId}`);
  });
}

/** Удаление лида — только администратор */
export async function deleteLeadAction(leadId: string) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new AccessError("err.onlyAdminLeads");
    const r = await deleteLead(leadId);
    revalidateLeads();
    revalidatePath("/clients");
    revalidatePath("/tasks");
    revalidatePath("/reports");
    return r;
  });
}

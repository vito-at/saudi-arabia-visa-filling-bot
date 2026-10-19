/**
 * Заявки по лиду (виза в страну, авиабилеты, тур) и документы клиента.
 * Список нужных документов зависит от заявки: для визы — от страны (если для неё задан свой список), иначе общий для типа услуги.
 * Визовая заявка, переданная визовым специалистам, ведётся ими по этапам: новая → в процессе → оплачено/ждём результат
 * (или запрос доп. документов) → одобрена / отказ.
 */
import crypto from "node:crypto";
import type { LeadService, Prisma, ServiceType, VisaStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/access";
export { guessMime } from "@/lib/mime";
import type { CurrentUser } from "@/lib/session";

export const VISA_STATUSES: VisaStatus[] = ["NEW", "IN_PROGRESS", "PAID_WAITING", "DOCS_REQUESTED", "APPROVED", "REJECTED"];
export const FINAL_VISA: VisaStatus[] = ["APPROVED", "REJECTED"];

/** Документы по умолчанию — администратор меняет их в «Настройки → Визы и документы» */
export const DEFAULT_REQUIREMENTS: { type: ServiceType; country: string | null; names: string[] }[] = [
  {
    type: "VISA",
    country: null,
    names: ["Заграничный паспорт", "Фото 3,5×4,5", "Справка из банка о наличии средств", "Справка с места работы", "Бронь авиабилетов", "Бронь отеля", "Медицинская страховка"],
  },
  { type: "FLIGHTS", country: null, names: ["Заграничный паспорт", "Авиабилет"] },
  { type: "TOUR", country: null, names: ["Заграничный паспорт", "Свидетельство о рождении (для детей)", "Ваучер", "Авиабилет"] },
  { type: "OTHER", country: null, names: ["Документ"] },
];

/** При первом обращении заполняем списки документов по умолчанию */
export async function ensureDocDefaults() {
  if (await prisma.docRequirement.count()) return;
  await prisma.docRequirement.createMany({
    data: DEFAULT_REQUIREMENTS.flatMap((g) => g.names.map((name, i) => ({ type: g.type, country: g.country, name, order: i + 1 }))),
  });
}

export interface DocTypeView {
  id: string;
  name: string;
}

/** Нужные документы для заявки: свой список страны, если он есть, иначе общий для типа услуги */
export async function requirementsFor(services: Pick<LeadService, "type" | "country">[]): Promise<DocTypeView[][]> {
  await ensureDocDefaults();
  const all = await prisma.docRequirement.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  return services.map((s) => {
    const own = s.country ? all.filter((r) => r.type === s.type && r.country?.toLowerCase() === s.country!.toLowerCase()) : [];
    const list = own.length ? own : all.filter((r) => r.type === s.type && r.country === null);
    return list.map((r) => ({ id: r.id, name: r.name }));
  });
}

/**
 * У лида ещё нет заявок, но известен тип услуги — создаём первую заявку из лида
 * (для визы страна берётся из направления: лид по рекламе визы в Таиланд → заявка «Виза: Таиланд»).
 */
export async function ensureLeadServices(lead: { id: string; serviceType: ServiceType | null; destination: string | null }) {
  if (!lead.serviceType) return;
  const n = await prisma.leadService.count({ where: { leadId: lead.id } });
  if (n) return;
  await prisma.leadService.create({ data: { leadId: lead.id, type: lead.serviceType, country: lead.destination?.trim() || null } });
}

/** Визовые заявки, которые видит визовый специалист: только переданные ему */
export const handedVisa: Prisma.LeadServiceWhereInput = { type: "VISA", handedAt: { not: null } };

/** Какие заявки видит пользователь: админ — все, визовый специалист — переданные визы, менеджер — заявки своих лидов */
export function serviceScope(user: CurrentUser): Prisma.LeadServiceWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "VISA") return handedVisa;
  return { lead: leadScope(user) };
}

export function documentScope(user: CurrentUser): Prisma.LeadDocumentWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "VISA") return { service: handedVisa };
  return { lead: leadScope(user) };
}

/** Документы клиенту: до 20 МБ */
export const DOC_MAX = 20 * 1024 * 1024;


/** Ключ API сайта храним только хэшем */
export const hashSiteKey = (key: string) => crypto.createHash("sha256").update(key).digest("hex");

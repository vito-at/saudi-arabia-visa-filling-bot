/** Заявки и документы для интерфейса (карточка лида, кабинет визового специалиста) */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirementsFor } from "@/lib/visa";

export interface DocView {
  id: string;
  docType: string;
  fileName: string;
  size: number;
  mime: string;
  at: string;
  by: string | null;
  byId: string | null;
  fromChat: boolean;
  /** документ с сайта: турист */
  traveler: string | null;
  fromSite: boolean;
}

export interface ServiceView {
  id: string;
  leadId: string;
  type: "FLIGHTS" | "TOUR" | "VISA" | "OTHER";
  country: string | null;
  note: string | null;
  status: "NEW" | "IN_PROGRESS" | "PAID_WAITING" | "DOCS_REQUESTED" | "APPROVED" | "REJECTED";
  closed: boolean;
  handed: boolean;
  source: "SALES" | "WEBSITE";
  assignee: string | null;
  /** последний комментарий визового специалиста (например, какие документы донести) */
  lastComment: { text: string; at: string; by: string | null } | null;
  /** нужные документы и загруженные по каждому */
  required: { name: string; docs: DocView[] }[];
  /** документы вне списка («Другой документ») */
  extra: DocView[];
}

const include = {
  assignee: { select: { name: true } },
  events: { where: { comment: { not: null } }, orderBy: { createdAt: "desc" }, take: 1, select: { comment: true, createdAt: true, user: { select: { name: true } } } },
  documents: { orderBy: { createdAt: "asc" }, select: { id: true, docType: true, fileName: true, size: true, mime: true, createdAt: true, chatMessageId: true, uploadedById: true, externalId: true, travelerName: true, uploadedBy: { select: { name: true } } } },
} satisfies Prisma.LeadServiceInclude;

export async function loadServiceViews(where: Prisma.LeadServiceWhereInput): Promise<ServiceView[]> {
  const rows = await prisma.leadService.findMany({ where, orderBy: [{ closed: "asc" }, { createdAt: "asc" }], include });
  const reqs = await requirementsFor(rows);
  return rows.map((s, i) => {
    const docs: DocView[] = s.documents.map((d) => ({ id: d.id, docType: d.docType, fileName: d.fileName, size: d.size, mime: d.mime, at: formatDateTime(d.createdAt), by: d.uploadedBy?.name ?? null, byId: d.uploadedById, fromChat: !!d.chatMessageId, traveler: d.travelerName, fromSite: !!d.externalId }));
    // заявка с сайта: список документов задаёт сайт (по стране и типу визы) — показываем то, что прислал клиент
    const names = s.externalId ? [] : reqs[i].map((r) => r.name);
    return {
      id: s.id,
      leadId: s.leadId,
      type: s.type,
      country: s.country,
      note: s.note,
      status: s.status,
      closed: s.closed,
      handed: !!s.handedAt,
      source: s.source,
      assignee: s.assignee?.name ?? null,
      lastComment: s.events[0]?.comment ? { text: s.events[0].comment, at: formatDateTime(s.events[0].createdAt), by: s.events[0].user?.name ?? null } : null,
      required: names.map((name) => ({ name, docs: docs.filter((d) => d.docType === name) })),
      extra: docs.filter((d) => !names.includes(d.docType)),
    };
  });
}

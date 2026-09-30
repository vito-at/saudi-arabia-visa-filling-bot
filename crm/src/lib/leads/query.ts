import type { LeadSource, Prisma } from "@prisma/client";
import { SOURCE_LABELS } from "@/lib/constants";
import { resolvePeriod } from "@/lib/period";

export type SearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 50;

export function sp(params: SearchParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v || undefined;
}

/** Фильтры таблицы лидов из query-параметров */
export function buildLeadWhere(params: SearchParams): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [];
  const q = sp(params, "q")?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    const or: Prisma.LeadWhereInput[] = [{ name: { contains: q, mode: "insensitive" } }];
    if (digits.length >= 3) or.push({ phone: { contains: digits } });
    and.push({ OR: or });
  }
  const status = sp(params, "status");
  if (status) and.push({ statusId: status });
  const manager = sp(params, "manager");
  if (manager === "none") and.push({ managerId: null });
  else if (manager) and.push({ managerId: manager });
  const source = sp(params, "source");
  if (source && source in SOURCE_LABELS) and.push({ source: source as LeadSource });
  const campaign = sp(params, "campaign");
  if (campaign) and.push({ campaignId: campaign });
  const form = sp(params, "form");
  if (form) and.push({ formId: form });
  const period = sp(params, "period");
  if (period && period !== "all") {
    const p = resolvePeriod(period, sp(params, "from"), sp(params, "to"));
    and.push({ createdAt: { gte: p.from, lt: p.to } });
  }
  if (sp(params, "repeat") === "1") and.push({ isRepeat: true });
  return and.length ? { AND: and } : {};
}

const SORTS = {
  createdAt: (dir: Prisma.SortOrder) => ({ createdAt: dir }),
  name: (dir: Prisma.SortOrder) => ({ name: dir }),
  status: (dir: Prisma.SortOrder) => ({ status: { order: dir } }),
  manager: (dir: Prisma.SortOrder) => ({ manager: { name: dir } }),
  campaign: (dir: Prisma.SortOrder) => ({ campaignName: dir }),
  statusChangedAt: (dir: Prisma.SortOrder) => ({ statusChangedAt: dir }),
} satisfies Record<string, (d: Prisma.SortOrder) => Prisma.LeadOrderByWithRelationInput>;

export function buildLeadOrder(params: SearchParams): Prisma.LeadOrderByWithRelationInput[] {
  const key = (sp(params, "sort") ?? "createdAt") as keyof typeof SORTS;
  const dir: Prisma.SortOrder = sp(params, "dir") === "asc" ? "asc" : "desc";
  const fn = SORTS[key] ?? SORTS.createdAt;
  return [fn(dir), { id: "desc" }];
}

/** Лид «горит», если он в статусе «Новый» дольше порога */
export function isOverdueNew(lead: { createdAt: Date; status: { kind: string } }, thresholdMin: number, now = new Date()) {
  return lead.status.kind === "NEW" && now.getTime() - lead.createdAt.getTime() > thresholdMin * 60_000;
}

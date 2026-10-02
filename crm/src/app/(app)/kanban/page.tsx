import { isRegularClient } from "@/lib/constants";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { KanbanBoard, type KanbanCard } from "@/components/kanban/kanban-board";
import { KanbanFilters } from "@/components/kanban/kanban-filters";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/access";
import { reasonName, sourceLabel, statusName } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { toNum } from "@/lib/money";
import { getLossReasons, getManagers, getSettings, getStatuses } from "@/lib/refs";
import { isOverdueNew, sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import type { Prisma } from "@prisma/client";

const PER_COLUMN = 60;
const CLOSED_DAYS = 30;

export default async function KanbanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { t } = await getI18n();
  const [statuses, reasons, users, settings] = await Promise.all([getStatuses(), getLossReasons(), getManagers(), getSettings()]);

  const filters: Prisma.LeadWhereInput[] = [leadScope(user)];
  const manager = sp(params, "manager");
  if (manager === "none") filters.push({ managerId: null });
  else if (manager) filters.push({ managerId: manager });
  const q = sp(params, "q");
  if (q) filters.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || q } }] });

  // закрытые (продано/отказ) показываем только за последние 30 дней, чтобы доска не разрасталась
  const closedSince = new Date(Date.now() - CLOSED_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  const columns = await Promise.all(
    statuses.map(async (s) => {
      const where: Prisma.LeadWhereInput = {
        AND: [...filters, { statusId: s.id }, s.kind === "WON" || s.kind === "LOST" ? { statusChangedAt: { gte: closedSince } } : {}],
      };
      const [total, leads] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({ where, orderBy: { statusChangedAt: "desc" }, take: PER_COLUMN, include: { status: true, manager: { select: { name: true } }, client: { select: { _count: { select: { deals: true } } } } } }),
      ]);
      return { status: s, total, leads };
    }),
  );

  const cards: KanbanCard[] = columns.flatMap(({ leads }) =>
    leads.map((l) => ({
      id: l.id,
      statusId: l.statusId,
      name: l.name,
      phone: l.phone ?? l.phoneRaw,
      manager: l.manager?.name ?? null,
      destination: l.destination,
      createdAt: l.createdAt.toISOString(),
      isRepeat: l.isRepeat,
      isRegular: isRegularClient(l.client._count.deals),
      source: sourceLabel(t, l.source),
      callbackAt: l.status.kind === "CALLBACK" && l.callbackAt ? l.callbackAt.toISOString() : null,
      overdueMin: isOverdueNew(l, settings.unprocessedAlertMin, now) ? Math.round((now.getTime() - l.createdAt.getTime()) / 60000) : null,
    })),
  );

  return (
    <div>
      <PageHeader
        title={t("kanban.title")}
        description={t("kanban.description", { days: CLOSED_DAYS })}
        actions={
          <Suspense>
            <KanbanFilters managers={user.role === "ADMIN" ? users.map((u) => ({ id: u.id, name: u.name })) : null} />
          </Suspense>
        }
      />
      <KanbanBoard
        statuses={columns.map(({ status: s, total }) => ({ id: s.id, name: statusName(t, s.name), color: s.color, kind: s.kind, total }))}
        cards={cards}
        reasons={reasons.map((r) => ({ id: r.id, name: reasonName(t, r.name) }))}
        rate={toNum(settings.usdRate)}
      />
    </div>
  );
}

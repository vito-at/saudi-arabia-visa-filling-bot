import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { LeadsTable, type LeadRow } from "@/components/leads/leads-table";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { SyncNowButton } from "@/components/leads/sync-now-button";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/access";
import { SOURCE_LABELS } from "@/lib/constants";
import { getAdFilters, getManagers, getSettings, getStatuses } from "@/lib/refs";
import { buildLeadOrder, buildLeadWhere, isOverdueNew, PAGE_SIZE, sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const page = Math.max(1, Number(sp(params, "page")) || 1);
  const where = { AND: [leadScope(user), buildLeadWhere(params)] };

  const [total, leads, statuses, users, settings, ad, meta] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: buildLeadOrder(params),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { status: true, manager: { select: { name: true } } },
    }),
    getStatuses(),
    getManagers(),
    getSettings(),
    getAdFilters(),
    prisma.metaIntegration.findUnique({ where: { id: 1 } }),
  ]);
  const managers = users.filter((u) => u.role === "MANAGER" || isAdmin);
  const now = new Date();

  const rows: LeadRow[] = leads.map((l) => {
    const overdue = isOverdueNew(l, settings.unprocessedAlertMin, now);
    return {
      id: l.id,
      name: l.name,
      phone: l.phone ?? l.phoneRaw,
      createdAt: l.createdAt.toISOString(),
      source: SOURCE_LABELS[l.source],
      status: { name: l.status.name, color: l.status.color, kind: l.status.kind },
      manager: l.manager?.name ?? null,
      managerId: l.managerId,
      campaign: l.campaignName,
      destination: l.destination,
      isRepeat: l.isRepeat,
      isNew: l.status.kind === "NEW",
      overdueMin: overdue ? Math.round((now.getTime() - l.createdAt.getTime()) / 60000) : null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Лиды"
        description={isAdmin ? "Все обращения клиентов" : "Ваши лиды и нераспределённые"}
        actions={
          <>
            {isAdmin && meta?.enabled && <SyncNowButton />}
            <NewLeadDialog managers={users.filter((u) => u.role === "MANAGER")} isAdmin={isAdmin} roundRobin={settings.distributionMode === "ROUND_ROBIN"} />
          </>
        }
      />
      <Card>
        <div className="border-b p-4">
          <Suspense>
            <LeadsFilters
              statuses={statuses.map((s) => ({ id: s.id, name: s.name }))}
              managers={managers.map((m) => ({ id: m.id, name: m.name }))}
              sources={Object.entries(SOURCE_LABELS).map(([id, name]) => ({ id, name }))}
              campaigns={ad.campaigns}
              forms={ad.forms}
              showManager={isAdmin}
            />
          </Suspense>
        </div>
        <Suspense>
          <LeadsTable rows={rows} managers={managers.map((m) => ({ id: m.id, name: m.name }))} isAdmin={isAdmin} currentUserId={user.id} />
        </Suspense>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={params} basePath="/leads" />
      </Card>
    </div>
  );
}

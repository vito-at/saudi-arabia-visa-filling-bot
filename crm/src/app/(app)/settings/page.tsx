import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntegrationForm } from "@/components/settings/integration-form";
import { GeneralForm } from "@/components/settings/general-form";
import { StatusesEditor } from "@/components/settings/statuses-editor";
import { ReasonsEditor } from "@/components/settings/reasons-editor";
import { UsersEditor } from "@/components/settings/users-editor";
import { toNum } from "@/lib/money";
import { rateSources } from "@/lib/rates";
import { getSettings } from "@/lib/refs";
import { SyncLogTable } from "@/components/settings/sync-log";
import { prisma } from "@/lib/db";
import { decrypt, maskSecret } from "@/lib/crypto";
import { formatDate, formatDateTime } from "@/lib/format";
import { GRAPH_VERSION } from "@/lib/meta/graph";
import { getIntegration } from "@/lib/meta/integration";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { TKey } from "@/i18n/core";
import { getI18n } from "@/i18n/server";

const TABS = {
  general: "settings.tab.general",
  statuses: "settings.tab.statuses",
  reasons: "settings.tab.reasons",
  users: "settings.tab.users",
  integration: "settings.tab.integration",
  sync: "settings.tab.sync",
} as const satisfies Record<string, TKey>;
type Tab = keyof typeof TABS;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { t } = await getI18n();
  const params = await searchParams;
  const tab = (sp(params, "tab") ?? "general") as Tab;
  const active: Tab = tab in TABS ? tab : "general";

  return (
    <div className="max-w-5xl">
      <PageHeader title={t("settings.title")} />
      <div className="no-scrollbar -mx-3 mb-5 flex gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain whitespace-nowrap px-3 shadow-[inset_0_-1px_0_var(--border)] sm:mx-0 sm:px-0">
        {(Object.keys(TABS) as Tab[]).map((k) => (
          <Link
            key={k}
            href={`/settings?tab=${k}`}
            className={cn("shrink-0 border-b-2 px-3 py-2 text-sm", active === k ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t(TABS[k])}
          </Link>
        ))}
      </div>
      {active === "integration" && <IntegrationTab />}
      {active === "sync" && <SyncTab />}
      {active === "general" && <GeneralTab />}
      {active === "statuses" && <StatusesTab />}
      {active === "reasons" && <ReasonsTab />}
      {active === "users" && <UsersTab />}
    </div>
  );
}

async function IntegrationTab() {
  const { t } = await getI18n();
  const i = await getIntegration();
  const capiCounts = await prisma.conversionEvent.groupBy({ by: ["status"], _count: { _all: true } });
  const capiCount = (st: string) => capiCounts.find((c) => c.status === st)?._count._all ?? 0;
  const capiStats = { sent: capiCount("SENT"), pending: capiCount("PENDING"), failed: capiCount("FAILED") };
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  let pageTokenMask = "";
  try {
    pageTokenMask = maskSecret(decrypt(i.pageTokenEnc));
  } catch {
    pageTokenMask = t("settings.decryptFailed");
  }
  return (
    <div className="space-y-5">
      {i.enabled && !i.tokenValid && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <b>{t("settings.tokenInvalid")}</b> {i.tokenError} {t("settings.tokenInvalidHint")}
          </div>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Meta Lead Ads</CardTitle>
          <div className="text-xs text-muted-foreground">
            Graph API {GRAPH_VERSION}
            {i.lastSyncAt && ` · ${t("settings.lastSync", { date: formatDateTime(i.lastSyncAt) })}`}
            {i.tokenExpiresAt && ` · ${t("settings.tokenUntil", { date: formatDate(i.tokenExpiresAt) })}`}
          </div>
        </CardHeader>
        <CardContent>
          <IntegrationForm
            v={{
              appId: i.appId ?? "",
              pageId: i.pageId ?? "",
              adAccountId: i.adAccountId ?? "",
              verifyToken: i.verifyToken ?? "",
              pollIntervalMin: i.pollIntervalMin,
              initialDays: i.initialDays,
              enabled: i.enabled,
              hasAppSecret: !!i.appSecretEnc,
              pageTokenMask,
              hasAdsToken: !!i.adsTokenEnc,
              webhookUrl: `${base}/api/webhooks/meta`,
              capiDatasetId: i.capiDatasetId ?? "",
              hasCapiToken: !!i.capiTokenEnc,
              capiTestCode: i.capiTestCode ?? "",
              capiEnabled: i.capiEnabled,
              capiStats,
              capiLastError: i.capiLastError,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

async function SyncTab() {
  const { t } = await getI18n();
  const logs = await prisma.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.last100")}</CardTitle>
      </CardHeader>
      <SyncLogTable logs={logs} />
    </Card>
  );
}

async function GeneralTab() {
  const [s, managersCount] = await Promise.all([getSettings(), prisma.user.count({ where: { role: "MANAGER", isActive: true } })]);
  return (
    <GeneralForm
      v={{
        distributionMode: s.distributionMode,
        unprocessedAlertMin: s.unprocessedAlertMin,
        usdRate: toNum(s.usdRate),
        usdRateSource: s.usdRateSource,
        usdRateCost: toNum(s.usdRateCost),
        usdRateUpdatedAt: s.usdRateUpdatedAt?.toISOString() ?? null,
        usdRateError: s.usdRateError,
        managersCount,
        rateSources: rateSources(),
      }}
    />
  );
}

async function StatusesTab() {
  const { t } = await getI18n();
  const statuses = await prisma.leadStatus.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { leads: true } } } });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.statusesTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <StatusesEditor statuses={statuses.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind, isSystem: s.isSystem, inFunnel: s.inFunnel, leads: s._count.leads }))} />
      </CardContent>
    </Card>
  );
}

async function ReasonsTab() {
  const { t } = await getI18n();
  const reasons = await prisma.lossReason.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { leads: true } } } });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.reasonsTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ReasonsEditor reasons={reasons.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive, leads: r._count.leads }))} />
      </CardContent>
    </Card>
  );
}

async function UsersTab() {
  const { t } = await getI18n();
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    include: { _count: { select: { leads: { where: { status: { kind: { notIn: ["WON", "LOST"] } } } } } } },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.usersTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <UsersEditor
          users={users.map((u) => ({ id: u.id, login: u.login, name: u.name, role: u.role, isActive: u.isActive, createdAt: u.createdAt.toISOString(), activeLeads: u._count.leads }))}
        />
      </CardContent>
    </Card>
  );
}

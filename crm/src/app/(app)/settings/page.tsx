import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntegrationForm } from "@/components/settings/integration-form";
import { SyncLogTable } from "@/components/settings/sync-log";
import { prisma } from "@/lib/db";
import { decrypt, maskSecret } from "@/lib/crypto";
import { formatDate, formatDateTime } from "@/lib/format";
import { GRAPH_VERSION } from "@/lib/meta/graph";
import { getIntegration } from "@/lib/meta/integration";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

const TABS = {
  general: "Общие",
  statuses: "Статусы",
  reasons: "Причины отказа",
  users: "Пользователи",
  integration: "Интеграция с Meta",
  sync: "Журнал синхронизаций",
} as const;
type Tab = keyof typeof TABS;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;
  const tab = (sp(params, "tab") ?? "general") as Tab;
  const active: Tab = tab in TABS ? tab : "general";

  return (
    <div className="max-w-5xl">
      <PageHeader title="Настройки" />
      <div className="mb-5 flex gap-1 border-b">
        {(Object.keys(TABS) as Tab[]).map((k) => (
          <Link
            key={k}
            href={`/settings?tab=${k}`}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", active === k ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {TABS[k]}
          </Link>
        ))}
      </div>
      {active === "integration" && <IntegrationTab />}
      {active === "sync" && <SyncTab />}
      {!["integration", "sync"].includes(active) && <p className="text-sm text-muted-foreground">Раздел в разработке</p>}
    </div>
  );
}

async function IntegrationTab() {
  const i = await getIntegration();
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  let pageTokenMask = "";
  try {
    pageTokenMask = maskSecret(decrypt(i.pageTokenEnc));
  } catch {
    pageTokenMask = "не удаётся расшифровать — проверьте ENCRYPTION_KEY";
  }
  return (
    <div className="space-y-5">
      {i.enabled && !i.tokenValid && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <b>Токен недействителен.</b> {i.tokenError} Сгенерируйте новый долгосрочный Page Access Token (см. README) и вставьте его ниже.
          </div>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Meta Lead Ads</CardTitle>
          <div className="text-xs text-muted-foreground">
            Graph API {GRAPH_VERSION}
            {i.lastSyncAt && ` · последняя синхронизация ${formatDateTime(i.lastSyncAt)}`}
            {i.tokenExpiresAt && ` · токен до ${formatDate(i.tokenExpiresAt)}`}
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
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

async function SyncTab() {
  const logs = await prisma.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Последние 100 синхронизаций</CardTitle>
      </CardHeader>
      <SyncLogTable logs={logs} />
    </Card>
  );
}

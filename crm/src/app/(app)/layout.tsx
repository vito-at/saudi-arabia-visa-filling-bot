import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { signOut } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { CallbackReminders } from "@/components/callbacks/callback-reminders";
import { RateNotice } from "@/components/layout/rate-notice";
import { RoleProvider } from "@/components/layout/role-context";
import { formatDate, formatNumber, toInputDate } from "@/lib/format";
import { isRateStale } from "@/lib/rates";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/access";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = await getI18n();

  const [newLeads, tasks, meta, settings, pendingCosts] = await Promise.all([
    prisma.lead.count({ where: { ...leadScope(user), status: { kind: "NEW" } } }),
    prisma.task.count({ where: { assigneeId: user.id, doneAt: null, dueAt: { lt: endOfDayTashkent() } } }),
    prisma.metaIntegration.findUnique({ where: { id: 1 } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    // сделки, закрытые менеджерами без себестоимости, — счётчик у «Финансов» для администратора
    user.role === "ADMIN" ? prisma.deal.count({ where: { costConfirmed: false } }) : Promise.resolve(0),
  ]);
  const rateStale = settings?.usdRateSource === "IPAK_YULI" && isRateStale(settings.usdRateUpdatedAt) && !!settings.usdRateError;

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const tokenProblem = meta?.enabled && !meta.tokenValid;

  return (
    <RoleProvider role={user.role} costRate={Number(settings?.usdRateCost ?? 0)}>
    <div className="min-h-screen">
      <Sidebar
        user={user}
        counters={{ leads: newLeads, tasks, finance: pendingCosts }}
        rate={{ value: Number(settings?.usdRateCost ?? 0), updatedAt: settings?.usdRateUpdatedAt?.toISOString() ?? null }}
        logout={logout}
      />
      <main className="lg:pl-60">
        {tokenProblem && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 lg:px-8">
            <AlertTriangle className="size-5 shrink-0" />
            <div className="flex-1">
              <b>{t("banner.metaDown")}</b> {t("banner.metaDownText")}
              {meta?.tokenError && <span className="text-red-700/80"> ({meta.tokenError})</span>}
            </div>
            {user.role === "ADMIN" ? (
              <Link href="/settings?tab=integration" className="font-medium underline">
                {t("banner.updateToken")}
              </Link>
            ) : (
              <span>{t("banner.tellAdmin")}</span>
            )}
          </div>
        )}
        {pendingCosts > 0 && (
          <Link
            href="/finance"
            title={t("banner.costPendingText")}
            className="flex items-center gap-1.5 border-b border-amber-100 bg-amber-50/60 px-4 py-1 text-xs text-amber-800 hover:bg-amber-50 lg:px-8"
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="truncate">
              {t("banner.costPending", { n: pendingCosts })} · <span className="underline">{t("banner.costPendingLink")}</span>
            </span>
          </Link>
        )}
        <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 lg:px-8 lg:py-6">{children}</div>
      </main>
      <CallbackReminders />
      {rateStale && settings && (
        <RateNotice
          day={toInputDate(new Date())}
          rate={formatNumber(Number(settings.usdRate), 2)}
          since={settings.usdRateUpdatedAt ? formatDate(settings.usdRateUpdatedAt) : null}
          isAdmin={user.role === "ADMIN"}
        />
      )}
    </div>
    </RoleProvider>
  );
}

function endOfDayTashkent() {
  const now = new Date();
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(now);
  return new Date(new Date(`${d}T00:00:00+05:00`).getTime() + 24 * 60 * 60 * 1000);
}

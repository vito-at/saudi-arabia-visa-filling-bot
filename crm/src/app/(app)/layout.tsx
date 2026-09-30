import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { signOut } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/access";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [newLeads, tasks, meta] = await Promise.all([
    prisma.lead.count({ where: { ...leadScope(user), status: { kind: "NEW" } } }),
    prisma.task.count({ where: { assigneeId: user.id, doneAt: null, dueAt: { lt: endOfDayTashkent() } } }),
    prisma.metaIntegration.findUnique({ where: { id: 1 } }),
  ]);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const tokenProblem = meta?.enabled && !meta.tokenValid;

  return (
    <div className="min-h-screen">
      <Sidebar user={user} counters={{ leads: newLeads, tasks }} logout={logout} />
      <main className="pl-60">
        {tokenProblem && (
          <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-8 py-3 text-sm text-red-800">
            <AlertTriangle className="size-5 shrink-0" />
            <div className="flex-1">
              <b>Интеграция с Meta не работает:</b> токен доступа истёк или отозван — новые лиды из рекламы не загружаются.
              {meta?.tokenError && <span className="text-red-700/80"> ({meta.tokenError})</span>}
            </div>
            {user.role === "ADMIN" ? (
              <Link href="/settings?tab=integration" className="font-medium underline">
                Обновить токен
              </Link>
            ) : (
              <span>Сообщите администратору.</span>
            )}
          </div>
        )}
        <div className="mx-auto max-w-[1600px] px-8 py-6">{children}</div>
      </main>
    </div>
  );
}

function endOfDayTashkent() {
  const now = new Date();
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(now);
  return new Date(new Date(`${d}T00:00:00+05:00`).getTime() + 24 * 60 * 60 * 1000);
}

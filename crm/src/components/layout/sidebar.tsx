"use client";

import { RateWidget } from "./rate-widget";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, CheckSquare, Inbox, LayoutDashboard, LogOut, Megaphone, Menu, Settings, Users, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/core";

const NAV = [
  { href: "/", label: "nav.dashboard", icon: LayoutDashboard, badge: null },
  { href: "/leads", label: "nav.leads", icon: Inbox, badge: "leads" },
  // канбан убран из меню (менеджеры им не пользуются); страница осталась по адресу /kanban — вернуть можно этой строкой:
  // { href: "/kanban", label: "nav.kanban", icon: Columns3, badge: null },
  { href: "/clients", label: "nav.clients", icon: Users, badge: null },
  { href: "/tasks", label: "nav.tasks", icon: CheckSquare, badge: "tasks" },
  { href: "/reports", label: "nav.reports", icon: BarChart3, badge: null },
  { href: "/ads", label: "nav.ads", icon: Megaphone, badge: null, admin: true },
  { href: "/finance", label: "nav.finance", icon: Wallet, badge: "finance", admin: true },
  { href: "/settings", label: "nav.settings", icon: Settings, badge: null, admin: true },
] as const;

type SidebarProps = {
  user: { name: string; role: "ADMIN" | "MANAGER" };
  counters: { leads: number; tasks: number; finance: number };
  /** курс $ для расчёта цен клиентам */
  rate: { value: number; updatedAt: string | null };
  logout: () => Promise<void>;
};

/** Боковое меню: на компьютере закреплено слева, на телефоне — верхняя панель и выезжающее меню */
export function Sidebar(props: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // меню закрывается при переходе на другую страницу
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  const total = props.counters.leads;

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarContent {...props} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar px-3 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label={t("nav.menu")} className="relative rounded-md p-2 text-foreground hover:bg-sidebar-hover cursor-pointer">
          <Menu className="size-5" />
          {total > 0 && <span className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-brand ring-2 ring-sidebar" />}
        </button>
        <Link href="/" aria-label={t("common.home")}>
          <Logo className="h-7" />
        </Link>
        {total > 0 && (
          <Link href="/leads" className="ml-auto rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">
            {t("nav.leads")} · {total}
          </Link>
        )}
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl">
            <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="absolute right-2 top-3 rounded-md p-2 text-sidebar-muted hover:bg-sidebar-hover cursor-pointer">
              <X className="size-5" />
            </button>
            <SidebarContent {...props} />
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarContent({ user, counters, logout, rate }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <>
      <Link href="/" className="block px-5 pb-4 pt-5" aria-label={t("common.home")}>
        <Logo className="h-10" />
        <div className="mt-1.5 pl-0.5 text-[11px] uppercase tracking-wider text-sidebar-muted">{t("nav.tagline")}</div>
      </Link>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.filter((n) => !("admin" in n) || user.role === "ADMIN").map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const count = item.badge ? counters[item.badge] : 0;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors lg:py-2",
                active ? "bg-sidebar-active font-medium text-sidebar-active-foreground" : "hover:bg-sidebar-hover hover:text-foreground",
              )}
            >
              {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" />}
              <Icon className="size-4" />
              <span className="flex-1">{t(item.label as TKey)}</span>
              {count > 0 && (
                <span className={cn("rounded-full px-1.5 text-xs font-semibold text-white", item.badge === "leads" ? "bg-brand" : "bg-amber-500")}>{count}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-sidebar-border p-3">
        <RateWidget rate={rate.value} updatedAt={rate.updatedAt} />
        <ThemeToggle />
        <LanguageSwitcher />
        <div className="flex items-center gap-3 px-1">
          <div className="flex size-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
            <div className="text-xs text-sidebar-muted">{t(user.role === "ADMIN" ? "role.ADMIN" : "role.MANAGER")}</div>
          </div>
          <form action={logout}>
            <button type="submit" title={t("nav.logout")} className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-foreground cursor-pointer">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

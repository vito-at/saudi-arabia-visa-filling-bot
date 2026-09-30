"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CheckSquare, Columns3, LayoutDashboard, LogOut, Settings, Users, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard, badge: null },
  { href: "/leads", label: "Лиды", icon: Inbox, badge: "leads" },
  { href: "/kanban", label: "Канбан", icon: Columns3, badge: null },
  { href: "/clients", label: "Клиенты", icon: Users, badge: null },
  { href: "/tasks", label: "Задачи", icon: CheckSquare, badge: "tasks" },
  { href: "/reports", label: "Отчёты", icon: BarChart3, badge: null },
  { href: "/settings", label: "Настройки", icon: Settings, badge: null, admin: true },
] as const;

export function Sidebar({
  user,
  counters,
  logout,
}: {
  user: { name: string; role: "ADMIN" | "MANAGER" };
  counters: { leads: number; tasks: number };
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <Link href="/" className="block px-5 pb-4 pt-5" aria-label="На главную">
        <Logo className="h-10" />
        <div className="mt-1.5 pl-0.5 text-[11px] uppercase tracking-wider text-sidebar-muted">CRM · Фергана</div>
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
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-sidebar-active font-medium text-sidebar-active-foreground" : "hover:bg-sidebar-hover hover:text-foreground",
              )}
            >
              {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" />}
              <Icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className={cn("rounded-full px-1.5 text-xs font-semibold text-white", item.badge === "tasks" ? "bg-amber-500" : "bg-brand")}>{count}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-sidebar-border p-3">
        <ThemeToggle />
        <div className="flex items-center gap-3 px-1">
          <div className="flex size-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
            <div className="text-xs text-sidebar-muted">{user.role === "ADMIN" ? "Администратор" : "Менеджер"}</div>
          </div>
          <form action={logout}>
            <button type="submit" title="Выйти" className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-foreground cursor-pointer">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

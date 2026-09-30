"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CheckSquare, Columns3, LayoutDashboard, LogOut, Settings, Users, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-[var(--sidebar)] text-slate-300">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary font-bold text-white">OT</div>
        <div>
          <div className="text-sm font-semibold text-white">Orient Travel</div>
          <div className="text-xs text-slate-400">CRM · Фергана</div>
        </div>
      </div>
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className={cn("rounded-full px-1.5 text-xs font-semibold", item.badge === "tasks" ? "bg-amber-500 text-white" : "bg-sky-500 text-white")}>
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-white">{user.name}</div>
            <div className="text-xs text-slate-400">{user.role === "ADMIN" ? "Администратор" : "Менеджер"}</div>
          </div>
          <form action={logout}>
            <button type="submit" title="Выйти" className="rounded-md p-1.5 hover:bg-white/10 hover:text-white cursor-pointer">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

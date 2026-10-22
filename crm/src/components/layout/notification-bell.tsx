"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/core";

interface Item {
  id: string;
  type: string;
  data: Record<string, string | number | null> | null;
  link: string | null;
  read: boolean;
  at: string;
}

/** Колокольчик: новые лиды, просроченные задачи, сроки долгов, продажи без себестоимости, сообщения. Обновление раз в минуту. */
export function NotificationBell({ className }: { className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  // на компьютере окно позиционируется от колокольчика поверх всей страницы:
  // боковая панель прокручивается и обрезала бы его
  const [pos, setPos] = useState<React.CSSProperties | undefined>();
  const pathname = usePathname();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { items: Item[]; unread: number };
      setItems(j.items);
      setUnread(j.unread);
    } catch {
      /* нет сети — попробуем позже */
    }
  }, []);
  useEffect(() => {
    void load();
    const id = setInterval(() => document.visibilityState === "visible" && void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  function toggle() {
    const r = btn.current?.getBoundingClientRect();
    if (!open && r && window.innerWidth >= 640) {
      const width = Math.min(384, window.innerWidth - 16);
      const top = r.bottom + 6;
      setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width, maxHeight: Math.min(window.innerHeight * 0.7, window.innerHeight - top - 8) });
    } else if (!open) setPos(undefined);
    setOpen(!open);
  }

  async function read(id?: string) {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : {}) }).catch(() => undefined);
    setItems((list) => list.map((x) => (!id || x.id === id ? { ...x, read: true } : x)));
    setUnread((n) => (id ? Math.max(0, n - (items.find((x) => x.id === id && !x.read) ? 1 : 0)) : 0));
  }

  const text = (n: Item) => {
    const d = n.data ?? {};
    if (n.type === "task") return t(d.name ? "notif.taskLead" : "notif.task", { title: d.title ?? "", name: d.name ?? "" });
    if (n.type === "visa") return t("notif.visa", { name: d.name ?? "", status: d.status ? t(`visa.status.${d.status}` as TKey) : "" });
    if (n.type === "visaNew") return t("notif.visaNew", { name: d.name ?? "", product: d.product ? ` — ${d.product}` : "" });
    return t(`notif.${n.type}` as TKey, { name: d.name ?? "", product: d.product ?? "", channel: d.channel === "INSTAGRAM" ? "Instagram" : "Telegram" });
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      <button ref={btn} type="button" onClick={toggle} className="relative rounded-md p-2 text-sidebar-muted hover:bg-sidebar-hover hover:text-foreground cursor-pointer" aria-label={t("notif.title")} title={t("notif.title")}>
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div style={pos} className={cn("fixed z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border bg-card shadow-xl", !pos && "inset-x-2 top-14")}>
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="font-semibold">{t("notif.title")}</span>
            {unread > 0 && (
              <button type="button" onClick={() => void read()} className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline">
                <CheckCheck className="size-3.5" /> {t("notif.readAll")}
              </button>
            )}
          </div>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "#"} onClick={() => !n.read && void read(n.id)} className={cn("flex gap-3 px-4 py-2.5 text-sm hover:bg-accent", !n.read && "bg-primary/5")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-red-500")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block", !n.read && "font-medium")}>{text(n)}</span>
                    <span className="text-[11px] text-muted-foreground">{formatDateTime(n.at)}</span>
                  </span>
                </Link>
              </li>
            ))}
            {!items.length && <li className="p-6 text-center text-sm text-muted-foreground">{t("notif.empty")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

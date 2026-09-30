"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, ChevronDown, ChevronUp } from "lucide-react";
import { callbackState } from "@/lib/callback";
import type { CallbackItem } from "@/lib/callbacks-data";
import { CallbackCard } from "./callback-list";
import { useNow } from "./use-now";

/**
 * Всплывающие напоминания о звонках на любой странице CRM.
 * Список обновляется раз в минуту, отсчёт — каждые 15 секунд.
 * Когда время звонка наступает — дополнительно системное уведомление браузера (если разрешено).
 */
export function CallbackReminders() {
  const [items, setItems] = useState<CallbackItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const notified = useRef(new Set<string>());
  const now = useNow(15_000);
  const pathname = usePathname();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/callbacks", { cache: "no-store" });
      if (res.ok) setItems((await res.json()).items);
    } catch {
      /* сеть недоступна — попробуем в следующий раз */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    if ("Notification" in window) setPermission(Notification.permission);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // после перехода по страницам (например, смены статуса) — обновить список
  useEffect(() => void load(), [pathname, load]);

  const visible = items.filter((i) => callbackState(i.callbackAt, now).remind);
  const dueCount = visible.filter((i) => callbackState(i.callbackAt, now).due).length;

  // системное уведомление, когда время звонка наступило
  useEffect(() => {
    if (permission !== "granted") return;
    for (const i of visible) {
      const key = `${i.id}:${i.callbackAt}`;
      if (callbackState(i.callbackAt, now).due && !notified.current.has(key)) {
        notified.current.add(key);
        try {
          new Notification("Пора позвонить", { body: `${i.name}${i.phone ? ` · ${i.phone}` : ""}`, icon: "/icon.png", tag: key });
        } catch {
          /* некоторые браузеры запрещают уведомления без service worker */
        }
      }
    }
  }, [visible, now, permission]);

  if (!visible.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[380px] space-y-2" role="region" aria-label="Напоминания о звонках">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="ml-auto flex items-center gap-2 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-lg cursor-pointer"
      >
        <BellRing className={dueCount ? "size-4 animate-bounce" : "size-4"} />
        {dueCount ? `Пора позвонить: ${dueCount}` : `Скоро звонок: ${visible.length}`}
        {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
      {!collapsed && (
        <>
          {visible.slice(0, 3).map((i) => (
            <CallbackCard key={i.id} item={i} now={now} onChanged={load} compact />
          ))}
          {visible.length > 3 && <div className="text-right text-xs text-muted-foreground">и ещё {visible.length - 3} — см. раздел «Лиды»</div>}
          {permission === "default" && (
            <button
              className="block w-full rounded-lg border border-dashed bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={async () => setPermission(await Notification.requestPermission())}
            >
              Включить уведомления браузера, чтобы не пропустить звонок в другой вкладке
            </button>
          )}
        </>
      )}
    </div>
  );
}

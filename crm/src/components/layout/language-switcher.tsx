"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALE_SHORT, LOCALES, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

/** Переключатель языка интерфейса: RU / UZ / EN (cookie на год) */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  function choose(l: Locale) {
    if (l === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }
  return (
    <div className={cn("flex items-center gap-1 rounded-lg bg-sidebar-hover p-1 text-xs", pending && "opacity-60", className)} role="radiogroup" aria-label={t("nav.language")}>
      <Languages className="mx-1 size-3.5 shrink-0 text-sidebar-muted" />
      {LOCALES.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={l === locale}
          title={LOCALE_NAMES[l]}
          onClick={() => choose(l)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 transition-colors cursor-pointer",
            l === locale ? "bg-card font-medium text-foreground shadow-xs" : "text-sidebar-muted hover:text-sidebar-foreground",
          )}
        >
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </div>
  );
}

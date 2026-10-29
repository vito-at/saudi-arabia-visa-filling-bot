"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Languages } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALE_SHORT, LOCALES, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

/** Переключатель языка интерфейса: RU / UZ / EN (cookie на год) */
export function LanguageSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  function choose(l: Locale) {
    if (l === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }
  // в меню — одна маленькая кнопка с текущим языком, выбор — в выпадающем списке
  if (compact)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          title={t("nav.language")}
          aria-label={t("nav.language")}
          className={cn(
            "flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-sidebar-hover px-2 text-xs font-semibold text-sidebar-muted outline-none hover:text-sidebar-foreground",
            pending && "opacity-60",
            className,
          )}
        >
          {LOCALE_SHORT[locale]}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="min-w-36">
          {LOCALES.map((l) => (
            <DropdownMenuItem key={l} onSelect={() => choose(l)}>
              <span className="w-6 text-xs font-semibold text-muted-foreground">{LOCALE_SHORT[l]}</span>
              <span className="flex-1">{LOCALE_NAMES[l]}</span>
              {l === locale && <Check className="text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  return (
    <div className={cn("flex items-center gap-1 rounded-lg bg-sidebar-hover p-1 text-xs", pending && "opacity-60", className)} role="radiogroup" aria-label={t("nav.language")}>
      {!compact && <Languages className="mx-1 size-3.5 shrink-0 text-sidebar-muted" />}
      {LOCALES.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={l === locale}
          title={LOCALE_NAMES[l]}
          onClick={() => choose(l)}
          className={cn(
            "flex-1 rounded-md px-2 transition-colors cursor-pointer",
            compact ? "py-1" : "py-1.5",
            l === locale ? "bg-card font-medium text-foreground shadow-xs" : "text-sidebar-muted hover:text-sidebar-foreground",
          )}
        >
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </div>
  );
}

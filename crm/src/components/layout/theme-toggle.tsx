"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

function currentTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Переключатель «День / Ночь»; выбор хранится в cookie на год */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => setTheme(currentTheme()), []);

  function apply(next: Theme) {
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <div className={cn("flex rounded-lg bg-sidebar-hover p-1 text-xs", className)} role="radiogroup" aria-label="Тема оформления">
      {(
        [
          ["light", "День", Sun],
          ["dark", "Ночь", Moon],
        ] as const
      ).map(([value, label, Icon]) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          onClick={() => apply(value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition-colors cursor-pointer",
            theme === value ? "bg-card font-medium text-foreground shadow-xs" : "text-sidebar-muted hover:text-sidebar-foreground",
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Текущая тема для компонентов, которым нужны цвета в JS (графики) */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const update = () => setTheme(currentTheme());
    update();
    window.addEventListener("themechange", update);
    return () => window.removeEventListener("themechange", update);
  }, []);
  return theme;
}

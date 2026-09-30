/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/** Логотип Orient Travel: светлая и тёмная версии переключаются вместе с темой */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block", className)}>
      <img src="/logo-light.png" alt="Orient Travel" className="block h-full w-auto dark:hidden" />
      <img src="/logo-dark.png" alt="Orient Travel" className="hidden h-full w-auto dark:block" />
    </span>
  );
}

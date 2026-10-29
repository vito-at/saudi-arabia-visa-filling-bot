import "flag-icons/css/flag-icons.min.css";
import { cn } from "@/lib/utils";

/** Флаг страны картинкой (эмодзи-флаги Windows не показывает — вместо них буквы) */
export function Flag({ code, className }: { code: string; className?: string }) {
  return <span className={cn(`fi fi-${code.toLowerCase()} shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.08)]`, className)} aria-hidden />;
}

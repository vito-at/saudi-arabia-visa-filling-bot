import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Пометка «Постоянный клиент»: полная — в карточках, компактная (только звезда) — в узких списках */
export function RegularBadge({ label, hint, compact, className }: { label: string; hint: string; compact?: boolean; className?: string }) {
  if (compact) return <Star className={cn("size-3.5 shrink-0 fill-amber-400 text-amber-500", className)} aria-label={label} />;
  return (
    <Badge title={hint} className={cn("border-amber-300 bg-amber-50 text-amber-800", className)}>
      <Star className="size-3 fill-amber-400 text-amber-500" /> {label}
    </Badge>
  );
}

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Pagination({ page, pageSize, total, params, basePath }: { page: number; pageSize: number; total: number; params: Record<string, string | string[] | undefined>; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "page") q.set(k, v);
    if (p > 1) q.set("page", String(p));
    return `${basePath}?${q.toString()}`;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-card px-2 text-sm hover:bg-accent";
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
      <span>
        {formatNumber(from)}–{formatNumber(to)} из {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link className={btn} href={href(page - 1)} aria-label="Назад">
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")}>
            <ChevronLeft className="size-4" />
          </span>
        )}
        <span className="px-2">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link className={btn} href={href(page + 1)} aria-label="Вперёд">
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")}>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}

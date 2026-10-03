import Link from "next/link";
import { Archive, Inbox } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { formatNumber } from "@/lib/format";
import type { LeadsView, SearchParams } from "@/lib/leads/query";
import { cn } from "@/lib/utils";

/** Вкладки «Лиды» / «Отказы»; фильтры и поиск сохраняются при переключении */
export async function LeadsTabs({ view, active, lost, params, searching }: { view: LeadsView; active: number; lost: number; params: SearchParams; searching: boolean }) {
  const { t } = await getI18n();
  const href = (v: LeadsView) => {
    const next = new URLSearchParams();
    for (const [k, val] of Object.entries(params)) if (typeof val === "string" && val && !["view", "page", "status"].includes(k)) next.set(k, val);
    if (v === "lost") next.set("view", "lost");
    return `/leads${next.size ? `?${next.toString()}` : ""}`;
  };
  const tab = (v: LeadsView, label: string, n: number, Icon: typeof Inbox) => (
    <Link
      href={href(v)}
      className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm", view === v ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
    >
      <Icon className="size-4" /> {label}
      <span className={cn("rounded-full px-1.5 text-xs tabular-nums", view === v ? "bg-primary/10" : "bg-muted")}>{formatNumber(n)}</span>
    </Link>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-1 border-b px-2">
      {tab("active", t("leads.tabActive"), active, Inbox)}
      {tab("lost", t("leads.tabLost"), lost, Archive)}
      {searching && <span className="ml-auto px-2 py-2 text-xs text-muted-foreground">{t("leads.searchIncludesLost")}</span>}
    </div>
  );
}

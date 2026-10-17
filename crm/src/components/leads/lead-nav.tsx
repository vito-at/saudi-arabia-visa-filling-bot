"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/client";

const KEY = "crm.leadNav";

/** Список лидов запоминает порядок открытой страницы (с фильтрами), чтобы из карточки переходить к соседним лидам */
export function useRememberLeadList(ids: string[]) {
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ ids, back: `${location.pathname}${location.search}` }));
    } catch {
      /* приватный режим — без навигации по списку */
    }
  }, [ids]);
}

/** «← Все лиды» (с прежними фильтрами) и «‹ 3 / 50 ›» — предыдущий и следующий лид списка */
export function LeadNav({ leadId }: { leadId: string }) {
  const { t } = useI18n();
  const [nav, setNav] = useState<{ ids: string[]; back: string } | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
      if (v && Array.isArray(v.ids) && typeof v.back === "string") setNav(v);
    } catch {
      /* нет сохранённого списка */
    }
  }, []);
  const i = nav ? nav.ids.indexOf(leadId) : -1;
  const prev = i > 0 ? nav!.ids[i - 1] : null;
  const next = i >= 0 && i < nav!.ids.length - 1 ? nav!.ids[i + 1] : null;
  const btn = "inline-flex size-8 items-center justify-center rounded-md border bg-card hover:bg-accent aria-disabled:pointer-events-none aria-disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-3">
      <Link href={i >= 0 ? nav!.back : "/leads"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("lead.back")}
      </Link>
      {i >= 0 && nav!.ids.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Link href={prev ? `/leads/${prev}` : "#"} aria-disabled={!prev} className={btn} title={t("lead.prev")}>
            <ChevronLeft className="size-4" />
          </Link>
          <span className="tabular-nums text-muted-foreground">
            {i + 1} / {nav!.ids.length}
          </span>
          <Link href={next ? `/leads/${next}` : "#"} aria-disabled={!next} className={btn} title={t("lead.next")}>
            <ChevronRight className="size-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { setVisaStatusAction, takeVisaAction, visaCommentAction } from "@/app/(app)/visa/actions";
import { VISA_STATUS_STYLE } from "./visa-status";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/core";

const STATUSES = ["NEW", "IN_PROGRESS", "PAID_WAITING", "DOCS_REQUESTED", "APPROVED", "REJECTED"] as const;

/** Этап визы: визовый специалист выбирает этап и пишет комментарий (для запроса документов — обязательно) */
export function VisaPanel({ serviceId, status, assignee, isMine }: { serviceId: string; status: string; assignee: string | null; isMine: boolean }) {
  const { t } = useI18n();
  const [next, setNext] = useState(status);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const changed = next !== status;

  function save() {
    start(async () => {
      const r = changed ? await setVisaStatusAction(serviceId, next, comment) : await visaCommentAction(serviceId, comment);
      if (!r.ok) return void toast.error(r.error);
      toast.success(t("common.saved"));
      setComment("");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{assignee ? t("visa.assignedTo", { name: assignee }) : t("visa.unassigned")}</span>
        {!isMine && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await takeVisaAction(serviceId);
                if (!r.ok) toast.error(r.error);
              })
            }
          >
            <Hand /> {t("visa.take")}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setNext(s)}
            className={cn(
              "rounded-md border px-2.5 py-2 text-left text-xs font-medium",
              next === s ? cn(VISA_STATUS_STYLE[s], "border-transparent ring-2 ring-primary/50") : "hover:bg-accent",
              s === status && next !== s && "border-dashed",
            )}
          >
            {t(`visa.status.${s}` as TKey)}
            {s === status && <span className="block text-[10px] font-normal opacity-70">{t("visa.current")}</span>}
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={next === "DOCS_REQUESTED" ? t("visa.docsCommentPh") : t("visa.commentPh")}
      />
      <div className="flex justify-end">
        <Button disabled={pending || (!changed && !comment.trim())} onClick={save}>
          {pending ? t("common.saving") : changed ? t("visa.saveStatus") : t("visa.addComment")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

/** Обязательный выбор причины при переводе в «Отказ» */
export function LossDialog({
  open,
  onOpenChange,
  reasons,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reasons: { id: string; name: string }[];
  onConfirm: (reasonId: string, comment: string) => void;
  pending?: boolean;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("loss.title")} description={t("loss.description")}>
        <div className="grid grid-cols-2 gap-2">
          {reasons.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => setReason(r.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                reason === r.id ? "border-red-500 bg-red-50 text-red-800" : "hover:bg-accent",
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
        <Field label={t("loss.comment")} className="mt-4">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" disabled={!reason || pending} onClick={() => onConfirm(reason, comment)}>
            {t("loss.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

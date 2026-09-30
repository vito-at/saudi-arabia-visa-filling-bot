"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { parseInputDateTime, toInputDate, toInputDateTime } from "@/lib/format";
import type { TKey } from "@/i18n/core";
import { useI18n } from "@/i18n/client";

const PRESETS: { label: TKey; at: () => Date }[] = [
  { label: "callback.in15", at: () => new Date(Date.now() + 15 * 60_000) },
  { label: "callback.in1h", at: () => new Date(Date.now() + 60 * 60_000) },
  { label: "callback.in3h", at: () => new Date(Date.now() + 3 * 60 * 60_000) },
  {
    label: "callback.tomorrow10",
    at: () => {
      const tomorrow = toInputDate(new Date(Date.now() + 24 * 60 * 60_000));
      return parseInputDateTime(`${tomorrow}T10:00`)!;
    },
  },
];

/** Выбор даты и времени повторного звонка */
export function CallbackDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  initial,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (at: string) => void;
  pending?: boolean;
  initial?: string | null;
  title?: string;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(() => (initial ? toInputDateTime(initial) : toInputDateTime(new Date(Date.now() + 60 * 60_000))));
  const parsed = parseInputDateTime(value);
  const past = !parsed || parsed.getTime() < Date.now() - 60_000;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title ?? t("callback.dialogTitle")} description={t("callback.dialogDescription")}>
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.label} type="button" size="sm" variant="outline" onClick={() => setValue(toInputDateTime(p.at()))}>
              {t(p.label)}
            </Button>
          ))}
        </div>
        <Field label={t("callback.dateTime")}>
          <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        {past && <p className="mt-2 text-sm text-red-600">{t("callback.pickFuture")}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={past || pending} onClick={() => onConfirm(value)}>
            {t("common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

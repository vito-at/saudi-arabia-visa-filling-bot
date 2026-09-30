"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { parseInputDateTime, toInputDate, toInputDateTime } from "@/lib/format";

const PRESETS: { label: string; at: () => Date }[] = [
  { label: "Через 15 мин", at: () => new Date(Date.now() + 15 * 60_000) },
  { label: "Через час", at: () => new Date(Date.now() + 60 * 60_000) },
  { label: "Через 3 часа", at: () => new Date(Date.now() + 3 * 60 * 60_000) },
  {
    label: "Завтра в 10:00",
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
  title = "Когда перезвонить?",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (at: string) => void;
  pending?: boolean;
  initial?: string | null;
  title?: string;
}) {
  const [value, setValue] = useState(() => (initial ? toInputDateTime(initial) : toInputDateTime(new Date(Date.now() + 60 * 60_000))));
  const parsed = parseInputDateTime(value);
  const past = !parsed || parsed.getTime() < Date.now() - 60_000;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description="За 10 минут до звонка менеджер получит напоминание с обратным отсчётом">
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.label} type="button" size="sm" variant="outline" onClick={() => setValue(toInputDateTime(p.at()))}>
              {p.label}
            </Button>
          ))}
        </div>
        <Field label="Дата и время звонка (Ташкент)">
          <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        {past && <p className="mt-2 text-sm text-red-600">Выберите время в будущем</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button disabled={past || pending} onClick={() => onConfirm(value)}>
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2, Send, Settings2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { saveAttendanceSettingsAction, saveMarkAction, telegramLinkAction, unlinkTelegramAction, type AttendanceSettingsInput } from "@/app/(app)/attendance/actions";
import type { DayState } from "@/lib/attendance";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/core";

/** Привязка своего Telegram: ссылка открывает бота, бот отвечает кнопкой «Пришёл» */
export function TelegramCard({ userId, linkedAs }: { userId: string; linkedAs: string | null }) {
  const { t } = useI18n();
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
        <div className="flex items-start gap-3 text-sm">
          <Send className="mt-0.5 size-5 shrink-0 text-sky-500" />
          <div>
            <div className="font-medium">{linkedAs ? t("att.linked", { name: linkedAs }) : t("att.notLinked")}</div>
            <div className="text-muted-foreground">{linkedAs ? t("att.linkedHint") : t("att.linkHint")}</div>
          </div>
        </div>
        {linkedAs ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await unlinkTelegramAction(userId);
                if (!r.ok) toast.error(r.error);
              })
            }
          >
            <Unlink /> {t("att.unlink")}
          </Button>
        ) : link ? (
          <a href={link} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-sky-500 px-3 text-sm font-medium text-white hover:bg-sky-600">
            <Send className="size-4" /> {t("att.openBot")}
          </a>
        ) : (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await telegramLinkAction();
                if (!r.ok || !r.data) return void toast.error(r.ok ? t("common.errorGeneric") : r.error);
                setLink(r.data);
                window.open(r.data, "_blank", "noopener");
              })
            }
          >
            <Link2 /> {t("att.link")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsButton({ initial }: { initial: AttendanceSettingsInput }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = (k: keyof AttendanceSettingsInput) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveAttendanceSettingsAction(v);
      if (!r.ok) return void toast.error(r.error);
      toast.success(t("common.saved"));
      setOpen(false);
    });
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Settings2 /> {t("att.settings")}
      </Button>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent title={t("att.settings")}>
            <form onSubmit={save} className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={v.enabled} onChange={set("enabled")} /> {t("att.enabled")}
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                <Field label={t("att.grace")}>
                  <Input type="number" min={0} max={240} value={v.graceMin} onChange={set("graceMin")} />
                </Field>
                <Field label={t("att.fine")}>
                  <Input inputMode="decimal" value={v.lateFine} onChange={set("lateFine")} placeholder="0" />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">{t("att.scheduleHint")}</p>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={v.geo} onChange={set("geo")} /> {t("att.geo")}
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
                <Field label={t("att.lat")}>
                  <Input inputMode="decimal" value={v.officeLat} onChange={set("officeLat")} placeholder="40.3864" />
                </Field>
                <Field label={t("att.lng")}>
                  <Input inputMode="decimal" value={v.officeLng} onChange={set("officeLng")} placeholder="71.7864" />
                </Field>
                <Field label={t("att.radius")}>
                  <Input type="number" min={20} value={v.radiusM} onChange={set("radiusM")} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">{t("att.geoHint")}</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export interface MarkView {
  day: string;
  state: DayState;
  in: string | null;
  out: string | null;
  lateMin: number;
  fine: number;
  note: string | null;
}

export interface GridRow {
  userId: string;
  name: string;
  telegram: string | null;
  days: MarkView[];
}

export const STATE_STYLE: Record<DayState, string> = {
  ok: "bg-emerald-500 text-white",
  late: "bg-amber-500 text-white",
  noOut: "bg-sky-500 text-white",
  absent: "bg-red-500 text-white",
  off: "bg-muted text-muted-foreground",
  future: "bg-transparent text-muted-foreground/50",
};

function EditDialog({ row, mark, onClose }: { row: GridRow; mark: MarkView; onClose: () => void }) {
  const { t } = useI18n();
  const [v, setV] = useState({ checkIn: mark.in ?? "", checkOut: mark.out ?? "", fine: mark.fine ? String(mark.fine) : "", note: mark.note ?? "" });
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveMarkAction({ userId: row.userId, day: mark.day, ...v });
      if (!r.ok) return void toast.error(r.error);
      toast.success(t("common.saved"));
      onClose();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("att.editTitle", { name: row.name, day: mark.day.split("-").reverse().join(".") })}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-3 gap-3 [&>*]:min-w-0">
            <Field label={t("att.in")}>
              <Input type="time" value={v.checkIn} onChange={set("checkIn")} />
            </Field>
            <Field label={t("att.out")}>
              <Input type="time" value={v.checkOut} onChange={set("checkOut")} />
            </Field>
            <Field label={t("att.fineShort")}>
              <Input inputMode="decimal" value={v.fine} onChange={set("fine")} placeholder="0" />
            </Field>
          </div>
          <Field label={t("att.note")}>
            <Input value={v.note} onChange={set("note")} maxLength={300} placeholder={t("att.notePh")} />
          </Field>
          <p className="text-xs text-muted-foreground">{t("att.editHint")}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Табель за месяц: строка — сотрудник, клетка — день. Администратор исправляет отметку по клику. */
export function AttendanceGrid({ rows, editable }: { rows: GridRow[]; editable: boolean }) {
  const { t } = useI18n();
  const [edit, setEdit] = useState<{ row: GridRow; mark: MarkView } | null>(null);
  if (!rows.length) return <div className="p-5 text-sm text-muted-foreground">{t("att.empty")}</div>;
  const days = rows[0].days;
  const title = (m: MarkView) =>
    [
      m.day.split("-").reverse().join("."),
      t(`att.state.${m.state}` as TKey),
      m.in && `${t("att.in")} ${m.in}`,
      m.out && `${t("att.out")} ${m.out}`,
      m.lateMin > 0 && t("att.lateN", { n: m.lateMin }),
      m.note,
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="sticky left-0 z-10 min-w-36 bg-card px-4 py-2 text-left font-medium">{t("rt.managers.manager")}</th>
              {days.map((d) => (
                <th key={d.day} className="w-7 px-0.5 py-2 text-center font-normal tabular-nums">
                  {Number(d.day.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-t">
                <td className="sticky left-0 z-10 bg-card px-4 py-1.5 text-sm font-medium whitespace-nowrap">{r.name}</td>
                {r.days.map((m) => (
                  <td key={m.day} className="px-0.5 py-1.5">
                    <button
                      type="button"
                      title={title(m)}
                      disabled={!editable || m.state === "future"}
                      onClick={() => setEdit({ row: r, mark: m })}
                      className={cn("flex size-6 items-center justify-center rounded text-[10px] tabular-nums", STATE_STYLE[m.state], editable && m.state !== "future" && "hover:ring-2 hover:ring-ring/40", m.note && "underline")}
                    >
                      {m.state === "late" ? m.lateMin : m.state === "absent" ? "✕" : ""}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <EditDialog row={edit.row} mark={edit.mark} onClose={() => setEdit(null)} />}
    </>
  );
}

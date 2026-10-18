"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { deleteTemplateAction, saveTemplateAction } from "@/app/(app)/settings/chat-actions";
import { useI18n } from "@/i18n/client";

export interface TemplateView {
  id: string;
  title: string;
  text: string;
}

/** Быстрые ответы для переписок: администратор задаёт, менеджеры вставляют одним нажатием */
export function TemplatesEditor({ templates }: { templates: TemplateView[] }) {
  const { t } = useI18n();
  const [edit, setEdit] = useState<TemplateView | null>(null);
  const [pending, start] = useTransition();
  const blank = { id: "", title: "", text: "" };

  function save() {
    if (!edit) return;
    start(async () => {
      const r = await saveTemplateAction({ id: edit.id || undefined, title: edit.title, text: edit.text });
      if (!r.ok) return void toast.error(r.error);
      toast.success(t("common.saved"));
      setEdit(null);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="size-5 text-muted-foreground" /> {t("tpl.title")}
        </CardTitle>
        {!edit && (
          <Button size="sm" variant="outline" onClick={() => setEdit(blank)}>
            <Plus /> {t("tpl.add")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("tpl.hint")}</p>
        {edit && (
          <div className="space-y-3 rounded-lg border p-3">
            <Field label={t("tpl.name")}>
              <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={60} placeholder={t("tpl.namePh")} autoFocus />
            </Field>
            <Field label={t("tpl.text")}>
              <Textarea value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} rows={4} maxLength={2000} placeholder={t("tpl.textPh")} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={pending} onClick={save}>
                {pending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        )}
        {!templates.length && !edit && <p className="text-sm text-muted-foreground">{t("tpl.empty")}</p>}
        <ul className="divide-y">
          {templates.map((tp) => (
            <li key={tp.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-medium">{tp.title}</div>
                <div className="line-clamp-2 whitespace-pre-wrap text-muted-foreground">{tp.text}</div>
              </div>
              <Button size="icon-sm" variant="ghost" title={t("common.edit")} onClick={() => setEdit(tp)}>
                <Pencil />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title={t("common.delete")}
                disabled={pending}
                onClick={() => {
                  if (!confirm(t("tpl.deleteConfirm", { name: tp.title }))) return;
                  start(async () => {
                    const r = await deleteTemplateAction(tp.id);
                    if (!r.ok) toast.error(r.error);
                  });
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardList, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { saveLeadProfileAction } from "@/app/(app)/leads/actions";
import type { ProfileAnswers, ProfileQuestionView } from "@/lib/leads/profile";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/i18n/client";

/** Анкета клиента: куда, с кем, дети, даты, бюджет… — вопросы задаёт администратор */
export function LeadProfileCard({ leadId, questions, answers }: { leadId: string; questions: ProfileQuestionView[]; answers: ProfileAnswers }) {
  const { t } = useI18n();
  const filled = questions.filter((q) => answers[q.id]).length;
  const [editing, setEditing] = useState(filled === 0);
  const [values, setValues] = useState<ProfileAnswers>(answers);
  const [pending, start] = useTransition();
  if (!questions.length) return null;

  const show = (q: ProfileQuestionView, v: string | undefined) => (!v ? "—" : q.type === "DATE" ? formatDate(`${v}T12:00:00Z`) : v);

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const input = Object.fromEntries(questions.map((q) => [q.id, values[q.id] ?? ""]));
      const res = await saveLeadProfileAction(leadId, input);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("common.saved"));
      setEditing(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="size-4 text-muted-foreground" /> {t("profile.title")}
          <span className={filled === questions.length ? "text-xs font-normal text-emerald-600" : "text-xs font-normal text-muted-foreground"}>
            {filled}/{questions.length}
          </span>
        </CardTitle>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil /> {t("common.edit")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            {questions.map((q) => (
              <label key={q.id} className="space-y-1 text-sm">
                <span className="text-muted-foreground">{q.label}</span>
                {q.type === "SELECT" ? (
                  <NativeSelect value={values[q.id] ?? ""} onChange={(e) => setValues({ ...values, [q.id]: e.target.value })}>
                    <option value="">—</option>
                    {q.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    type={q.type === "DATE" ? "date" : q.type === "NUMBER" ? "number" : "text"}
                    min={q.type === "NUMBER" ? 0 : undefined}
                    value={values[q.id] ?? ""}
                    onChange={(e) => setValues({ ...values, [q.id]: e.target.value })}
                  />
                )}
              </label>
            ))}
            {questions.some((q) => q.role === "RETURN_DATE") && <p className="text-xs text-muted-foreground sm:col-span-2">{t("profile.returnHint")}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              {filled > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setValues(answers);
                    setEditing(false);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              )}
              <Button type="submit" disabled={pending}>
                {pending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {questions.map((q) => (
              <div key={q.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">{q.label}</dt>
                <dd className={answers[q.id] ? "break-words" : "text-muted-foreground"}>{show(q, answers[q.id])}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bot, CheckCircle2, Circle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { clearAiKeyAction, saveAiBotAction, testAiAction } from "@/app/(app)/settings/ai-actions";
import { useI18n } from "@/i18n/client";

export interface AiBotView {
  enabled: boolean;
  hasKey: boolean;
  mode: string;
  telegram: boolean;
  instagram: boolean;
  instructions: string;
  maxReplies: number;
  lastError: string | null;
  lastUsedAt: string | null;
  workHours: string;
}

/** Настройки ИИ-ассистента: ключ Claude API вводит владелец, ключ не показывается после сохранения */
export function AiBotForm({ v }: { v: AiBotView }) {
  const { t } = useI18n();
  const [s, setS] = useState({ enabled: v.enabled, apiKey: "", mode: v.mode, telegram: v.telegram, instagram: v.instagram, instructions: v.instructions, maxReplies: String(v.maxReplies) });
  const [probe, setProbe] = useState("");
  const [answer, setAnswer] = useState<{ reply: string; phone: string | null; summary: string | null; handoff: boolean } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = await saveAiBotAction(s);
      if (!r.ok) return void toast.error(r.error);
      toast.success(t("common.saved"));
      setS((x) => ({ ...x, apiKey: "" }));
    });
  }
  function test() {
    setAnswer(null);
    start(async () => {
      const r = await testAiAction(probe);
      if (!r.ok || !r.data) return void toast.error(r.ok ? t("common.errorGeneric") : r.error);
      setAnswer(r.data);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-5 text-violet-500" /> {t("ai.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-start gap-2">
            {v.enabled && v.hasKey ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
            <span>{v.enabled && v.hasKey ? t("ai.on") : t("ai.off")}</span>
          </div>
          {v.lastUsedAt && <p className="pl-6 text-xs text-muted-foreground">{t("ai.lastUsed", { at: v.lastUsedAt })}</p>}
          {v.lastError && <p className="pl-6 text-xs text-red-600">{v.lastError}</p>}
        </div>
        <p className="text-sm text-muted-foreground">{t("ai.about")}</p>

        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("ai.key")} className="min-w-0 flex-1 basis-72">
            <Input type="password" autoComplete="off" value={s.apiKey} onChange={(e) => setS({ ...s, apiKey: e.target.value })} placeholder={v.hasKey ? t("ai.keySaved") : "sk-ant-…"} />
          </Field>
          {v.hasKey && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await clearAiKeyAction();
                  if (!r.ok) toast.error(r.error);
                })
              }
            >
              {t("ai.clearKey")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("ai.keyHint")}</p>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} /> {t("ai.enabled")}
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_10rem] sm:items-end [&>*]:min-w-0">
          <Field label={t("ai.mode")}>
            <NativeSelect value={s.mode} onChange={(e) => setS({ ...s, mode: e.target.value })}>
              <option value="OFF_HOURS">{t("ai.modeOffHours", { hours: v.workHours })}</option>
              <option value="ALWAYS">{t("ai.modeAlways")}</option>
            </NativeSelect>
          </Field>
          <div className="flex gap-4 pb-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={s.telegram} onChange={(e) => setS({ ...s, telegram: e.target.checked })} /> Telegram
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={s.instagram} onChange={(e) => setS({ ...s, instagram: e.target.checked })} /> Instagram
            </label>
          </div>
          <Field label={t("ai.maxReplies")}>
            <Input type="number" min={1} max={200} value={s.maxReplies} onChange={(e) => setS({ ...s, maxReplies: e.target.value })} />
          </Field>
        </div>
        <Field label={t("ai.instructions")}>
          <Textarea rows={8} value={s.instructions} onChange={(e) => setS({ ...s, instructions: e.target.value })} placeholder={t("ai.instructionsPh")} maxLength={8000} />
        </Field>
        <p className="text-xs text-muted-foreground">{t("ai.rulesHint")}</p>
        <div className="flex justify-end">
          <Button disabled={pending} onClick={save}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>

        {v.hasKey && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="text-sm font-medium">{t("ai.test")}</div>
            <div className="flex flex-wrap gap-2">
              <Input className="min-w-0 flex-1 basis-64" value={probe} onChange={(e) => setProbe(e.target.value)} placeholder={t("ai.testPh")} />
              <Button variant="outline" disabled={pending || !probe.trim()} onClick={test}>
                <Play /> {t("ai.testRun")}
              </Button>
            </div>
            {answer && (
              <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
                <p className="whitespace-pre-wrap">{answer.reply || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {[answer.phone && `${t("ai.testPhone")}: ${answer.phone}`, answer.summary && `${t("ai.testSummary")}: ${answer.summary}`, answer.handoff && t("ai.testHandoff")].filter(Boolean).join(" · ")}
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t("ai.testHint")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

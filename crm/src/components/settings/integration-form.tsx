"use client";

import { useTransition } from "react";
import { CheckCircle2, Copy, RefreshCw, ShieldCheck, Webhook, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions";
import {
  checkTokenAction,
  saveIntegrationAction,
  subscribeWebhookAction,
  syncNowAction,
  syncSpendAction,
} from "@/app/(app)/settings/integration-actions";

export interface IntegrationView {
  appId: string;
  pageId: string;
  adAccountId: string;
  verifyToken: string;
  pollIntervalMin: number;
  initialDays: number;
  enabled: boolean;
  hasAppSecret: boolean;
  pageTokenMask: string;
  hasAdsToken: boolean;
  webhookUrl: string;
}

function useRun() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<string>>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.data ?? "Готово");
      else toast.error(res.error, { duration: 10000 });
    });
  return { pending, run };
}

export function IntegrationForm({ v }: { v: IntegrationView }) {
  const { pending, run } = useRun();
  const copy = (s: string) => {
    void navigator.clipboard.writeText(s);
    toast.success("Скопировано");
  };

  return (
    <div className="space-y-6">
      <form action={(fd) => run(() => saveIntegrationAction(fd))} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="App ID">
            <Input name="appId" defaultValue={v.appId} placeholder="123456789012345" />
          </Field>
          <Field label="App Secret" hint={v.hasAppSecret ? "Сохранён (зашифрован). Оставьте пустым, чтобы не менять" : "Meta for Developers → Настройки → Основное"}>
            <Input name="appSecret" type="password" autoComplete="off" placeholder={v.hasAppSecret ? "••••••••" : ""} />
          </Field>
          <Field label="Page ID" hint="ID Facebook-страницы, к которой привязаны лид-формы">
            <Input name="pageId" defaultValue={v.pageId} />
          </Field>
          <Field label="Page Access Token (долгосрочный)" hint={v.pageTokenMask ? `Текущий: ${v.pageTokenMask}. Оставьте пустым, чтобы не менять` : "Права: leads_retrieval, pages_show_list, pages_read_engagement, pages_manage_metadata, ads_read"}>
            <Input name="pageToken" type="password" autoComplete="off" placeholder={v.pageTokenMask ? "••••••••" : "EAAG…"} />
          </Field>
          <Field label="Интервал опроса, минут">
            <Input name="pollIntervalMin" type="number" min={1} max={1440} defaultValue={v.pollIntervalMin} />
          </Field>
          <Field label="Первая загрузка — за сколько дней" hint="Meta хранит лиды 90 дней">
            <Input name="initialDays" type="number" min={1} max={90} defaultValue={v.initialDays} />
          </Field>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-3 text-sm font-semibold">Расходы на рекламу (для стоимости лида и ROI) — необязательно</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ID рекламного кабинета" hint="act_XXXXXXXXX из Ads Manager">
              <Input name="adAccountId" defaultValue={v.adAccountId} placeholder="act_1234567890" />
            </Field>
            <Field label="Токен Marketing API (ads_read)" hint={v.hasAdsToken ? "Сохранён. Оставьте пустым, чтобы не менять" : "Токен системного пользователя. Если пусто — используется Page Token"}>
              <Input name="adsToken" type="password" autoComplete="off" placeholder={v.hasAdsToken ? "••••••••" : ""} />
            </Field>
          </div>
          {v.hasAdsToken && (
            <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="clearAdsToken" /> Удалить сохранённый токен Marketing API
            </label>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-3 text-sm font-semibold">Вебхук (мгновенная доставка лидов, нужен HTTPS)</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Callback URL">
              <div className="flex gap-2">
                <Input readOnly value={v.webhookUrl} />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(v.webhookUrl)} title="Копировать">
                  <Copy />
                </Button>
              </div>
            </Field>
            <Field label="Verify Token" hint="Укажите его же в настройках вебхука приложения">
              <div className="flex gap-2">
                <Input name="verifyToken" defaultValue={v.verifyToken} />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(v.verifyToken)} title="Копировать">
                  <Copy />
                </Button>
              </div>
            </Field>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={v.enabled} /> Интеграция включена (автоматический опрос по расписанию)
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            <CheckCircle2 /> Сохранить
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 border-t pt-5">
        <Button variant="outline" disabled={pending} onClick={() => run(checkTokenAction)}>
          <ShieldCheck /> Проверить токен
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => run(syncNowAction)}>
          <RefreshCw className={pending ? "animate-spin" : ""} /> Загрузить лиды сейчас
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => run(subscribeWebhookAction)}>
          <Webhook /> Подписать страницу на вебхук
        </Button>
        <Button variant="outline" disabled={pending || !v.adAccountId} onClick={() => run(syncSpendAction)}>
          <Wallet /> Загрузить расходы
        </Button>
      </div>
    </div>
  );
}

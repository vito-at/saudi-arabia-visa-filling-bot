"use client";

import { useTransition } from "react";
import { CheckCircle2, Copy, RefreshCw, ShieldCheck, Target, Webhook, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions";
import {
  checkCapiAction,
  checkTokenAction,
  saveIntegrationAction,
  subscribeWebhookAction,
  syncNowAction,
  syncSpendAction,
} from "@/app/(app)/settings/integration-actions";
import { useI18n } from "@/i18n/client";

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
  capiDatasetId: string;
  hasCapiToken: boolean;
  capiTestCode: string;
  capiEnabled: boolean;
  capiStats: { sent: number; pending: number; failed: number };
  capiLastError: string | null;
}

function useRun() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<string>>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.data ?? t("common.done"));
      else toast.error(res.error, { duration: 10000 });
    });
  return { pending, run };
}

export function IntegrationForm({ v }: { v: IntegrationView }) {
  const { pending, run } = useRun();
  const { t } = useI18n();
  const copy = (s: string) => {
    void navigator.clipboard.writeText(s);
    toast.success(t("integ.copied"));
  };

  return (
    <div className="space-y-6">
      <form action={(fd) => run(() => saveIntegrationAction(fd))} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="App ID">
            <Input name="appId" defaultValue={v.appId} autoComplete="off" data-1p-ignore data-lpignore="true" placeholder="123456789012345" />
          </Field>
          <Field label="App Secret" hint={v.hasAppSecret ? t("integ.appSecretSaved") : t("integ.appSecretHint")}>
            <Input name="appSecret" type="password" autoComplete="new-password" data-1p-ignore data-lpignore="true" placeholder={v.hasAppSecret ? "••••••••" : ""} />
          </Field>
          <Field label="Page ID" hint={t("integ.pageIdHint")}>
            <Input name="pageId" defaultValue={v.pageId} autoComplete="off" data-1p-ignore data-lpignore="true" />
          </Field>
          <Field label={t("integ.pageToken")} hint={v.pageTokenMask ? t("integ.pageTokenCurrent", { mask: v.pageTokenMask }) : t("integ.pageTokenHint")}>
            <Input name="pageToken" type="password" autoComplete="new-password" data-1p-ignore data-lpignore="true" placeholder={v.pageTokenMask ? "••••••••" : "EAAG…"} />
          </Field>
          <Field label={t("integ.poll")}>
            <Input name="pollIntervalMin" type="number" min={1} max={1440} defaultValue={v.pollIntervalMin} />
          </Field>
          <Field label={t("integ.initialDays")} hint={t("integ.initialDaysHint")}>
            <Input name="initialDays" type="number" min={1} max={90} defaultValue={v.initialDays} />
          </Field>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-3 text-sm font-semibold">{t("integ.spendTitle")}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("integ.adAccount")} hint={t("integ.adAccountHint")}>
              <Input name="adAccountId" defaultValue={v.adAccountId} autoComplete="off" data-1p-ignore data-lpignore="true" placeholder="act_1234567890" />
            </Field>
            <Field label={t("integ.adsToken")} hint={v.hasAdsToken ? t("integ.adsTokenSaved") : t("integ.adsTokenHint")}>
              <Input name="adsToken" type="password" autoComplete="new-password" data-1p-ignore data-lpignore="true" placeholder={v.hasAdsToken ? "••••••••" : ""} />
            </Field>
          </div>
          {v.hasAdsToken && (
            <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="clearAdsToken" /> {t("integ.clearAdsToken")}
            </label>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-1 text-sm font-semibold">{t("integ.capiTitle")}</div>
          <p className="mb-3 text-xs text-muted-foreground">{t("integ.capiHint")}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("integ.capiDataset")}>
              <Input name="capiDatasetId" defaultValue={v.capiDatasetId} autoComplete="off" data-1p-ignore data-lpignore="true" inputMode="numeric" placeholder="1234567890123456" />
            </Field>
            <Field label={t("integ.capiToken")} hint={v.hasCapiToken ? t("integ.capiTokenSaved") : t("integ.capiTokenHint")}>
              <Input name="capiToken" type="password" autoComplete="new-password" data-1p-ignore data-lpignore="true" placeholder={v.hasCapiToken ? "••••••••" : "EAAG…"} />
            </Field>
            <Field label={t("integ.capiTestCode")} hint={t("integ.capiTestCodeHint")}>
              <Input name="capiTestCode" defaultValue={v.capiTestCode} autoComplete="off" data-1p-ignore data-lpignore="true" placeholder="TEST12345" />
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="capiEnabled" defaultChecked={v.capiEnabled} /> {t("integ.capiEnabled")}
          </label>
          {(v.capiEnabled || v.capiStats.sent + v.capiStats.pending + v.capiStats.failed > 0) && (
            <p className="mt-2 text-xs text-muted-foreground">{t("integ.capiStats", v.capiStats)}</p>
          )}
          {v.capiLastError && <p className="mt-1 text-xs text-red-600">{t("integ.capiLastError", { error: v.capiLastError })}</p>}
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-3 text-sm font-semibold">{t("integ.webhookTitle")}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Callback URL">
              <div className="flex gap-2">
                <Input readOnly value={v.webhookUrl} />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(v.webhookUrl)} title={t("integ.copy")}>
                  <Copy />
                </Button>
              </div>
            </Field>
            <Field label="Verify Token" hint={t("integ.verifyHint")}>
              <div className="flex gap-2">
                <Input name="verifyToken" defaultValue={v.verifyToken} autoComplete="off" data-1p-ignore data-lpignore="true" />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(v.verifyToken)} title={t("integ.copy")}>
                  <Copy />
                </Button>
              </div>
            </Field>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={v.enabled} /> {t("integ.enabled")}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            <CheckCircle2 /> {t("common.save")}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 border-t pt-5">
        <Button variant="outline" disabled={pending} onClick={() => run(checkTokenAction)}>
          <ShieldCheck /> {t("integ.checkToken")}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => run(syncNowAction)}>
          <RefreshCw className={pending ? "animate-spin" : ""} /> {t("integ.syncNow")}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => run(subscribeWebhookAction)}>
          <Webhook /> {t("integ.subscribe")}
        </Button>
        <Button variant="outline" disabled={pending || !v.adAccountId} onClick={() => run(syncSpendAction)}>
          <Wallet /> {t("integ.syncSpend")}
        </Button>
        <Button variant="outline" disabled={pending || !v.capiDatasetId || !v.hasCapiToken} onClick={() => run(checkCapiAction)}>
          <Target /> {t("integ.capiCheck")}
        </Button>
      </div>
    </div>
  );
}

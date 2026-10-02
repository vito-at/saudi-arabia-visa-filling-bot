"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { formatDateTime, formatNumber } from "@/lib/format";
import { refreshRateAction, saveGeneralAction, saveRateAction, setUsdRateAction } from "@/app/(app)/settings/actions";
import { useRun } from "./use-run";
import { useI18n } from "@/i18n/client";

export interface GeneralView {
  distributionMode: "MANUAL" | "ROUND_ROBIN";
  unprocessedAlertMin: number;
  usdRate: number;
  usdRateCost: number;
  usdRateSource: "MANUAL" | "IPAK_YULI";
  usdRateUpdatedAt: string | null;
  usdRateError: string | null;
  managersCount: number;
  rateSources: string[];
}

export function GeneralForm({ v }: { v: GeneralView }) {
  const { pending, run } = useRun();
  const { t, f } = useI18n();
  const [source, setSource] = useState(v.usdRateSource);
  const [manualRate, setManualRate] = useState(String(v.usdRate));
  const [manualCost, setManualCost] = useState(String(v.usdRateCost));
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{t("general.distribution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={(fd) => run(() => saveGeneralAction(fd))} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={t("general.mode")}
              hint={t("general.modeHint", { n: v.managersCount })}
            >
              <NativeSelect name="distributionMode" defaultValue={v.distributionMode}>
                <option value="MANUAL">{t("general.modeManual")}</option>
                <option value="ROUND_ROBIN">{t("general.modeAuto")}</option>
              </NativeSelect>
            </Field>
            <Field label={t("general.alert")}>
              <Input name="unprocessedAlertMin" type="number" min={1} defaultValue={v.unprocessedAlertMin} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("general.rateTitle")}</CardTitle>
          <div className="text-right text-sm">
            <div className="font-semibold">
              {t("general.rateSale")}: 1 $ = {formatNumber(v.usdRate, 2)} {f.sum}
            </div>
            <div className="font-semibold">
              {t("general.rateCost")}: 1 $ = {formatNumber(v.usdRateCost, 2)} {f.sum}
            </div>
            <div className="text-xs text-muted-foreground">{v.usdRateUpdatedAt ? t("general.rateUpdated", { date: formatDateTime(v.usdRateUpdatedAt) }) : t("general.rateNever")}</div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("general.rateExplain")}
          </p>
          {v.usdRateError && source === "IPAK_YULI" && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <b>{t("general.rateFailed")}</b>{t("general.rateFailedTail")} {v.usdRateError}
            </div>
          )}
          <div className="mb-5 rounded-lg border bg-secondary/50 p-4">
            <div className="mb-2 text-sm font-semibold">{t("general.manualTitle")}</div>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => setUsdRateAction(manualRate, manualCost));
              }}
            >
              <Field label={t("general.rateSale")} hint={`${t("general.sumPerUsd", { sum: f.sum })}, ${t("general.rateSaleHint")}`} className="w-full sm:w-56">
                <Input value={manualRate} onChange={(e) => setManualRate(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label={t("general.rateCost")} hint={`${t("general.sumPerUsd", { sum: f.sum })}, ${t("general.rateCostHint")}`} className="w-full sm:w-56">
                <Input value={manualCost} onChange={(e) => setManualCost(e.target.value)} inputMode="decimal" />
              </Field>
              <Button type="submit" disabled={pending}>
                {t("general.setRate")}
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              {source === "IPAK_YULI"
                ? t("general.manualHintAuto")
                : t("general.manualHint")}
            </p>
          </div>
          <div className="mb-2 text-sm font-semibold">{t("general.sourceTitle")}</div>
          <form action={(fd) => run(() => saveRateAction(fd))} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("general.source")}>
              <NativeSelect name="usdRateSource" value={source} onChange={(e) => setSource(e.target.value as "MANUAL" | "IPAK_YULI")}>
                <option value="IPAK_YULI">{t("general.sourceIpak")}</option>
                <option value="MANUAL">{t("general.sourceManual")}</option>
              </NativeSelect>
            </Field>
            <input type="hidden" name="usdRate" value={manualRate} />
            <input type="hidden" name="usdRateCost" value={manualCost} />
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={pending}>
                {t("common.save")}
              </Button>
              {source === "IPAK_YULI" && (
                <Button type="button" variant="outline" disabled={pending} onClick={() => run(refreshRateAction)}>
                  <RefreshCw className={pending ? "animate-spin" : ""} /> {t("general.refresh")}
                </Button>
              )}
            </div>
          </form>
          {source === "IPAK_YULI" && (
            <p className="mt-4 text-xs text-muted-foreground">
              {t("general.scheduleHint", { sources: v.rateSources.join(", ") })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

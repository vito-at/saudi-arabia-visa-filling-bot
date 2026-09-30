"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { formatDateTime, formatNumber } from "@/lib/format";
import { refreshRateAction, saveGeneralAction, saveRateAction } from "@/app/(app)/settings/actions";
import { useRun } from "./use-run";

export interface GeneralView {
  distributionMode: "MANUAL" | "ROUND_ROBIN";
  unprocessedAlertMin: number;
  usdRate: number;
  usdRateSource: "MANUAL" | "IPAK_YULI";
  usdRateSide: "BUY" | "SELL";
  usdRateUpdatedAt: string | null;
  usdRateError: string | null;
  managersCount: number;
  rateSources: string[];
}

export function GeneralForm({ v }: { v: GeneralView }) {
  const { pending, run } = useRun();
  const [source, setSource] = useState(v.usdRateSource);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Распределение лидов</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={(fd) => run(() => saveGeneralAction(fd))} className="grid grid-cols-2 gap-4">
            <Field
              label="Режим"
              hint={`Автоматически — новые лиды по очереди получают активные менеджеры (сейчас ${v.managersCount}). Повторные обращения уходят прежнему менеджеру.`}
            >
              <NativeSelect name="distributionMode" defaultValue={v.distributionMode}>
                <option value="MANUAL">Вручную (администратор назначает / менеджеры берут сами)</option>
                <option value="ROUND_ROBIN">Автоматически по очереди (round-robin)</option>
              </NativeSelect>
            </Field>
            <Field label="Выделять красным, если лид не взят в работу за, минут">
              <Input name="unprocessedAlertMin" type="number" min={1} defaultValue={v.unprocessedAlertMin} />
            </Field>
            <div className="col-span-2">
              <Button type="submit" disabled={pending}>
                Сохранить
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Курс USD → UZS</CardTitle>
          <div className="text-right text-sm">
            <div className="text-lg font-semibold">1 $ = {formatNumber(v.usdRate, 2)} сум</div>
            <div className="text-xs text-muted-foreground">{v.usdRateUpdatedAt ? `обновлён ${formatDateTime(v.usdRateUpdatedAt)}` : "ещё не обновлялся"}</div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Все отчёты и итоги пересчитываются по этому курсу: сделки в долларах — в сумы и наоборот.
          </p>
          {v.usdRateError && source === "IPAK_YULI" && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <b>Не удалось получить курс автоматически</b>, используется последний известный. {v.usdRateError}
            </div>
          )}
          <form action={(fd) => run(() => saveRateAction(fd))} className="grid grid-cols-3 gap-4">
            <Field label="Источник">
              <NativeSelect name="usdRateSource" value={source} onChange={(e) => setSource(e.target.value as "MANUAL" | "IPAK_YULI")}>
                <option value="IPAK_YULI">Ипак Йули Банк (автоматически)</option>
                <option value="MANUAL">Вручную</option>
              </NativeSelect>
            </Field>
            <Field label="Какой курс брать">
              <NativeSelect name="usdRateSide" defaultValue={v.usdRateSide} disabled={source === "MANUAL"}>
                <option value="SELL">Продажа (банк продаёт $)</option>
                <option value="BUY">Покупка (банк покупает $)</option>
              </NativeSelect>
              {source === "MANUAL" && <input type="hidden" name="usdRateSide" value={v.usdRateSide} />}
            </Field>
            <Field label="Курс, сум за 1 $">
              <Input name="usdRate" defaultValue={String(v.usdRate)} disabled={source !== "MANUAL"} inputMode="decimal" />
            </Field>
            <div className="col-span-3 flex gap-2">
              <Button type="submit" disabled={pending}>
                Сохранить
              </Button>
              {source === "IPAK_YULI" && (
                <Button type="button" variant="outline" disabled={pending} onClick={() => run(refreshRateAction)}>
                  <RefreshCw className={pending ? "animate-spin" : ""} /> Обновить курс сейчас
                </Button>
              )}
            </div>
          </form>
          {source === "IPAK_YULI" && (
            <p className="mt-4 text-xs text-muted-foreground">
              Курс обновляется каждые 2 часа с открытых страниц: {v.rateSources.join(", ")}. Если сайт банка недоступен, используется следующий источник.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

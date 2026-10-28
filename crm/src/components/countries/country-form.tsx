"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { deleteCountryAction, saveCountryAction } from "@/app/(app)/countries/actions";
import { VISA_KINDS, type CountryInput } from "@/lib/countries";
import { CITIZENSHIPS, REGIONS, WORLD, countryName, flag, worldCountry } from "@/lib/world";
import { useI18n } from "@/i18n/client";

/** Карточка страны: создание и правка (администратор и визовые специалисты) */
export function CountryForm({ id, initial, canDelete }: { id: string | null; initial: CountryInput; canDelete: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(initial);
  const set = (k: keyof CountryInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveCountryAction(id, v);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("common.saved"));
      const d = res.data!;
      router.push(d.to ? `/countries?from=${d.from}&to=${d.to}` : `/countries?from=${d.from}&id=${d.id}`);
    });
  }
  const remove = () =>
    start(async () => {
      if (!id || !confirm(t("countries.deleteConfirm", { name: initial.name }))) return;
      const res = await deleteCountryAction(id);
      if (!res.ok) return void toast.error(res.error);
      router.push(`/countries?from=${initial.citizenship}`);
    });

  return (
    <form onSubmit={save} className="space-y-4">
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("countries.step1")}>
            <NativeSelect value={v.citizenship} onChange={set("citizenship")}>
              {CITIZENSHIPS.map((code) => (
                <option key={code} value={code}>
                  {flag(code)} {countryName(worldCountry(code)!, locale)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("countries.step2")}>
            <NativeSelect value={v.code} onChange={set("code")}>
              <option value="">{t("countries.ownDestination")}</option>
              {REGIONS.map((r) => (
                <optgroup key={r} label={t(`countries.regions.${r}`)}>
                  {WORLD.filter((w) => w.region === r && w.code !== v.citizenship)
                    .sort((a, b) => countryName(a, locale).localeCompare(countryName(b, locale), locale))
                    .map((w) => (
                      <option key={w.code} value={w.code}>
                        {flag(w.code)} {countryName(w, locale)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </NativeSelect>
          </Field>
          {!v.code && (
            <Field label={t("countries.name")}>
              <Input value={v.name} onChange={set("name")} required maxLength={100} placeholder={t("countries.namePh")} />
            </Field>
          )}
          <Field label={t("countries.kind")}>
            <NativeSelect value={v.visaKind} onChange={set("visaKind")}>
              <option value="">—</option>
              {VISA_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`countries.kinds.${k}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">{t("countries.moneyTitle")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("countries.salePrice")}>
            <div className="flex gap-2">
              <Input value={v.salePrice} onChange={set("salePrice")} inputMode="decimal" placeholder="120" />
              <NativeSelect value={v.saleCurrency} onChange={set("saleCurrency")} className="w-24 shrink-0">
                <option value="USD">{t("currency.USD")}</option>
                <option value="UZS">{t("currency.UZS")}</option>
              </NativeSelect>
            </div>
          </Field>
          <Field label={t("countries.consularFee")}>
            <Input value={v.consularFee} onChange={set("consularFee")} maxLength={300} placeholder={t("countries.consularFeePh")} />
          </Field>
          <Field label={t("countries.processingTime")}>
            <Input value={v.processingTime} onChange={set("processingTime")} maxLength={200} placeholder={t("countries.processingTimePh")} />
          </Field>
          <Field label={t("countries.validity")}>
            <Input value={v.validity} onChange={set("validity")} maxLength={200} placeholder={t("countries.validityPh")} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">{t("countries.applyTitle")}</h2>
        <Field label={t("countries.whereToApply")}>
          <Textarea value={v.whereToApply} onChange={set("whereToApply")} maxLength={1000} rows={2} placeholder={t("countries.whereToApplyPh")} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("countries.applyUrl")}>
            <Input value={v.applyUrl} onChange={set("applyUrl")} inputMode="url" placeholder="thaievisa.go.th" />
          </Field>
          <Field label={t("countries.appointmentUrl")}>
            <Input value={v.appointmentUrl} onChange={set("appointmentUrl")} inputMode="url" placeholder="visa.vfsglobal.com/uzb" />
          </Field>
          <Field label={t("countries.visaCenter")}>
            <Input value={v.visaCenter} onChange={set("visaCenter")} maxLength={200} placeholder="VFS Global" />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <Field label={t("countries.documents")} hint={t("countries.documentsHint")}>
          <Textarea value={v.documents} onChange={set("documents")} rows={10} placeholder={t("countries.documentsPh")} />
        </Field>
        <Field label={t("countries.notes")}>
          <Textarea value={v.notes} onChange={set("notes")} rows={4} placeholder={t("countries.notesPh")} />
        </Field>
        <Field label={t("countries.sources")} hint={t("countries.sourcesHint")}>
          <Textarea value={v.sources} onChange={set("sources")} rows={3} placeholder="https://www.mfa.go.th" />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {id && canDelete ? (
          <Button type="button" variant="ghost" className="text-red-600" disabled={pending} onClick={remove}>
            <Trash2 /> {t("common.delete")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}

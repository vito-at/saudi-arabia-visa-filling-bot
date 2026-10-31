"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { deleteCountryAction, saveCountryAction } from "@/app/(app)/countries/actions";
import { MAX_PRICES, VISA_KINDS, type CountryInput, type PriceInput } from "@/lib/countries";
import { CITIZENSHIPS, WORLD, countryName, countrySearch, worldCountry } from "@/lib/world";
import { CountryCombo, type ComboOption } from "@/components/countries/country-combo";
import { useI18n } from "@/i18n/client";

/** «Своё направление» в выборе страны */
const OWN = "__own";

/** Карточка страны: создание и правка (администратор и визовые специалисты) */
export function CountryForm({ id, initial, canDelete }: { id: string | null; initial: CountryInput; canDelete: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  // хотя бы одна строка цены — чтобы сразу было куда вписать
  const [v, setV] = useState<CountryInput>(initial.prices.length ? initial : { ...initial, prices: [{ label: "", price: "", currency: "USD" }] });
  const destinations: ComboOption[] = WORLD.filter((w) => w.code !== v.citizenship)
    .map((w) => ({ code: w.code, label: countryName(w, locale), search: countrySearch(w) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  const set = (k: keyof CountryInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const setPrice = (i: number, k: keyof PriceInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, prices: v.prices.map((p, j) => (j === i ? { ...p, [k]: e.target.value } : p)) });
  const addPrice = () => setV({ ...v, prices: [...v.prices, { label: "", price: "", currency: v.prices.at(-1)?.currency ?? "USD" }] });
  const removePrice = (i: number) => setV({ ...v, prices: v.prices.filter((_, j) => j !== i) });

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
          <div className="space-y-1.5">
            <Label>{t("countries.step1")}</Label>
            <CountryCombo
              value={v.citizenship}
              onChange={(code) => setV({ ...v, citizenship: code })}
              options={CITIZENSHIPS.map((code) => worldCountry(code)!).map((w) => ({ code: w.code, label: countryName(w, locale), search: countrySearch(w) }))}
              placeholder={t("countries.choose")}
              searchPlaceholder={t("countries.searchCountry")}
              emptyText={t("countries.nothingFound")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("countries.step2")}</Label>
            <CountryCombo
              value={v.code || OWN}
              onChange={(code) => setV({ ...v, code: code === OWN ? "" : code })}
              options={destinations}
              extra={{ code: OWN, label: t("countries.ownDestination") }}
              placeholder={t("countries.choose")}
              searchPlaceholder={t("countries.searchCountry")}
              emptyText={t("countries.nothingFound")}
            />
          </div>
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
        <div className="space-y-1.5">
          <Label>{t("countries.salePrice")}</Label>
          <p className="text-xs text-muted-foreground">{t("countries.pricesHint")}</p>
          {v.prices.map((p, i) => (
            <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
              <Input value={p.label} onChange={setPrice(i, "label")} className="basis-full sm:basis-auto" maxLength={60} placeholder={t("countries.priceLabelPh")} aria-label={t("countries.priceLabel")} />
              <Input value={p.price} onChange={setPrice(i, "price")} inputMode="decimal" placeholder="40" className="w-auto min-w-0 flex-1 sm:w-28 sm:flex-none" aria-label={t("countries.salePrice")} />
              <NativeSelect value={p.currency} onChange={setPrice(i, "currency")} className="w-24 shrink-0" aria-label={t("countries.currency")}>
                <option value="USD">{t("currency.USD")}</option>
                <option value="UZS">{t("currency.UZS")}</option>
              </NativeSelect>
              <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removePrice(i)} aria-label={t("common.delete")}>
                <X />
              </Button>
            </div>
          ))}
          {v.prices.length < MAX_PRICES && (
            <Button type="button" variant="outline" size="sm" onClick={addPrice}>
              <Plus /> {t("countries.addPrice")}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

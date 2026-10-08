"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { formatDate, formatNumber, toInputDate } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import { convertCost, convertRevenue, dealProfitInSale } from "@/lib/money";
import { createDealAction, updateDealAction, type DealInput } from "@/app/(app)/deals/actions";
import { useIsAdmin, useRates } from "@/components/layout/role-context";
import type { ServiceType } from "@prisma/client";
import { matchVisaCountry, SERVICE_TYPES, VISA_COUNTRIES } from "@/lib/constants";
import { serviceLabel } from "@/i18n/labels";
import { composeProduct, joinDetails, splitProduct, type LeadPrefill } from "@/lib/deals";

export interface DealDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  /** если задан — после сохранения лид переводится в «Продано» */
  wonStatusId?: string | null;
  /** курс продажи $; себестоимость пересчитывается по курсу покупки $ из контекста */
  rate: number;
  deal?: { id: string } & DealInput;
  /** данные лида: новая сделка заполняется ими (продукт, направление, даты, туристы, страна визы) */
  lead?: LeadPrefill | null;
  onSaved?: () => void;
}

const OTHER_COUNTRY = "__other";

const parse = (s: string) => Number(String(s).replace(/\s/g, "").replace(",", ".")) || 0;

export function DealDialog({ open, onOpenChange, leadId, wonStatusId, rate, deal, lead, onSaved }: DealDialogProps) {
  const [form, setForm] = useState<DealInput>(
    deal ?? { amount: "", cost: "", currency: "USD", costCurrency: "USD", paidAt: toInputDate(new Date()), product: "" },
  );
  const { t, f, locale } = useI18n();
  const [pending, start] = useTransition();
  // продукт: тип услуги из списка + необязательные подробности; новая сделка заполняется данными лида
  const labels = Object.fromEntries(SERVICE_TYPES.map((s) => [s, serviceLabel(t, s)])) as Record<ServiceType, string>;
  const tripText = (l: LeadPrefill) =>
    joinDetails([l.destination, l.travelers ? t("deal.people", { n: l.travelers }) : null]);
  const [product, setProduct] = useState(() =>
    deal ? splitProduct(deal.product, labels) : { service: (lead?.serviceType ?? "") as ServiceType | "", details: lead && lead.serviceType !== "VISA" ? tripText(lead) : "" },
  );
  // виза (только новая сделка): страна из списка и количество заявлений — как в карточке лида
  const visaMode = !deal && product.service === "VISA";
  const knownCountry = matchVisaCountry(lead?.destination);
  const [country, setCountry] = useState(knownCountry ?? (lead?.destination ? OTHER_COUNTRY : ""));
  const [otherCountry, setOtherCountry] = useState(knownCountry ? "" : (lead?.destination ?? ""));
  const [applications, setApplications] = useState(lead?.visaApplications ? String(lead.visaApplications) : "");
  // количество продаж (виза на 6 человек — 6) меняет только администратор; пока его не трогали, у визы оно равно числу заявлений
  const [quantity, setQuantity] = useState(deal?.quantity ? String(deal.quantity) : "");
  const quantityValue = quantity || (visaMode && applications ? applications : "1");
  const prefilled = !deal && !!lead && (!!lead.serviceType || !!lead.destination);
  // менеджер указывает только сумму продажи — себестоимость вносит администратор
  const isAdmin = useIsAdmin();
  // при закрытии сделки себестоимость не вводится — её указывает администратор потом («Ждут себестоимость»); правит только он
  const showCost = isAdmin && !!deal;
  const ctx = useRates();
  const rates = { sale: ctx.sale || rate, cost: ctx.cost || rate };
  const set = (k: keyof DealInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });
  // валюта себестоимости по умолчанию следует за валютой продажи, пока её не выбрали отдельно
  const [costCurTouched, setCostCurTouched] = useState(!!deal && deal.costCurrency !== deal.currency);
  const costCurrency = form.costCurrency ?? form.currency;

  const amountNum = parse(form.amount);
  const costNum = parse(form.cost);
  const canConvert = rates.sale > 0 && rates.cost > 0;
  const mixed = costCurrency !== form.currency;
  // прибыль в валюте продажи: себестоимость в другой валюте — по курсу, при котором она больше
  const profit = canConvert || !mixed ? dealProfitInSale({ amount: amountNum, cost: costNum, currency: form.currency, costCurrency }, rates) : 0;
  const other = form.currency === "USD" ? "UZS" : "USD";
  // прибыль в другой валюте: выручка по минимуму, себестоимость по максимуму
  const profitOther = canConvert ? convertRevenue(amountNum, form.currency, other, rates) - convertCost(costNum, costCurrency, other, rates) : 0;
  const costRateUsed = costCurrency === "USD" ? Math.max(rates.sale, rates.cost) : Math.min(rates.sale, rates.cost);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      if (!product.service) return void toast.error(t("deal.productChoose"));
      let input: DealInput = { ...form, product: composeProduct(labels[product.service], product.details), service: product.service };
      if (visaMode) {
        const destination = country === OTHER_COUNTRY ? otherCountry.trim() : country;
        const known = VISA_COUNTRIES.find((c) => c.ru === destination);
        const n = Number(applications) || null;
        const details = joinDetails([known ? (known[locale] ?? known.ru) : destination, n ? t("deal.applicationsShort", { n }) : null]);
        input = { ...input, product: composeProduct(labels.VISA, details), destination: destination || null, visaApplications: n };
      }
      if (isAdmin) input = { ...input, quantity: quantityValue };
      const res = deal ? await updateDealAction(deal.id, input) : await createDealAction(leadId, input, wonStatusId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(deal ? t("deal.updated") : wonStatusId ? t("deal.savedWon") : t("deal.added"));
      onSaved?.();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={deal ? t("deal.editTitle") : t("deal.title")} description={wonStatusId ? t("deal.wonHint") : undefined}>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("deal.product")}>
            <NativeSelect name="service" value={product.service} onChange={(e) => setProduct({ ...product, service: e.target.value as ServiceType })} required>
              <option value="" disabled>
                {t("deal.productChoose")}
              </option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {visaMode ? (
            <>
              <Field label={t("lead.visaCountry")}>
                <div className="space-y-2">
                  <NativeSelect name="visaCountry" value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="">—</option>
                    {VISA_COUNTRIES.map((c) => (
                      <option key={c.ru} value={c.ru}>
                        {c[locale] ?? c.ru}
                      </option>
                    ))}
                    <option value={OTHER_COUNTRY}>{t("lead.visaOther")}</option>
                  </NativeSelect>
                  {country === OTHER_COUNTRY && (
                    <Input value={otherCountry} onChange={(e) => setOtherCountry(e.target.value)} placeholder={t("lead.visaOtherPh")} aria-label={t("lead.visaOtherPh")} required />
                  )}
                </div>
              </Field>
              <Field label={t("lead.field.visaApplications")}>
                <Input name="visaApplications" type="number" min={1} max={500} value={applications} onChange={(e) => setApplications(e.target.value)} placeholder="1" />
              </Field>
            </>
          ) : (
            <Field label={t("deal.details")}>
              <Input name="details" value={product.details} onChange={(e) => setProduct({ ...product, details: e.target.value })} placeholder={t("deal.productPh")} />
            </Field>
          )}
          {prefilled && <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">{t("deal.prefillHint")}</p>}
          {isAdmin && (
            <Field label={t("deal.quantity")} hint={t("deal.quantityHint")} className="sm:col-span-2">
              <Input name="quantity" type="number" min={1} max={500} value={quantityValue} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
          )}
          <Field label={t("deal.amount")}>
            <Input value={form.amount} onChange={set("amount")} inputMode="decimal" required />
          </Field>
          <Field label={t("deal.currency")}>
            <NativeSelect
              value={form.currency}
              onChange={(e) => {
                const cur = e.target.value as DealInput["currency"];
                setForm({ ...form, currency: cur, costCurrency: costCurTouched ? costCurrency : cur });
              }}
            >
              <option value="USD">{t("currency.USD")}</option>
              <option value="UZS">{t("currency.UZS")}</option>
            </NativeSelect>
          </Field>
          {showCost && (
            <>
              <Field label={t("deal.cost")} hint={t("deal.costHint")}>
                <Input value={form.cost} onChange={set("cost")} inputMode="decimal" />
              </Field>
              <Field label={t("deal.costCurrency")}>
                <NativeSelect
                  value={costCurrency}
                  onChange={(e) => {
                    setCostCurTouched(true);
                    setForm({ ...form, costCurrency: e.target.value as DealInput["currency"] });
                  }}
                >
                  <option value="USD">{t("currency.USD")}</option>
                  <option value="UZS">{t("currency.UZS")}</option>
                </NativeSelect>
              </Field>
            </>
          )}
          <Field label={t("deal.paidAt")}>
            <Input type="date" value={form.paidAt} onChange={set("paidAt")} required />
          </Field>
          {!deal && <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground sm:col-span-2">{t("deal.costByAdmin")}</p>}
          {showCost && (
          <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("deal.profit")}</span>
              <b className={profit < 0 ? "text-red-600" : "text-emerald-700"}>{f.money(profit, form.currency)}</b>
            </div>
            {canConvert && (
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{t("deal.inOther", { cur: other })}</span>
                <span>{f.money(profitOther, other)}</span>
              </div>
            )}
            {mixed && canConvert && <p className="mt-1.5 text-xs text-muted-foreground">{t("deal.costConverted", { cur: costCurrency, rate: formatNumber(costRateUsed), sum: f.sum })}</p>}
          </div>
          )}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

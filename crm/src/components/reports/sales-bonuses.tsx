"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { addSalesBonusAction, deleteSalesBonusAction } from "@/app/(app)/reports/actions";
import { SERVICE_TYPES, VISA_COUNTRIES } from "@/lib/constants";
import { formatDate, toInputDate } from "@/lib/format";
import { serviceLabel } from "@/i18n/labels";
import { useI18n } from "@/i18n/client";

export interface SalesBonusRow {
  id: string;
  serviceType: string;
  country: string | null;
  amount: number;
  currency: "UZS" | "USD";
  fromDate: string;
}

/** Фиксированная оплата всем менеджерам за каждую проданную единицу (например, 5 $ за визу в ОАЭ) — вместо процента */
export function SalesBonuses({ rows }: { rows: SalesBonusRow[] }) {
  const { t, f, locale } = useI18n();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ serviceType: "VISA", country: "", amount: "", currency: "USD", fromDate: toInputDate(new Date()) });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const countryName = (ru: string) => {
    const c = VISA_COUNTRIES.find((x) => x.ru === ru);
    return c ? (c[locale] ?? c.ru) : ru;
  };
  const label = (r: { serviceType: string; country: string | null }) => `${serviceLabel(t, r.serviceType)}${r.country ? `: ${countryName(r.country)}` : ""}`;
  const add = () =>
    start(async () => {
      const res = await addSalesBonusAction(v);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("common.saved"));
      setV({ ...v, amount: "" });
    });
  const remove = (id: string) =>
    start(async () => {
      if (!confirm(t("plans.bonusDeleteConfirm"))) return;
      const res = await deleteSalesBonusAction(id);
      if (!res.ok) toast.error(res.error);
    });
  return (
    <div className="space-y-3 px-5 pb-5">
      <p className="text-xs text-muted-foreground">{t("plans.bonusesHint")}</p>
      {rows.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">{t("plans.bonusText", { sum: f.money(r.amount, r.currency), service: label(r), date: formatDate(r.fromDate) })}</span>
              <Button size="icon-sm" variant="ghost" title={t("common.delete")} disabled={pending} onClick={() => remove(r.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label={t("deal.product")}>
          <NativeSelect value={v.serviceType} onChange={set("serviceType")}>
            {SERVICE_TYPES.filter((s) => s !== "FLIGHTS").map((s) => (
              <option key={s} value={s}>
                {serviceLabel(t, s)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {v.serviceType === "VISA" && (
          <Field label={t("lead.visaCountry")}>
            <NativeSelect value={v.country} onChange={set("country")}>
              <option value="">{t("plans.ruleAnyCountry")}</option>
              {VISA_COUNTRIES.map((c) => (
                <option key={c.ru} value={c.ru}>
                  {countryName(c.ru)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label={t("plans.bonusAmount")}>
          <Input inputMode="decimal" value={v.amount} onChange={set("amount")} placeholder="5" />
        </Field>
        <Field label={t("deal.currency")}>
          <NativeSelect value={v.currency} onChange={set("currency")}>
            <option value="USD">{t("currency.USD")}</option>
            <option value="UZS">{t("currency.UZS")}</option>
          </NativeSelect>
        </Field>
        <Field label={t("plans.ruleFromDate")}>
          <Input type="date" value={v.fromDate} onChange={set("fromDate")} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={pending || !v.amount.trim()} onClick={add}>
          <Plus /> {t("plans.bonusAdd")}
        </Button>
      </div>
    </div>
  );
}

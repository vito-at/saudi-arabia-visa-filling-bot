"use client";

import { useState } from "react";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { matchVisaCountry, SERVICE_TYPES, VISA_COUNTRIES } from "@/lib/constants";
import { serviceLabel } from "@/i18n/labels";
import { useI18n } from "@/i18n/client";

const OTHER = "__other";

/**
 * «Тип услуги» и «Направление». Для визовой поддержки направление выбирается из списка стран,
 * а при «Другое» появляется поле для страны. В форму уходят обычные serviceType и destination.
 */
export function ServiceDestinationFields({ service, destination, placeholder }: { service?: string | null; destination?: string | null; placeholder?: string }) {
  const { t, locale } = useI18n();
  const [type, setType] = useState(service ?? "");
  const known = matchVisaCountry(destination);
  const [country, setCountry] = useState(known ?? (destination ? OTHER : ""));
  const [other, setOther] = useState(known ? "" : destination ?? "");
  const [text, setText] = useState(destination ?? "");
  const visa = type === "VISA";
  const value = visa ? (country === OTHER ? other.trim() : country) : text;

  return (
    <>
      <Field label={t("lead.field.service")}>
        <NativeSelect name="serviceType" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">—</option>
          {SERVICE_TYPES.map((k) => (
            <option key={k} value={k}>
              {serviceLabel(t, k)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={visa ? t("lead.visaCountry") : t("lead.field.destination")}>
        <input type="hidden" name="destination" value={value} />
        {visa ? (
          <div className="space-y-2">
            <NativeSelect value={country} onChange={(e) => setCountry(e.target.value)} aria-label={t("lead.visaCountry")}>
              <option value="">—</option>
              {VISA_COUNTRIES.map((c) => (
                <option key={c.ru} value={c.ru}>
                  {c[locale] ?? c.ru}
                </option>
              ))}
              <option value={OTHER}>{t("lead.visaOther")}</option>
            </NativeSelect>
            {country === OTHER && <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder={t("lead.visaOtherPh")} aria-label={t("lead.visaOtherPh")} required autoFocus />}
          </div>
        ) : (
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={t("lead.field.destination")} />
        )}
      </Field>
    </>
  );
}

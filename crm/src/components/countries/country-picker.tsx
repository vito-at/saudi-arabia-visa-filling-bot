"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Field, NativeSelect } from "@/components/ui/input";
import { CITIZENSHIPS, REGIONS, WORLD, countryName, flag, worldCountry } from "@/lib/world";
import { useI18n } from "@/i18n/client";

/** Шаг 1 — гражданство (по умолчанию Узбекистан), шаг 2 — куда едет; выбор сразу открывает информацию */
export function CountryPicker({ from, to, filled }: { from: string; to: string | null; filled: string[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const go = (f: string, dest: string | null) => router.push(`/countries?from=${f}${dest ? `&to=${dest}` : ""}`);
  const has = new Set(filled);
  const byName = (a: (typeof WORLD)[number], b: (typeof WORLD)[number]) => countryName(a, locale).localeCompare(countryName(b, locale), locale);
  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1.6fr]">
      <Field label={t("countries.step1")}>
        <NativeSelect value={from} onChange={(e) => go(e.target.value, to && to !== e.target.value ? to : null)} className="h-11 text-base">
          {CITIZENSHIPS.map((code) => {
            const w = worldCountry(code)!;
            return (
              <option key={code} value={code}>
                {flag(code)} {countryName(w, locale)}
              </option>
            );
          })}
        </NativeSelect>
      </Field>
      <ArrowRight className="mb-3 hidden size-5 text-muted-foreground sm:block" />
      <Field label={t("countries.step2")}>
        <NativeSelect value={to ?? ""} onChange={(e) => go(from, e.target.value || null)} className="h-11 text-base">
          <option value="">{t("countries.choose")}</option>
          {REGIONS.map((r) => (
            <optgroup key={r} label={t(`countries.regions.${r}`)}>
              {WORLD.filter((w) => w.region === r && w.code !== from)
                .sort(byName)
                .map((w) => (
                  <option key={w.code} value={w.code}>
                    {flag(w.code)} {countryName(w, locale)}
                    {has.has(w.code) ? " ✓" : ""}
                  </option>
                ))}
            </optgroup>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}

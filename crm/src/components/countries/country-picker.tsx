"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Label } from "@/components/ui/input";
import { CountryCombo, type ComboOption } from "@/components/countries/country-combo";
import { CITIZENSHIPS, REGIONS, WORLD, countryName, countrySearch, worldCountry } from "@/lib/world";
import { useI18n } from "@/i18n/client";

/** Шаг 1 — гражданство (по умолчанию Узбекистан), шаг 2 — куда едет; поиск по названию, выбор сразу открывает информацию */
export function CountryPicker({ from, to, filled }: { from: string; to: string | null; filled: string[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const go = (f: string, dest: string | null) => router.push(`/countries?from=${f}${dest ? `&to=${dest}` : ""}`);
  const has = useMemo(() => new Set(filled), [filled]);
  const citizenships: ComboOption[] = useMemo(
    () => CITIZENSHIPS.map((code) => worldCountry(code)!).map((w) => ({ code: w.code, label: countryName(w, locale), search: countrySearch(w) })),
    [locale],
  );
  // страны по частям света, внутри — по алфавиту на языке пользователя
  const destinations: ComboOption[] = useMemo(
    () =>
      REGIONS.flatMap((r) =>
        WORLD.filter((w) => w.region === r && w.code !== from)
          .sort((a, b) => countryName(a, locale).localeCompare(countryName(b, locale), locale))
          .map((w) => ({ code: w.code, label: countryName(w, locale), region: r, search: countrySearch(w), mark: has.has(w.code) })),
      ),
    [from, locale, has],
  );
  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1.6fr]">
      <div className="space-y-1.5">
        <Label>{t("countries.step1")}</Label>
        <CountryCombo
          value={from}
          onChange={(code) => go(code, to && to !== code ? to : null)}
          options={citizenships}
          placeholder={t("countries.choose")}
          searchPlaceholder={t("countries.searchCountry")}
          emptyText={t("countries.nothingFound")}
        />
      </div>
      <ArrowRight className="mb-3 hidden size-5 text-muted-foreground sm:block" />
      <div className="space-y-1.5">
        <Label>{t("countries.step2")}</Label>
        <CountryCombo
          value={to}
          onChange={(code) => go(from, code)}
          options={destinations}
          placeholder={t("countries.choose")}
          searchPlaceholder={t("countries.searchCountry")}
          emptyText={t("countries.nothingFound")}
          regionLabel={(r) => t(`countries.regions.${r}`)}
        />
      </div>
    </div>
  );
}

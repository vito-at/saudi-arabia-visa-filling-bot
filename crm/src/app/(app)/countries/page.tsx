import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { CountryPicker } from "@/components/countries/country-picker";
import { CountryInfo } from "@/components/countries/country-info";
import { Flag } from "@/components/countries/flag";
import { prisma } from "@/lib/db";
import { canEditCountries } from "@/lib/countries";
import { DEFAULT_CITIZENSHIP, REGIONS, countryName, isCitizenship, worldCountry } from "@/lib/world";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

/** «Страны и визы»: выбрать гражданство и страну поездки — сразу видно, нужна ли виза, где и как делать, сколько стоит */
export default async function CountriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const i18n = await getI18n();
  const { t, locale } = i18n;
  const fromParam = sp(params, "from");
  const from = isCitizenship(fromParam) ? fromParam : DEFAULT_CITIZENSHIP;
  const to = worldCountry(sp(params, "to"));
  const customId = sp(params, "id");
  const include = { updatedBy: { select: { name: true } }, verifiedBy: { select: { name: true } } } as const;
  const [record, filled] = await Promise.all([
    customId
      ? prisma.visaCountry.findFirst({ where: { id: customId, citizenship: from }, include })
      : to
        ? prisma.visaCountry.findUnique({ where: { citizenship_code: { citizenship: from, code: to.code } }, include })
        : null,
    prisma.visaCountry.findMany({ where: { citizenship: from }, select: { id: true, code: true, name: true, visaKind: true, verifiedAt: true }, orderBy: { name: "asc" } }),
  ]);
  const editable = canEditCountries(user.role);
  const fromW = worldCountry(from)!;
  const nameOf = (code: string | null, name: string) => {
    const w = worldCountry(code);
    return w ? countryName(w, locale) : name;
  };
  /** «🇺🇿 Узбекистан → 🇹🇭 Таиланд» — флаги картинками */
  const destCode = record?.code ?? to?.code ?? null;
  const route =
    record || to ? (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <Flag code={from} /> {countryName(fromW, locale)} <span aria-hidden>→</span> {destCode && <Flag code={destCode} />}
        {record ? nameOf(record.code, record.name) : to ? countryName(to, locale) : ""}
      </span>
    ) : null;
  // популярные направления — сверху; остальные — по частям света
  const POPULAR = ["TR", "AE", "TH", "VN", "MY", "ID", "EG", "SA", "CN", "GE", "RU", "KZ", "IT", "DE", "GB", "US"];
  const chip = (r: (typeof filled)[number]) => (
    <Link
      key={r.id}
      href={r.code ? `/countries?from=${from}&to=${r.code}` : `/countries?from=${from}&id=${r.id}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-accent",
        r.verifiedAt ? "border-emerald-300 dark:border-emerald-800" : "",
      )}
      title={r.verifiedAt ? t("countries.verifiedTitle") : t("countries.notVerifiedTitle")}
    >
      {r.code && <Flag code={r.code} />}
      {nameOf(r.code, r.name)}
      {r.verifiedAt && <span className="text-emerald-600">✓</span>}
    </Link>
  );
  const byName = (a: (typeof filled)[number], b: (typeof filled)[number]) => nameOf(a.code, a.name).localeCompare(nameOf(b.code, b.name), locale);
  const popular = POPULAR.flatMap((code) => filled.filter((r) => r.code === code));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title={t("countries.title")} description={t("countries.description")} />
      <Card className="p-4 sm:p-5">
        <CountryPicker from={from} to={to?.code ?? null} filled={filled.flatMap((r) => (r.code ? [r.code] : []))} />
      </Card>

      {record ? (
        <CountryInfo c={record} route={route} i18n={i18n} canEdit={editable} isAdmin={user.role === "ADMIN"} />
      ) : to ? (
        <Card className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <Search className="size-8 text-muted-foreground" />
          <div className="text-lg font-semibold">{route}</div>
          <p className="max-w-md text-sm text-muted-foreground">{t("countries.noInfo")}</p>
          {editable && (
            <Link href={`/countries/new?from=${from}&to=${to.code}`} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
              <Plus className="size-4" /> {t("countries.fill")}
            </Link>
          )}
        </Card>
      ) : (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t("countries.filledTitle", { n: filled.length })}</h2>
            {editable && (
              <Link href={`/countries/new?from=${from}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-xs hover:bg-accent">
                <Plus className="size-3.5" /> {t("countries.addOwn")}
              </Link>
            )}
          </div>
          {filled.length ? (
            <div className="space-y-5">
              {popular.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("countries.popular")}</h3>
                  <div className="flex flex-wrap gap-2">{popular.map(chip)}</div>
                </section>
              )}
              {REGIONS.map((reg) => {
                const list = filled.filter((r) => (worldCountry(r.code)?.region ?? null) === reg).sort(byName);
                return list.length ? (
                  <section key={reg}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`countries.regions.${reg}`)}</h3>
                    <div className="flex flex-wrap gap-2">{list.map(chip)}</div>
                  </section>
                ) : null;
              })}
              {filled.some((r) => !worldCountry(r.code)) && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("countries.ownList")}</h3>
                  <div className="flex flex-wrap gap-2">{filled.filter((r) => !worldCountry(r.code)).sort(byName).map(chip)}</div>
                </section>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("countries.empty")}</p>
          )}
        </Card>
      )}
    </div>
  );
}

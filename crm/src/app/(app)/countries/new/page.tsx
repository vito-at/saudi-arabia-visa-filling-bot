import { redirect } from "next/navigation";
import { CountryForm } from "@/components/countries/country-form";
import { canEditCountries } from "@/lib/countries";
import { DEFAULT_CITIZENSHIP, isCitizenship, worldCountry } from "@/lib/world";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/i18n/server";

/** Новая карточка: гражданство и страна поездки приходят из выбора в «Странах и визах» */
export default async function NewCountryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  if (!canEditCountries(user.role)) redirect("/countries");
  const { t } = await getI18n();
  const from = sp(params, "from");
  const to = worldCountry(sp(params, "to"));
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">{t("countries.newTitle")}</h1>
      <CountryForm
        id={null}
        canDelete={false}
        initial={{
          citizenship: isCitizenship(from) ? from : DEFAULT_CITIZENSHIP,
          code: to?.code ?? "",
          name: "",
          visaKind: "",
          documents: "",
          questions: "",
          consularFee: "",
          prices: [],
          processingTime: "",
          validity: "",
          whereToApply: "",
          applyUrl: "",
          appointmentUrl: "",
          visaCenter: "",
          notes: "",
          sources: "",
        }}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { CountryForm } from "@/components/countries/country-form";
import { canEditCountries } from "@/lib/countries";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/i18n/server";

export default async function NewCountryPage() {
  const user = await requireUser();
  if (!canEditCountries(user.role)) redirect("/countries");
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">{t("countries.newTitle")}</h1>
      <CountryForm
        id={null}
        canDelete={false}
        initial={{ name: "", visaKind: "", documents: "", consularFee: "", salePrice: "", saleCurrency: "USD", processingTime: "", validity: "", whereToApply: "", applyUrl: "", appointmentUrl: "", visaCenter: "", notes: "" }}
      />
    </div>
  );
}

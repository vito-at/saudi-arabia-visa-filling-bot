import { notFound, redirect } from "next/navigation";
import { CountryForm } from "@/components/countries/country-form";
import { prisma } from "@/lib/db";
import { canEditCountries, readPrices } from "@/lib/countries";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/i18n/server";

export default async function EditCountryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canEditCountries(user.role)) redirect("/countries");
  const { t } = await getI18n();
  const c = await prisma.visaCountry.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">{t("countries.editTitle", { name: c.name })}</h1>
      <CountryForm
        id={c.id}
        canDelete={user.role === "ADMIN"}
        initial={{
          citizenship: c.citizenship,
          code: c.code ?? "",
          name: c.name,
          visaKind: c.visaKind ?? "",
          documents: c.documents,
          consularFee: c.consularFee ?? "",
          prices: readPrices(c.prices).map((p) => ({ label: p.label, price: String(p.price), currency: p.currency })),
          processingTime: c.processingTime ?? "",
          validity: c.validity ?? "",
          whereToApply: c.whereToApply ?? "",
          applyUrl: c.applyUrl ?? "",
          appointmentUrl: c.appointmentUrl ?? "",
          visaCenter: c.visaCenter ?? "",
          notes: c.notes ?? "",
          sources: c.sources ?? "",
        }}
      />
    </div>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { SearchBox } from "@/components/common/search-box";
import { KindBadge } from "@/components/countries/kind-badge";
import { prisma } from "@/lib/db";
import { canEditCountries, documentLines } from "@/lib/countries";
import { toNum } from "@/lib/money";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/i18n/server";

/** Справочник стран для виз: список карточек с главным — вид визы, цена, сбор, срок */
export default async function CountriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { t, f } = await getI18n();
  const q = sp(params, "q")?.trim();
  const countries = await prisma.visaCountry.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { visaCenter: { contains: q, mode: "insensitive" } }, { notes: { contains: q, mode: "insensitive" } }] }
      : undefined,
    orderBy: { name: "asc" },
  });
  const editable = canEditCountries(user.role);

  return (
    <div>
      <PageHeader
        title={t("countries.title")}
        description={t("countries.description")}
        actions={
          <>
            <Suspense>
              <SearchBox placeholder={t("countries.search")} />
            </Suspense>
            {editable && (
              <Link href="/countries/new" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
                <Plus className="size-4" /> {t("countries.add")}
              </Link>
            )}
          </>
        }
      />
      {!countries.length ? (
        <Card>
          <Empty>{q ? t("countries.notFound") : t("countries.empty")}</Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {countries.map((c) => {
            const docs = documentLines(c.documents).length;
            return (
              <Link key={c.id} href={`/countries/${c.id}`} className="block">
                <Card className="h-full space-y-3 p-4 transition-colors hover:border-ring/50 hover:bg-accent/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold">{c.name}</div>
                    {c.visaKind && <KindBadge kind={c.visaKind} label={t(`countries.kinds.${c.visaKind}`)} />}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("countries.salePrice")}</dt>
                      <dd className="font-medium tabular-nums">{c.salePrice !== null ? f.money(toNum(c.salePrice), c.saleCurrency) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("countries.consularFee")}</dt>
                      <dd className="truncate">{c.consularFee ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("countries.processingTime")}</dt>
                      <dd className="truncate">{c.processingTime ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("countries.documents")}</dt>
                      <dd>{docs ? t("countries.docsCount", { n: docs }) : <span className="text-amber-600">{t("countries.docsNone")}</span>}</dd>
                    </div>
                  </dl>
                  {c.visaCenter && <div className="text-xs text-muted-foreground">{t("countries.via", { name: c.visaCenter })}</div>}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

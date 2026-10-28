import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { KindBadge } from "@/components/countries/kind-badge";
import { CopyDocuments } from "@/components/countries/copy-documents";
import { prisma } from "@/lib/db";
import { canEditCountries, documentLines } from "@/lib/countries";
import { formatDateTime } from "@/lib/format";
import { toNum } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/i18n/server";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

function SiteLink({ url }: { url: string }) {
  let host = url;
  try {
    const u = new URL(url);
    host = `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {}
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
      {host}
      <ExternalLink className="size-3.5 shrink-0" />
    </a>
  );
}

/** Карточка страны: всё, что нужно менеджеру и визовику для оформления визы */
export default async function CountryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t, f } = await getI18n();
  const c = await prisma.visaCountry.findUnique({ where: { id }, include: { updatedBy: { select: { name: true } } } });
  if (!c) notFound();
  const docs = documentLines(c.documents);
  const dash = <span className="text-muted-foreground">—</span>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/countries" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label={t("common.back")}>
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="truncate text-xl font-semibold tracking-tight lg:text-2xl">{c.name}</h1>
          {c.visaKind && <KindBadge kind={c.visaKind} label={t(`countries.kinds.${c.visaKind}`)} />}
        </div>
        {canEditCountries(user.role) && (
          <Link href={`/countries/${c.id}/edit`} className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-4 text-sm hover:bg-accent">
            <Pencil className="size-4" /> {t("common.edit")}
          </Link>
        )}
      </div>

      <Card className="px-5 py-2">
        <h2 className="pt-3 text-sm font-semibold">{t("countries.moneyTitle")}</h2>
        <dl className="divide-y">
          <Row label={t("countries.salePrice")}>
            {c.salePrice !== null ? <span className="text-base font-semibold tabular-nums">{f.money(toNum(c.salePrice), c.saleCurrency)}</span> : dash}
          </Row>
          <Row label={t("countries.consularFee")}>{c.consularFee ?? dash}</Row>
          <Row label={t("countries.processingTime")}>{c.processingTime ?? dash}</Row>
          <Row label={t("countries.validity")}>{c.validity ?? dash}</Row>
        </dl>
      </Card>

      <Card className="px-5 py-2">
        <h2 className="pt-3 text-sm font-semibold">{t("countries.applyTitle")}</h2>
        <dl className="divide-y">
          <Row label={t("countries.kind")}>{c.visaKind ? t(`countries.kinds.${c.visaKind}`) : dash}</Row>
          <Row label={t("countries.whereToApply")}>{c.whereToApply ?? dash}</Row>
          <Row label={t("countries.visaCenter")}>{c.visaCenter ?? dash}</Row>
          <Row label={t("countries.applyUrl")}>{c.applyUrl ? <SiteLink url={c.applyUrl} /> : dash}</Row>
          <Row label={t("countries.appointmentUrl")}>{c.appointmentUrl ? <SiteLink url={c.appointmentUrl} /> : dash}</Row>
        </dl>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {t("countries.documents")}
            {docs.length > 0 && <span className="ml-1.5 font-normal text-muted-foreground">({docs.length})</span>}
          </h2>
          {docs.length > 0 && <CopyDocuments name={c.name} lines={docs} />}
        </div>
        {docs.length ? (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
            {docs.map((d, i) => (
              <li key={i} className="pl-1">
                {d}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{t("countries.docsEmpty")}</p>
        )}
      </Card>

      {c.notes && (
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold">{t("countries.notes")}</h2>
          <p className="text-sm break-words whitespace-pre-line">{c.notes}</p>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {t("countries.updated", { date: formatDateTime(c.updatedAt) })}
        {c.updatedBy ? ` · ${c.updatedBy.name}` : ""}
      </p>
    </div>
  );
}

import Link from "next/link";
import type { VisaCountry, VisaKind } from "@prisma/client";
import { AlertTriangle, CheckCircle2, ExternalLink, Pencil, Plane, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CopyDocuments } from "@/components/countries/copy-documents";
import { VerifyButton } from "@/components/countries/verify-button";
import { documentLines, readPrices, sourceLines } from "@/lib/countries";
import { formatDate, formatDateTime } from "@/lib/format";
import { toNum } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { getI18n } from "@/i18n/server";

type I18n = Awaited<ReturnType<typeof getI18n>>;

/** Строка с подписью; пустое поле не показываем — чтобы на странице было только то, что известно */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

export function SiteLink({ url }: { url: string }) {
  let host = url;
  try {
    const u = new URL(url);
    host = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {}
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 font-medium text-primary hover:underline">
      <span className="truncate">{host}</span>
      <ExternalLink className="size-3.5 shrink-0" />
    </a>
  );
}

/** Главный ответ: нужна ли виза и какая — крупно и цветом */
const ANSWER: Record<VisaKind | "NONE", string> = {
  VISA_FREE: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  ON_ARRIVAL: "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200",
  EVISA: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  STICKER: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  NONE: "bg-muted text-foreground",
};

/** Вся информация о поездке: ответ «нужна ли виза», проверка, цена и сроки, где подавать, документы, источники */
export function CountryInfo({
  c,
  route,
  i18n: { t, f },
  canEdit,
  isAdmin,
}: {
  c: VisaCountry & { updatedBy: { name: string } | null; verifiedBy: { name: string } | null };
  route: React.ReactNode;
  i18n: I18n;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const docs = documentLines(c.documents);
  const sources = sourceLines(c.sources);
  const dash = <span className="text-muted-foreground">—</span>;
  const prices = readPrices(c.prices);
  const kind = c.visaKind ?? "NONE";
  return (
    <div className="space-y-4">
      <div className={cn("rounded-xl border p-5", ANSWER[kind])}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm opacity-80">{route}</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {kind === "VISA_FREE" ? <CheckCircle2 className="size-6 shrink-0" /> : <Plane className="size-6 shrink-0" />}
              {t(`countries.answer.${kind}`)}
            </div>
            {c.validity && <div className="mt-1.5 text-sm">{c.validity}</div>}
          </div>
          {canEdit && (
            <Link href={`/countries/${c.id}/edit`} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-xs text-foreground hover:bg-accent">
              <Pencil className="size-3.5" /> {t("common.edit")}
            </Link>
          )}
        </div>
      </div>

      {c.verifiedAt ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <ShieldCheck className="size-5 shrink-0" />
          <span className="flex-1">
            <b>{t("countries.verifiedTitle")}</b> · {formatDate(c.verifiedAt)}
            {c.verifiedBy ? ` · ${c.verifiedBy.name}` : ""}
          </span>
          {isAdmin && <VerifyButton id={c.id} verified />}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-5 shrink-0" />
          <span className="flex-1">
            <b>{t("countries.notVerifiedTitle")}</b> {t("countries.notVerifiedText")}
          </span>
          {isAdmin && <VerifyButton id={c.id} verified={false} />}
        </div>
      )}

      <Card className="px-5 py-2">
        <h2 className="pt-3 text-sm font-semibold">{t("countries.moneyTitle")}</h2>
        <dl className="divide-y">
          <Row label={t("countries.salePrice")}>
            {prices.length ? (
              <ul className="space-y-1">
                {prices.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                    {p.label && <span className="text-muted-foreground">{p.label} —</span>}
                    <span className="text-base font-semibold tabular-nums">{f.money(p.price, p.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : c.salePrice !== null ? (
              <span className="text-base font-semibold tabular-nums">{f.money(toNum(c.salePrice), c.saleCurrency)}</span>
            ) : (
              dash
            )}
          </Row>
          <Row label={t("countries.consularFee")}>{c.consularFee}</Row>
          <Row label={t("countries.processingTime")}>{c.processingTime}</Row>
          <Row label={t("countries.validity")}>{c.validity}</Row>
        </dl>
      </Card>

      {(c.whereToApply || c.visaCenter || c.applyUrl || c.appointmentUrl) && (
        <Card className="px-5 py-2">
          <h2 className="pt-3 text-sm font-semibold">{t("countries.applyTitle")}</h2>
          <dl className="divide-y">
            <Row label={t("countries.whereToApply")}>{c.whereToApply}</Row>
            <Row label={t("countries.visaCenter")}>{c.visaCenter}</Row>
            <Row label={t("countries.applyUrl")}>{c.applyUrl ? <SiteLink url={c.applyUrl} /> : null}</Row>
            <Row label={t("countries.appointmentUrl")}>{c.appointmentUrl ? <SiteLink url={c.appointmentUrl} /> : null}</Row>
          </dl>
        </Card>
      )}

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
          <p className="text-sm text-muted-foreground">{c.visaKind === "VISA_FREE" ? t("countries.docsVisaFree") : t("countries.docsEmpty")}</p>
        )}
      </Card>

      {c.notes && (
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold">{t("countries.notes")}</h2>
          <p className="text-sm break-words whitespace-pre-line">{c.notes}</p>
        </Card>
      )}

      {sources.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold">{t("countries.sources")}</h2>
          <ul className="space-y-1.5 text-sm">
            {sources.map((s) => (
              <li key={s} className="min-w-0">
                <SiteLink url={s} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {t("countries.updated", { date: formatDateTime(c.updatedAt) })}
        {c.updatedBy ? ` · ${c.updatedBy.name}` : ""}
      </p>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refetchSiteAction } from "@/app/(app)/visa/actions";
import type { SiteData } from "@/lib/orient-visa";
import { useI18n } from "@/i18n/client";

export interface SiteInfo {
  number: string | null;
  url: string | null;
  visaType: string | null;
  /** ISO2; null — гражданин Узбекистана */
  nationality: string | null;
  urgent: boolean;
  paidAmount: number | null;
  agency: string | null;
  fetchedAt: string | null;
  fetchError: string | null;
  fetchPending: boolean;
  events: { pending: number; failed: string | null; lastSentAt: string | null };
}

/** Заявка с сайта Orient Visa: сведения о заказе, анкета туристов, состояние обмена с сайтом */
export function SiteCard({ serviceId, info, data }: { serviceId: string; info: SiteInfo; data: SiteData | null }) {
  const { t, f, locale } = useI18n();
  const nat = info.nationality ?? "UZ";
  let natName = nat;
  try {
    natName = new Intl.DisplayNames([locale === "uz" ? "uz-Latn" : locale], { type: "region" }).of(nat) ?? nat;
  } catch {
    // старый браузер без Intl.DisplayNames — показываем код
  }
  const [pending, start] = useTransition();
  const rows: [string, React.ReactNode][] = [
    [t("ov.number"), info.number ?? "—"],
    [t("ov.visaType"), info.visaType ?? "—"],
    [t("ov.nationality"), <span key="nat" className={nat !== "UZ" ? "font-semibold text-amber-700 dark:text-amber-400" : undefined}>{`${natName} (${nat})`}</span>],
    [t("ov.urgent"), info.urgent ? t("ov.yes") : t("ov.no")],
    [t("ov.paid"), info.paidAmount !== null ? f.money(info.paidAmount, "UZS") : "—"],
    ...(info.agency ? ([[t("ov.agency"), info.agency]] as [string, React.ReactNode][]) : []),
  ];
  return (
    <div className="space-y-4 text-sm">
      <dl className="divide-y">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[10rem_1fr] gap-2 py-1.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={info.fetchError ? "text-red-600" : "text-muted-foreground"}>
          {info.fetchError ? t("ov.fetchError", { error: info.fetchError }) : info.fetchPending ? t("ov.fetchPending") : info.fetchedAt ? t("ov.fetchedAt", { at: info.fetchedAt }) : t("ov.fetchPending")}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await refetchSiteAction(serviceId);
              if (!r.ok) return void toast.error(r.error);
              toast.success(t("ov.fetched", { n: r.data ?? 0 }));
            })
          }
        >
          <RefreshCw className={pending ? "animate-spin" : undefined} /> {t("ov.refetch")}
        </Button>
        {info.url && (
          <a href={info.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 hover:bg-accent">
            <ExternalLink className="size-3.5" /> {t("ov.openOnSite")}
          </a>
        )}
      </div>
      <p className={info.events.failed ? "text-xs text-red-600" : "text-xs text-muted-foreground"}>
        {info.events.pending
          ? t("ov.eventsPending", { n: info.events.pending }) + (info.events.failed ? ` — ${info.events.failed}` : "")
          : info.events.lastSentAt
            ? t("ov.eventsSent", { at: info.events.lastSentAt })
            : t("ov.eventsNone")}
      </p>
      {data?.contact && (
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          {t("ov.contact")}: {[data.contact.name, data.contact.phone, data.contact.email, data.contact.telegram && `Telegram ${data.contact.telegram}`].filter(Boolean).join(" · ")}
        </div>
      )}
      {data?.travelers.map((tr) => (
        <div key={tr.id} className="rounded-lg border">
          <div className="border-b bg-muted/40 px-3 py-1.5 font-medium">
            {tr.position}. {tr.name}
          </div>
          <dl className="divide-y px-3">
            {tr.fields.map((fl) => (
              <div key={fl.key} className="grid grid-cols-[minmax(0,12rem)_1fr] gap-2 py-1">
                <dt className="text-muted-foreground">{fl.label}</dt>
                <dd className="min-w-0 font-mono text-[13px] break-words select-all">{fl.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {!data && <p className="text-xs text-muted-foreground">{t("ov.noForm")}</p>}
    </div>
  );
}

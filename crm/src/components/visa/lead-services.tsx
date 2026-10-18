"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FolderOpen, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { addServiceAction, deleteServiceAction, handOverAction, setServiceClosedAction } from "@/app/(app)/visa/actions";
import { DocChecklist } from "./doc-checklist";
import { VisaStatusBadge } from "./visa-status";
import { SERVICE_TYPES, VISA_COUNTRIES } from "@/lib/constants";
import type { ServiceView } from "@/lib/visa-view";
import { serviceLabel, serviceTitle } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

const OTHER = "__other";

function AddService({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [type, setType] = useState("VISA");
  const [country, setCountry] = useState("");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const value = type === "VISA" && country !== OTHER ? country : other;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        <Field label={t("docs.serviceType")}>
          <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s === "VISA" ? t("docs.visa") : serviceLabel(t, s)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {type === "VISA" ? (
          <Field label={t("lead.visaCountry")}>
            <NativeSelect value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">—</option>
              {VISA_COUNTRIES.map((c) => (
                <option key={c.ru} value={c.ru}>
                  {c[locale] ?? c.ru}
                </option>
              ))}
              <option value={OTHER}>{t("lead.visaOther")}</option>
            </NativeSelect>
          </Field>
        ) : (
          <Field label={t("docs.direction")}>
            <Input value={other} onChange={(e) => setOther(e.target.value)} maxLength={100} />
          </Field>
        )}
        {type === "VISA" && country === OTHER ? (
          <Field label={t("lead.visaOtherPh")}>
            <Input value={other} onChange={(e) => setOther(e.target.value)} maxLength={100} autoFocus />
          </Field>
        ) : (
          <Field label={t("docs.note")}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await addServiceAction(leadId, { type, country: value, note });
              if (!r.ok) return void toast.error(r.error);
              toast.success(t("common.saved"));
              onDone();
            })
          }
        >
          {pending ? t("common.saving") : t("docs.addService")}
        </Button>
      </div>
    </div>
  );
}

/** Заявки клиента в карточке лида: виза (с передачей визовому специалисту), билеты, тур — и документы по каждой */
export function LeadServices({ leadId, services, userId, isAdmin }: { leadId: string; services: ServiceView[]; userId: string; isAdmin: boolean }) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      if (ok) toast.success(ok);
    });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="size-4 text-muted-foreground" /> {t("docs.title")}
        </CardTitle>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus /> {t("docs.addService")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && <AddService leadId={leadId} onDone={() => setAdding(false)} />}
        {!services.length && !adding && <p className="text-sm text-muted-foreground">{t("docs.empty")}</p>}
        {services.map((s) => {
          const docs = s.required.reduce((n, r) => n + r.docs.length, 0) + s.extra.length;
          return (
            <div key={s.id} className={cn("space-y-3 rounded-lg border p-3", s.closed && "opacity-70")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{serviceTitle(t, s.type, s.country)}</span>
                {s.type === "VISA" && s.handed && <VisaStatusBadge status={s.status} />}
                {s.closed && !(s.type === "VISA" && s.handed) && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t("docs.closed")}</span>}
                {s.source === "WEBSITE" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t("visa.fromSite")}</span>}
                <div className="ml-auto flex flex-wrap gap-1.5">
                  {s.type === "VISA" && !s.handed && (
                    <Button size="sm" disabled={pending} onClick={() => run(() => handOverAction(s.id), t("docs.handedOk"))}>
                      <Send /> {t("docs.handOver")}
                    </Button>
                  )}
                  {!(s.type === "VISA" && s.handed) && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setServiceClosedAction(s.id, !s.closed))}>
                      {s.closed ? t("docs.reopen") : t("docs.close")}
                    </Button>
                  )}
                  {!docs && (!s.handed || isAdmin) && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={pending}
                      title={t("common.delete")}
                      onClick={() => confirm(t("docs.deleteServiceConfirm", { name: serviceTitle(t, s.type, s.country) })) && run(() => deleteServiceAction(s.id))}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
              {s.type === "VISA" && s.handed && (
                <p className="text-xs text-muted-foreground">{s.assignee ? t("docs.handedTo", { name: s.assignee }) : t("docs.handedWaiting")}</p>
              )}
              {s.type === "VISA" && s.handed && s.lastComment && (
                <div className={cn("rounded-md p-2 text-sm", s.status === "DOCS_REQUESTED" ? "bg-orange-50 text-orange-950 dark:bg-orange-950 dark:text-orange-100" : "bg-muted/50")}>
                  <div className="text-xs opacity-70">{t("docs.specialistSays", { name: s.lastComment.by ?? "—", at: s.lastComment.at })}</div>
                  <p className="whitespace-pre-wrap">{s.lastComment.text}</p>
                </div>
              )}
              {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              <DocChecklist service={s} userId={userId} isAdmin={isAdmin} canUpload={!s.closed} />
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">{t("docs.chatHint")}</p>
      </CardContent>
    </Card>
  );
}

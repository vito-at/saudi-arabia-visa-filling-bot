"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, FileCheck2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { generateSiteKeyAction, revokeSiteKeyAction, saveRequirementsAction } from "@/app/(app)/settings/visa-actions";
import { SERVICE_TYPES, VISA_COUNTRIES } from "@/lib/constants";
import { serviceLabel } from "@/i18n/labels";
import { useI18n } from "@/i18n/client";

export interface RequirementList {
  type: string;
  country: string | null;
  names: string[];
}

const ALL = "";
const OTHER = "__other";

/** Списки документов: общий для типа услуги и отдельные для стран визы */
export function RequirementsEditor({ lists }: { lists: RequirementList[] }) {
  const { t, locale } = useI18n();
  const [type, setType] = useState("VISA");
  const [country, setCountry] = useState(ALL);
  const [other, setOther] = useState("");
  const value = country === OTHER ? other.trim() : country;
  const find = (ty: string, c: string) => lists.find((l) => l.type === ty && (l.country ?? "").toLowerCase() === c.toLowerCase());
  const current = find(type, value);
  const general = find(type, "");
  const [text, setText] = useState(current?.names.join("\n") ?? "");
  const [pending, start] = useTransition();
  const countries = [...new Set([...VISA_COUNTRIES.map((c) => c.ru), ...lists.filter((l) => l.type === "VISA" && l.country).map((l) => l.country!)])];

  function pick(ty: string, c: string) {
    setType(ty);
    setCountry(c);
    const l = find(ty, c === OTHER ? "" : c);
    setText(c === OTHER ? "" : (l?.names.join("\n") ?? ""));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck2 className="size-5 text-muted-foreground" /> {t("docset.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("docset.hint")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <Field label={t("docs.serviceType")}>
            <NativeSelect value={type} onChange={(e) => pick(e.target.value, ALL)}>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s === "VISA" ? t("docs.visa") : serviceLabel(t, s)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {type === "VISA" && (
            <Field label={t("lead.visaCountry")}>
              <NativeSelect value={country} onChange={(e) => pick(type, e.target.value)}>
                <option value={ALL}>{t("docset.allCountries")}</option>
                {countries.map((c) => {
                  const known = VISA_COUNTRIES.find((v) => v.ru === c);
                  return (
                    <option key={c} value={c}>
                      {(known ? (known[locale] ?? known.ru) : c) + (find("VISA", c) ? " ✓" : "")}
                    </option>
                  );
                })}
                <option value={OTHER}>{t("lead.visaOther")}</option>
              </NativeSelect>
            </Field>
          )}
        </div>
        {country === OTHER && <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder={t("lead.visaOtherPh")} maxLength={100} />}
        <Field label={t("docset.list")}>
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={value && general ? general.names.join("\n") : t("docset.listPh")} />
        </Field>
        <p className="text-xs text-muted-foreground">{value ? (current ? t("docset.ownList") : t("docset.usesGeneral")) : t("docset.generalHint")}</p>
        <div className="flex justify-end">
          <Button
            disabled={pending || (country === OTHER && !other.trim())}
            onClick={() =>
              start(async () => {
                const r = await saveRequirementsAction({ type, country: value, names: text });
                if (!r.ok) return void toast.error(r.error);
                toast.success(t("common.saved"));
              })
            }
          >
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Ключ API для заявок с сайта: создаётся здесь, показывается один раз */
export function SiteKeyCard({ hasKey, url }: { hasKey: boolean; url: string }) {
  const { t } = useI18n();
  const [key, setKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-muted-foreground" /> {t("docset.siteTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{t("docset.siteHint")}</p>
        <div className="rounded-md bg-muted/50 p-3 font-mono text-xs break-all">
          POST {url}
          <br />
          Authorization: Bearer &lt;{t("docset.key")}&gt;
          <br />
          {`{"name": "…", "phone": "+998…", "country": "Таиланд", "email": "…", "travelers": 2, "travelFrom": "2026-12-01", "travelTo": "2026-12-10", "comment": "…"}`}
        </div>
        {key && (
          <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <div className="text-xs text-amber-900 dark:text-amber-200">{t("docset.keyOnce")}</div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all">{key}</code>
              <Button size="icon-sm" variant="ghost" title={t("posts.copy")} onClick={() => void navigator.clipboard?.writeText(key).then(() => toast.success(t("integ.copied")))}>
                <Copy />
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className={hasKey ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>{hasKey ? t("docset.keyOn") : t("docset.keyOff")}</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => {
                if (hasKey && !confirm(t("docset.regenConfirm"))) return;
                start(async () => {
                  const r = await generateSiteKeyAction();
                  if (!r.ok || !r.data) return void toast.error(r.ok ? t("common.errorGeneric") : r.error);
                  setKey(r.data);
                });
              }}
            >
              {hasKey ? t("docset.regen") : t("docset.create")}
            </Button>
            {hasKey && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  confirm(t("docset.revokeConfirm")) &&
                  start(async () => {
                    const r = await revokeSiteKeyAction();
                    if (!r.ok) return void toast.error(r.error);
                    setKey(null);
                  })
                }
              >
                {t("docset.revoke")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

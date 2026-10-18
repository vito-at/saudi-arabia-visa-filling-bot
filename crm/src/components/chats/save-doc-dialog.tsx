"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { docOptionsAction, saveChatDocumentAction, type DocOption } from "@/app/(app)/visa/actions";
import { serviceTitle } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

const OTHER = "__other";

/**
 * «Сохранить в CRM»: вложение из переписки становится документом заявки клиента.
 * Если открытых заявок несколько — сначала выбирается заявка, затем тип документа из списка для неё.
 */
export function SaveDocDialog({ conversationId, messageId, index, fileName, onClose }: { conversationId: string; messageId: string; index: number; fileName: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<{ leadId: string; leadName: string; options: DocOption[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [docType, setDocType] = useState("");
  const [other, setOther] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    void docOptionsAction(conversationId).then((r) => {
      if (!r.ok || !r.data) return setError(r.ok ? t("common.errorGeneric") : r.error);
      setData(r.data);
      if (r.data.options.length === 1) setServiceId(r.data.options[0].id);
    });
  }, [conversationId, t]);

  const service = data?.options.find((o) => o.id === serviceId);
  const name = docType === OTHER ? other.trim() : docType;

  function save() {
    if (!service || !name) return;
    start(async () => {
      const r = await saveChatDocumentAction({ messageId, index, serviceId: service.id, docType: name });
      if (!r.ok) return void toast.error(r.error);
      toast.success(t("docs.saved", { doc: name, service: serviceTitle(t, service.type, service.country) }));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("docs.saveTitle")} description={fileName ?? undefined}>
        {!data && !error && (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {data && !data.options.length && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("docs.noServices")}</p>
            <Link href={`/leads/${data.leadId}`} className="text-primary underline">
              {t("docs.openLead")}
            </Link>
          </div>
        )}
        {data && data.options.length > 0 && (
          <div className="space-y-4">
            {data.options.length > 1 && (
              <div className="space-y-1.5">
                <div className="text-sm font-medium">{t("docs.whichService", { name: data.leadName })}</div>
                <div className="grid gap-1.5">
                  {data.options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setServiceId(o.id);
                        setDocType("");
                      }}
                      className={cn("rounded-md border px-3 py-2 text-left text-sm", serviceId === o.id ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent")}
                    >
                      {serviceTitle(t, o.type, o.country)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {service && (
              <div className="space-y-1.5">
                <div className="text-sm font-medium">{t("docs.whichDoc", { service: serviceTitle(t, service.type, service.country) })}</div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {service.docTypes.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDocType(d.name)}
                      className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm", docType === d.name ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent")}
                    >
                      <span className="flex-1">{d.name}</span>
                      {d.saved > 0 && <Check className="size-4 shrink-0 text-emerald-600" aria-label={t("docs.alreadySaved")} />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDocType(OTHER)}
                    className={cn("rounded-md border border-dashed px-3 py-2 text-left text-sm", docType === OTHER ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent")}
                  >
                    {t("docs.other")}
                  </button>
                </div>
                {docType === OTHER && <Input autoFocus value={other} onChange={(e) => setOther(e.target.value)} maxLength={120} placeholder={t("docs.otherPh")} />}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button disabled={pending || !service || !name} onClick={save}>
                {pending ? t("common.saving") : t("docs.save")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

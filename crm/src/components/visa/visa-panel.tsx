"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Hand, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { sendClientMessageAction, setVisaStatusAction, takeVisaAction, visaCommentAction } from "@/app/(app)/visa/actions";
import { VISA_STATUS_STYLE } from "./visa-status";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/core";

const STATUSES = ["NEW", "IN_PROGRESS", "PAID_WAITING", "DOCS_REQUESTED", "APPROVED", "REJECTED"] as const;

export interface PanelSite {
  /** документы с сайта: можно отметить, какие клиенту переделать */
  siteDocs: { externalId: string; title: string; traveler: string | null }[];
  /** документы заявки — из них выбирается файл визы / отказа */
  files: { id: string; name: string; docType: string }[];
  portalReference: string | null;
}

/**
 * Этап визы: визовый специалист выбирает этап и пишет комментарий (для запроса документов — обязательно).
 * Для заявки с сайта Orient Visa этап уходит на сайт: комментарий увидит клиент, к одобрению / отказу прикладывается файл.
 */
export function VisaPanel({ serviceId, status, assignee, isMine, site }: { serviceId: string; status: string; assignee: string | null; isMine: boolean; site?: PanelSite | null }) {
  const { t } = useI18n();
  const [next, setNext] = useState(status);
  const [comment, setComment] = useState("");
  const [toClient, setToClient] = useState(true);
  const [rejected, setRejected] = useState<string[]>([]);
  const [portal, setPortal] = useState(site?.portalReference ?? "");
  const [fileId, setFileId] = useState("");
  const [proof, setProof] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const changed = next !== status;
  const final = next === "APPROVED" || next === "REJECTED";
  const portalChanged = !!site && portal.trim() !== (site.portalReference ?? "");

  function save() {
    start(async () => {
      const r =
        changed || portalChanged || (site && toClient && comment.trim())
          ? await setVisaStatusAction(serviceId, { status: next, comment, toClient, rejectedDocuments: rejected, portalReference: portal, fileDocumentId: fileId, proofType: proof })
          : await visaCommentAction(serviceId, comment);
      if (!r.ok) return void toast.error(r.error);
      toast.success(site && (changed || toClient) ? t("ov.sentToSite") : t("common.saved"));
      setComment("");
      setRejected([]);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{assignee ? t("visa.assignedTo", { name: assignee }) : t("visa.unassigned")}</span>
        {!isMine && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await takeVisaAction(serviceId);
                if (!r.ok) toast.error(r.error);
              })
            }
          >
            <Hand /> {t("visa.take")}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setNext(s)}
            className={cn(
              "rounded-md border px-2.5 py-2 text-left text-xs font-medium",
              next === s ? cn(VISA_STATUS_STYLE[s], "border-transparent ring-2 ring-primary/50") : "hover:bg-accent",
              s === status && next !== s && "border-dashed",
            )}
          >
            {t(`visa.status.${s}` as TKey)}
            {s === status && <span className="block text-[10px] font-normal opacity-70">{t("visa.current")}</span>}
          </button>
        ))}
      </div>

      {site && next === "DOCS_REQUESTED" && site.siteDocs.length > 0 && (
        <div className="space-y-1 rounded-md border p-2">
          <div className="text-xs font-medium">{t("ov.rejectedDocs")}</div>
          {site.siteDocs.map((d) => (
            <label key={d.externalId} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rejected.includes(d.externalId)} onChange={(e) => setRejected(e.target.checked ? [...rejected, d.externalId] : rejected.filter((x) => x !== d.externalId))} />
              {d.title}
              {d.traveler && <span className="text-xs text-muted-foreground">— {d.traveler}</span>}
            </label>
          ))}
        </div>
      )}
      {site && final && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 [&>*]:min-w-0">
          <Field label={next === "APPROVED" ? t("ov.visaFile") : t("ov.refusalFile")}>
            <NativeSelect value={fileId} onChange={(e) => setFileId(e.target.value)}>
              <option value="">{t("ov.pickFile")}</option>
              {site.files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.docType} · {f.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {next === "REJECTED" && (
            <Field label={t("ov.proofType")}>
              <NativeSelect value={proof} onChange={(e) => setProof(e.target.value)}>
                <option value="">—</option>
                <option value="OFFICIAL">{t("ov.proof.OFFICIAL")}</option>
                <option value="EMAIL">{t("ov.proof.EMAIL")}</option>
                <option value="SCREENSHOT">{t("ov.proof.SCREENSHOT")}</option>
              </NativeSelect>
            </Field>
          )}
          <p className="text-xs text-muted-foreground sm:col-span-2">{t("ov.fileHint")}</p>
        </div>
      )}
      {site && (
        <Field label={t("ov.portalReference")}>
          <Input value={portal} onChange={(e) => setPortal(e.target.value)} maxLength={100} placeholder="T123456789" />
        </Field>
      )}

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={next === "DOCS_REQUESTED" ? t("visa.docsCommentPh") : t("visa.commentPh")}
      />
      {site && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={toClient} onChange={(e) => setToClient(e.target.checked)} /> {t("ov.toClient")}
        </label>
      )}
      <div className="flex justify-end">
        <Button disabled={pending || (!changed && !comment.trim() && !portalChanged)} onClick={save}>
          {pending ? t("common.saving") : changed ? t("visa.saveStatus") : t("visa.addComment")}
        </Button>
      </div>

      {site && (
        <div className="space-y-2 border-t pt-3">
          <div className="text-sm font-medium">{t("ov.messageTitle")}</div>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={2000} placeholder={t("ov.messagePh")} />
          <div className="flex justify-end">
            <Button
              variant="outline"
              disabled={pending || !message.trim()}
              onClick={() =>
                start(async () => {
                  const r = await sendClientMessageAction(serviceId, message);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(t("ov.messageSent"));
                  setMessage("");
                })
              }
            >
              <Send /> {t("ov.send")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, Download, MessageCircle, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, Input } from "@/components/ui/input";
import { deleteDocumentAction } from "@/app/(app)/visa/actions";
import type { DocView, ServiceView } from "@/lib/visa-view";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

const OTHER = "__other";

export const fileSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function DocLink({ d, canDelete }: { d: DocView; canDelete: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <a href={`/api/docs/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 truncate text-primary hover:underline" title={`${d.fileName} · ${d.at}${d.by ? ` · ${d.by}` : ""}`}>
        {d.fileName}
      </a>
      {d.fromChat && <MessageCircle className="size-3 shrink-0 text-muted-foreground" aria-label={t("docs.fromChat")} />}
      <span className="shrink-0 text-muted-foreground">{fileSize(d.size)}</span>
      <a href={`/api/docs/${d.id}?download=1`} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent" title={t("docs.download")} aria-label={t("docs.download")}>
        <Download className="size-3.5" />
      </a>
      {canDelete && (
        <button
          type="button"
          disabled={pending}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-red-600"
          title={t("common.delete")}
          aria-label={t("common.delete")}
          onClick={() => {
            if (!confirm(t("docs.deleteConfirm", { name: d.fileName }))) return;
            start(async () => {
              const r = await deleteDocumentAction(d.id);
              if (!r.ok) toast.error(r.error);
            });
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Чек-лист документов заявки: что нужно, что уже есть (из чата или загружено), загрузка с компьютера */
export function DocChecklist({ service, userId, isAdmin, canUpload = true }: { service: ServiceView; userId?: string; isAdmin: boolean; canUpload?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [docType, setDocType] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const done = service.required.filter((r) => r.docs.length).length;
  // удалить может администратор; остальные — только то, что загрузили сами
  const canDelete = (d: DocView) => isAdmin || (!!userId && d.byId === userId);

  async function upload(f: File) {
    const name = docType === OTHER ? other.trim() : docType;
    if (!name) return void toast.error(t("err.docType"));
    setBusy(true);
    const form = new FormData();
    form.append("serviceId", service.id);
    form.append("docType", name);
    form.append("file", f);
    const r = await fetch("/api/docs/upload", { method: "POST", body: form }).catch(() => null);
    const res = (await r?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(false);
    if (!res?.ok) return void toast.error(res?.error ?? t("common.errorGeneric"));
    toast.success(t("docs.uploaded", { doc: name }));
    setDocType("");
    setOther("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {service.required.length > 0 && (
        <div className="text-xs text-muted-foreground">{t("docs.progress", { done, total: service.required.length })}</div>
      )}
      <ul className="space-y-1.5">
        {service.required.map((r) => (
          <li key={r.name} className="flex items-start gap-2 text-sm">
            {r.docs.length ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />}
            <div className="min-w-0 flex-1">
              <div className={cn(!r.docs.length && "text-muted-foreground")}>{r.name}</div>
              {r.docs.map((d) => (
                <DocLink key={d.id} d={d} canDelete={canDelete(d)} />
              ))}
            </div>
          </li>
        ))}
        {service.extra.map((d) => (
          <li key={d.id} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sky-600" />
            <div className="min-w-0 flex-1">
              <div>
                {d.docType}
                {d.traveler && <span className="text-xs text-muted-foreground"> — {d.traveler}</span>}
                {d.fromSite && <span className="ml-1.5 rounded bg-muted px-1 text-[10px] text-muted-foreground">{t("ov.fromSite")}</span>}
              </div>
              <DocLink d={d} canDelete={canDelete(d)} />
            </div>
          </li>
        ))}
      </ul>
      {canUpload && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <NativeSelect value={docType} onChange={(e) => setDocType(e.target.value)} className="h-8 w-auto min-w-44 flex-1 text-xs sm:flex-none">
            <option value="">{t("docs.uploadPick")}</option>
            {service.required.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
            <option value={OTHER}>{t("docs.other")}</option>
          </NativeSelect>
          {docType === OTHER && <Input value={other} onChange={(e) => setOther(e.target.value)} maxLength={120} placeholder={t("docs.otherPh")} className="h-8 w-44 text-xs" />}
          <input ref={file} type="file" className="hidden" accept="image/*,application/pdf,.doc,.docx,.heic" onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }} />
          <Button size="sm" variant="outline" disabled={busy || !docType || (docType === OTHER && !other.trim())} onClick={() => file.current?.click()}>
            <Upload /> {busy ? t("tpl.sending") : t("docs.upload")}
          </Button>
        </div>
      )}
    </div>
  );
}

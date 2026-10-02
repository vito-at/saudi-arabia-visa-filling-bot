"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { MANUAL_SOURCES, SERVICE_TYPES } from "@/lib/constants";
import { serviceLabel, sourceLabel } from "@/i18n/labels";
import { useI18n } from "@/i18n/client";
import { createLeadAction } from "@/app/(app)/leads/actions";

export function NewLeadDialog({ managers, isAdmin, roundRobin }: { managers: { id: string; name: string }[]; isAdmin: boolean; roundRobin: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    start(async () => {
      const res = await createLeadAction(formData);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data?.isRepeat ? t("newLead.createdRepeat") : t("newLead.created"));
      setOpen(false);
      router.push(`/leads/${res.data!.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> {t("newLead.button")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("newLead.title")} description={t("newLead.description")} className="max-w-2xl">
        <form action={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("newLead.name")}>
            <Input name="name" required />
          </Field>
          <Field label={t("newLead.phone")} hint={t("newLead.phoneHint")}>
            <Input name="phone" required placeholder="+998 90 123 45 67" />
          </Field>
          <Field label={t("newLead.source")}>
            <NativeSelect name="source" required defaultValue="CALL">
              {MANUAL_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel(t, s)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("lead.field.email")}>
            <Input name="email" type="email" />
          </Field>
          <Field label={t("lead.field.service")}>
            <NativeSelect name="serviceType" defaultValue="">
              <option value="">—</option>
              {SERVICE_TYPES.map((k) => (
                <option key={k} value={k}>
                  {serviceLabel(t, k)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("lead.field.destination")}>
            <Input name="destination" placeholder={t("newLead.destinationPh")} />
          </Field>
          <Field label={t("lead.field.travelFrom")}>
            <Input name="travelFrom" type="date" />
          </Field>
          <Field label={t("lead.field.travelTo")}>
            <Input name="travelTo" type="date" />
          </Field>
          <Field label={t("newLead.travelers")}>
            <Input name="travelers" type="number" min={1} />
          </Field>
          <Field label={t("newLead.owner")}>
            <NativeSelect name="managerId" defaultValue={isAdmin ? (roundRobin ? "auto" : "none") : "me"}>
              {isAdmin ? (
                <>
                  {roundRobin && <option value="auto">{t("newLead.auto")}</option>}
                  <option value="none">{t("newLead.dontAssign")}</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </>
              ) : (
                <>
                  <option value="me">{t("common.me")}</option>
                  <option value="none">{t("newLead.dontAssignShort")}</option>
                </>
              )}
            </NativeSelect>
          </Field>
          <Field label={t("newLead.comment")} className="sm:col-span-2">
            <Textarea name="comment" rows={3} placeholder={t("newLead.commentPh")} />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("newLead.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

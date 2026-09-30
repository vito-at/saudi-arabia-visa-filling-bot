"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { SERVICE_TYPES } from "@/lib/constants";
import { serviceLabel } from "@/i18n/labels";
import { useI18n } from "@/i18n/client";
import { formatDate } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { updateLeadAction } from "@/app/(app)/leads/actions";

export interface LeadDetails {
  id: string;
  name: string;
  phone: string | null;
  phoneRaw: string | null;
  email: string | null;
  serviceType: string | null;
  destination: string | null;
  travelFrom: string; // YYYY-MM-DD
  travelTo: string;
  travelers: number | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{children || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

export function LeadDetailsForm({ lead }: { lead: LeadDetails }) {
  const { t } = useI18n();
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();

  if (!edit) {
    return (
      <div>
        <div className="mb-1 flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => setEdit(true)}>
            <Pencil /> {t("common.edit")}
          </Button>
        </div>
        <Row label={t("lead.field.name")}>{lead.name}</Row>
        <Row label={t("lead.field.phone")}>{lead.phone ? prettyPhone(lead.phone) : lead.phoneRaw}</Row>
        <Row label={t("lead.field.email")}>{lead.email}</Row>
        <Row label={t("lead.field.service")}>{lead.serviceType ? serviceLabel(t, lead.serviceType) : null}</Row>
        <Row label={t("lead.field.destination")}>{lead.destination}</Row>
        <Row label={t("lead.field.dates")}>
          {lead.travelFrom || lead.travelTo ? `${lead.travelFrom ? formatDate(`${lead.travelFrom}T00:00:00+05:00`) : "…"} — ${lead.travelTo ? formatDate(`${lead.travelTo}T00:00:00+05:00`) : "…"}` : null}
        </Row>
        <Row label={t("lead.field.travelers")}>{lead.travelers}</Row>
      </div>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await updateLeadAction(lead.id, fd);
          if (!res.ok) return void toast.error(res.error);
          toast.success(t("common.saved"));
          setEdit(false);
        })
      }
      className="grid grid-cols-2 gap-3"
    >
      <Field label={t("lead.field.name")}>
        <Input name="name" defaultValue={lead.name} required />
      </Field>
      <Field label={t("lead.field.phone")}>
        <Input name="phone" defaultValue={lead.phone ?? lead.phoneRaw ?? ""} />
      </Field>
      <Field label={t("lead.field.email")}>
        <Input name="email" type="email" defaultValue={lead.email ?? ""} />
      </Field>
      <Field label={t("lead.field.service")}>
        <NativeSelect name="serviceType" defaultValue={lead.serviceType ?? ""}>
          <option value="">—</option>
          {SERVICE_TYPES.map((k) => (
            <option key={k} value={k}>
              {serviceLabel(t, k)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("lead.field.destination")}>
        <Input name="destination" defaultValue={lead.destination ?? ""} />
      </Field>
      <Field label={t("lead.field.travelers")}>
        <Input name="travelers" type="number" min={1} defaultValue={lead.travelers ?? ""} />
      </Field>
      <Field label={t("lead.field.travelFrom")}>
        <Input name="travelFrom" type="date" defaultValue={lead.travelFrom} />
      </Field>
      <Field label={t("lead.field.travelTo")}>
        <Input name="travelTo" type="date" defaultValue={lead.travelTo} />
      </Field>
      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setEdit(false)}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

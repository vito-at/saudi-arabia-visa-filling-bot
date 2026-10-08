"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ServiceDestinationFields } from "./service-destination-fields";
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
  serviceType: string | null;
  destination: string | null;
  travelFrom: string; // YYYY-MM-DD
  travelTo: string;
  travelers: number | null;
  visaApplications: number | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-1.5 text-sm sm:grid-cols-[160px_1fr] sm:gap-3">
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
        <Row label={t("lead.field.service")}>{lead.serviceType ? serviceLabel(t, lead.serviceType) : null}</Row>
        <Row label={lead.serviceType === "VISA" ? t("lead.visaCountry") : t("lead.field.destination")}>{lead.destination}</Row>
        {lead.serviceType === "VISA" && <Row label={t("lead.field.visaApplications")}>{lead.visaApplications}</Row>}
        {lead.serviceType !== "VISA" && <Row label={t("lead.field.travelers")}>{lead.travelers}</Row>}
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
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <Field label={t("lead.field.name")}>
        <Input name="name" defaultValue={lead.name} required />
      </Field>
      <Field label={t("lead.field.phone")}>
        <Input name="phone" defaultValue={lead.phone ?? lead.phoneRaw ?? ""} />
      </Field>
      <ServiceDestinationFields service={lead.serviceType} destination={lead.destination} applications={lead.visaApplications} travelers={lead.travelers} />
      <div className="sm:col-span-2 flex justify-end gap-2">
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

"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { SERVICE_LABELS } from "@/lib/constants";
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
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();

  if (!edit) {
    return (
      <div>
        <div className="mb-1 flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => setEdit(true)}>
            <Pencil /> Редактировать
          </Button>
        </div>
        <Row label="Имя">{lead.name}</Row>
        <Row label="Телефон">{lead.phone ? prettyPhone(lead.phone) : lead.phoneRaw}</Row>
        <Row label="Email">{lead.email}</Row>
        <Row label="Тип услуги">{lead.serviceType ? SERVICE_LABELS[lead.serviceType as keyof typeof SERVICE_LABELS] : null}</Row>
        <Row label="Направление">{lead.destination}</Row>
        <Row label="Даты поездки">
          {lead.travelFrom || lead.travelTo ? `${lead.travelFrom ? formatDate(`${lead.travelFrom}T00:00:00+05:00`) : "…"} — ${lead.travelTo ? formatDate(`${lead.travelTo}T00:00:00+05:00`) : "…"}` : null}
        </Row>
        <Row label="Туристов">{lead.travelers}</Row>
      </div>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await updateLeadAction(lead.id, fd);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Сохранено");
          setEdit(false);
        })
      }
      className="grid grid-cols-2 gap-3"
    >
      <Field label="Имя">
        <Input name="name" defaultValue={lead.name} required />
      </Field>
      <Field label="Телефон">
        <Input name="phone" defaultValue={lead.phone ?? lead.phoneRaw ?? ""} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={lead.email ?? ""} />
      </Field>
      <Field label="Тип услуги">
        <NativeSelect name="serviceType" defaultValue={lead.serviceType ?? ""}>
          <option value="">—</option>
          {Object.entries(SERVICE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Направление">
        <Input name="destination" defaultValue={lead.destination ?? ""} />
      </Field>
      <Field label="Туристов">
        <Input name="travelers" type="number" min={1} defaultValue={lead.travelers ?? ""} />
      </Field>
      <Field label="Дата поездки с">
        <Input name="travelFrom" type="date" defaultValue={lead.travelFrom} />
      </Field>
      <Field label="по">
        <Input name="travelTo" type="date" defaultValue={lead.travelTo} />
      </Field>
      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setEdit(false)}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}

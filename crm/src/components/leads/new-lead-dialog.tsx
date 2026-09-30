"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { MANUAL_SOURCES, SERVICE_LABELS, SOURCE_LABELS } from "@/lib/constants";
import { createLeadAction } from "@/app/(app)/leads/actions";

export function NewLeadDialog({ managers, isAdmin, roundRobin }: { managers: { id: string; name: string }[]; isAdmin: boolean; roundRobin: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    start(async () => {
      const res = await createLeadAction(formData);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data?.isRepeat ? "Лид создан — это повторное обращение клиента" : "Лид создан");
      setOpen(false);
      router.push(`/leads/${res.data!.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Новый лид
        </Button>
      </DialogTrigger>
      <DialogContent title="Новый лид" description="Для звонков, обращений из Instagram Direct, Telegram и визитов в офис" className="max-w-2xl">
        <form action={submit} className="grid grid-cols-2 gap-4">
          <Field label="Имя *">
            <Input name="name" required />
          </Field>
          <Field label="Телефон *" hint="Любой формат, приведём к +998XXXXXXXXX">
            <Input name="phone" required placeholder="+998 90 123 45 67" />
          </Field>
          <Field label="Источник *">
            <NativeSelect name="source" required defaultValue="CALL">
              {MANUAL_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Email">
            <Input name="email" type="email" />
          </Field>
          <Field label="Тип услуги">
            <NativeSelect name="serviceType" defaultValue="">
              <option value="">—</option>
              {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Направление">
            <Input name="destination" placeholder="Например, Дубай" />
          </Field>
          <Field label="Дата поездки с">
            <Input name="travelFrom" type="date" />
          </Field>
          <Field label="по">
            <Input name="travelTo" type="date" />
          </Field>
          <Field label="Количество туристов">
            <Input name="travelers" type="number" min={1} />
          </Field>
          <Field label="Ответственный">
            <NativeSelect name="managerId" defaultValue={isAdmin ? (roundRobin ? "auto" : "none") : "me"}>
              {isAdmin ? (
                <>
                  {roundRobin && <option value="auto">Автоматически (по очереди)</option>}
                  <option value="none">— Не назначать —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </>
              ) : (
                <>
                  <option value="me">Я</option>
                  <option value="none">Не назначать</option>
                </>
              )}
            </NativeSelect>
          </Field>
          <Field label="Комментарий" className="col-span-2">
            <Textarea name="comment" rows={3} placeholder="Что хочет клиент" />
          </Field>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Сохранение…" : "Создать лид"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

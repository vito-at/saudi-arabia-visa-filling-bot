"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, HandCoins, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { addPaymentAction, deletePaymentAction, setDebtTermsAction } from "@/app/(app)/deals/actions";
import { formatDate, toInputDate } from "@/lib/format";
import { useI18n } from "@/i18n/client";

export interface DebtView {
  dealId: string;
  name: string;
  currency: "USD" | "UZS";
  left: number;
  dueAt: string | null;
  note: string | null;
}

/** Кнопки «Внести оплату» и «Срок и заметка» для одной сделки с долгом */
export function DebtActions({ debt, size = "sm" }: { debt: DebtView; size?: "sm" | "default" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<"pay" | "terms" | null>(null);
  return (
    <>
      <Button size={size} onClick={() => setOpen("pay")}>
        <HandCoins /> {t("debtors.addPayment")}
      </Button>
      <Button size={size} variant="outline" onClick={() => setOpen("terms")}>
        <CalendarClock /> {t("debtors.terms")}
      </Button>
      {open === "pay" && <PaymentDialog debt={debt} onClose={() => setOpen(null)} />}
      {open === "terms" && <TermsDialog debt={debt} onClose={() => setOpen(null)} />}
    </>
  );
}

function PaymentDialog({ debt, onClose }: { debt: DebtView; onClose: () => void }) {
  const { t, f } = useI18n();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(toInputDate(new Date()));
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await addPaymentAction(debt.dealId, { amount, paidAt, note });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data && res.data.left <= 0 ? t("debtors.paidOff") : t("debtors.paymentSaved"));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={t("debtors.paymentTitle")} description={t("debtors.paymentDesc", { name: debt.name, left: f.money(debt.left, debt.currency) })}>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <Field label={`${t("debtors.amount")}, ${debt.currency === "USD" ? "$" : f.sum}`}>
            <div className="flex gap-2">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required autoFocus className="min-w-0" />
              <Button type="button" variant="outline" onClick={() => setAmount(String(debt.left))}>
                {t("debtors.payAll")}
              </Button>
            </div>
          </Field>
          <Field label={t("debtors.date")}>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
          </Field>
          <Field label={t("debtors.note")} className="sm:col-span-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("debtors.notePh")} maxLength={500} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TermsDialog({ debt, onClose }: { debt: DebtView; onClose: () => void }) {
  const { t } = useI18n();
  const [dueAt, setDueAt] = useState(debt.dueAt ? toInputDate(debt.dueAt) : "");
  const [note, setNote] = useState(debt.note ?? "");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await setDebtTermsAction(debt.dealId, { dueAt, note });
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("debtors.termsSaved"));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={t("debtors.termsTitle")} description={debt.name}>
        <form onSubmit={submit} className="grid gap-4">
          <Field label={t("debtors.dueAt")}>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </Field>
          <Field label={t("debtors.agreement")}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("debtors.agreementPh")} rows={3} maxLength={1000} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Список оплат сделки; администратор может удалить ошибочную */
export function PaymentList({ payments, currency, canDelete }: { payments: { id: string; amount: number; paidAt: string; note: string | null; user: string | null }[]; currency: "USD" | "UZS"; canDelete: boolean }) {
  const { t, f } = useI18n();
  const [pending, start] = useTransition();
  if (!payments.length) return null;
  return (
    <ul className="space-y-1 text-xs">
      {payments.map((p) => (
        <li key={p.id} className="group flex items-start gap-2">
          <span className="tabular-nums text-muted-foreground">{formatDate(p.paidAt)}</span>
          <span className="font-medium tabular-nums">{f.money(p.amount, currency)}</span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{[p.note, p.user].filter(Boolean).join(" · ")}</span>
          {canDelete && (
            <button
              type="button"
              title={t("common.delete")}
              disabled={pending}
              className="cursor-pointer text-muted-foreground hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
              onClick={() => {
                if (!confirm(t("debtors.deletePayment"))) return;
                start(async () => {
                  const res = await deletePaymentAction(p.id);
                  if (!res.ok) toast.error(res.error);
                });
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

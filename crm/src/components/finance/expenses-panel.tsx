"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { MoneyPie } from "@/components/reports/charts";
import { formatDate, toInputDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { deleteExpenseAction, saveExpenseAction, type ExpenseInput } from "@/app/(app)/finance/actions";
import type { ExpenseRow } from "@/lib/finance";

const empty = (): ExpenseInput => ({
  date: toInputDate(new Date()),
  category: "",
  amount: "",
  currency: "UZS",
  note: "",
});

/** Расходы компании: форма добавления/правки, список за период и итоги по статьям */
export function ExpensesPanel({
  rows,
  byCategory,
  adSpend,
  categories,
  currency,
}: {
  rows: ExpenseRow[];
  byCategory: { category: string; total: number }[];
  /** расход на рекламу Meta — отдельная доля в структуре расходов */
  adSpend: number | null;
  categories: string[];
  currency: "UZS" | "USD";
}) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<ExpenseInput>(empty);
  const [pending, start] = useTransition();
  const presets = [
    t("finance.catVisa"),
    t("finance.catTaxi"),
    t("finance.catFood"),
    t("finance.catUtilities"),
    t("finance.catRent"),
    t("finance.catSalary"),
    t("finance.catTax"),
    t("finance.catAds"),
    t("finance.catCharity"),
    t("finance.catOther"),
  ];
  // статьи из готового списка + уже встречавшиеся, чтобы старые записи можно было открыть и сохранить без изменений
  const options = [...new Set([...presets, ...categories, ...(form.category ? [form.category] : [])])];
  const set = (patch: Partial<ExpenseInput>) => setForm({ ...form, ...patch });

  function save() {
    start(async () => {
      const res = await saveExpenseAction(form);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("finance.saved"));
      setForm(empty());
      router.refresh();
    });
  }
  function remove(r: ExpenseRow) {
    if (!confirm(t("finance.deleteConfirm", { name: r.category }))) return;
    start(async () => {
      const res = await deleteExpenseAction(r.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("finance.deleted"));
      if (form.id === r.id) setForm(empty());
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <form
          className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[150px_minmax(0,1fr)_140px_100px]"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="col-span-2 flex items-center justify-between sm:col-span-4">
            <div className="text-sm font-semibold">{form.id ? t("finance.expenseEdit") : t("finance.expenseAdd")}</div>
            {form.id && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setForm(empty())}>
                <X /> {t("common.cancel")}
              </Button>
            )}
          </div>
          <Field label={t("finance.date")}>
            <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required />
          </Field>
          <Field label={t("finance.category")} className="col-span-2 sm:col-span-1">
              <NativeSelect name="category" value={form.category} onChange={(e) => set({ category: e.target.value })} required>
                <option value="" disabled>
                  {t("finance.categoryChoose")}
                </option>
                {options.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          <Field label={t("finance.amount")}>
            <Input inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0" required />
          </Field>
          <Field label={t("finance.currency")}>
            <NativeSelect value={form.currency} onChange={(e) => set({ currency: e.target.value as "UZS" | "USD" })}>
              <option value="UZS">UZS</option>
              <option value="USD">USD</option>
            </NativeSelect>
          </Field>
          <Field label={t("finance.note")} className="col-span-2 sm:col-span-3">
            <Input value={form.note} placeholder={t("finance.notePh")} onChange={(e) => set({ note: e.target.value })} />
          </Field>
          <div className="col-span-2 flex items-end sm:col-span-1">
            <Button type="submit" className="w-full" disabled={pending}>
              {form.id ? (
                t("common.save")
              ) : (
                <>
                  <Plus /> {t("common.add")}
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="rounded-xl border bg-card">
          {rows.length === 0 ? (
            <Empty>{t("finance.expensesEmpty")}</Empty>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id} className={"flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm" + (form.id === r.id ? " bg-accent" : "")}>
                  <div className="w-24 shrink-0 text-muted-foreground">{formatDate(`${r.date}T12:00:00Z`)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.category}</div>
                    {(r.note || r.createdBy) && (
                      <div className="truncate text-xs text-muted-foreground">{[r.note, r.createdBy && t("finance.addedBy", { name: r.createdBy })].filter(Boolean).join(" · ")}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">{f.money(r.amount, r.currency)}</div>
                    {r.currency !== currency && <div className="text-xs text-muted-foreground tabular-nums">≈ {f.money(r.converted, currency)}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title={t("common.edit")}
                      onClick={() => {
                        setForm({
                          id: r.id,
                          date: r.date,
                          category: r.category,
                          amount: String(r.amount),
                          currency: r.currency,
                          note: r.note ?? "",
                        });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button size="icon-sm" variant="ghost" title={t("common.delete")} disabled={pending} onClick={() => remove(r)}>
                      <Trash2 className="text-red-600" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="h-fit rounded-xl border bg-card p-4">
        <div className="mb-3 text-sm font-semibold">{t("finance.structure")}</div>
        <MoneyPie
          currency={currency}
          data={[...(adSpend ? [{ name: t("finance.adSpend"), value: adSpend }] : []), ...byCategory.map((c) => ({ name: c.category, value: c.total }))]}
        />
      </div>
    </div>
  );
}

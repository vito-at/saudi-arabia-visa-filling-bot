"use server";

import { revalidatePath } from "next/cache";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";

export interface ExpenseInput {
  id?: string;
  date: string; // YYYY-MM-DD
  category: string;
  amount: string;
  currency: Currency;
  note: string;
  /** «Взял себе из кассы» — не расход компании */
  ownerDraw?: boolean;
}

function parseExpense(input: ExpenseInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ValidationError("err.expenseDate");
  const category = input.category.trim();
  if (!category) throw new ValidationError("err.expenseCategory");
  const amount = Number(String(input.amount).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError("err.expenseAmount");
  if (input.currency !== "UZS" && input.currency !== "USD") throw new ValidationError("err.currency");
  // колонка типа DATE: сохраняем календарный день как есть, без сдвига часового пояса
  return {
    date: new Date(`${input.date}T00:00:00Z`),
    category: category.slice(0, 80),
    amount,
    currency: input.currency,
    note: input.note.trim().slice(0, 500) || null,
    ownerDraw: !!input.ownerDraw,
  };
}

/** Добавить или изменить расход компании (только администратор) */
export async function saveExpenseAction(input: ExpenseInput) {
  return runAction(async () => {
    const user = await requireAdmin();
    const data = parseExpense(input);
    if (input.id) await prisma.expense.update({ where: { id: input.id }, data });
    else await prisma.expense.create({ data: { ...data, createdById: user.id } });
    revalidatePath("/finance");
  });
}

export async function deleteExpenseAction(id: string) {
  return runAction(async () => {
    await requireAdmin();
    await prisma.expense.delete({ where: { id } });
    revalidatePath("/finance");
  });
}

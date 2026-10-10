"use server";

import { revalidatePath } from "next/cache";
import type { Currency, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getLeadForUser } from "@/lib/access";
import { runAction } from "@/lib/actions";
import { formatMoney, parseInputDate } from "@/lib/format";
import { requireUser, AccessError } from "@/lib/session";
import { changeStatus, ValidationError } from "@/lib/leads/service";
import { SERVICE_TYPES } from "@/lib/constants";
import { dealClosesWithoutCost, visaLeadPatch } from "@/lib/deals";
import { debtLeft, parsePaidAtClose, parsePayment } from "@/lib/debts";
import { toNum } from "@/lib/money";

export interface DealInput {
  amount: string;
  cost: string;
  /** валюта продажи */
  currency: Currency;
  /** валюта себестоимости; если не указана — как у продажи */
  costCurrency?: Currency;
  paidAt: string;
  product: string;
  /** тип услуги, выбранный в списке «Продукт» */
  service?: ServiceType | "";
  /** для визы: страна и количество заявлений — записываются в лид, если там ещё не указаны */
  destination?: string | null;
  visaApplications?: number | null;
  /** количество продаж в сделке; учитывается только от администратора */
  quantity?: string | number;
  /** оплачено при закрытии сделки; пусто — вся сумма. Меньше суммы — остаток попадает в «Должники» */
  paid?: string;
  /** до какого числа клиент обещал доплатить (YYYY-MM-DD) */
  dueAt?: string;
}

const isCurrency = (c: unknown): c is Currency => c === "UZS" || c === "USD";

/** «Продажа 1 000 $, себестоимость 9 000 000 сум» — для истории лида */
function dealText(d: { product: string; amount: number; cost: number; currency: Currency; costCurrency: Currency }) {
  return `${d.product}: ${formatMoney(d.amount, d.currency)}, себестоимость ${formatMoney(d.cost, d.costCurrency)}`;
}

function parseDeal(input: DealInput) {
  const amount = Number(String(input.amount).replace(/\s/g, "").replace(",", "."));
  const cost = Number(String(input.cost || "0").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError("err.amount");
  if (!Number.isFinite(cost) || cost < 0) throw new ValidationError("err.costNegative");
  if (!isCurrency(input.currency)) throw new ValidationError("err.currency");
  const costCurrency = input.costCurrency ?? input.currency;
  if (!isCurrency(costCurrency)) throw new ValidationError("err.currency");
  const paidAt = parseInputDate(input.paidAt);
  if (!paidAt) throw new ValidationError("err.paidAt");
  const product = input.product.trim();
  if (!product) throw new ValidationError("err.product");
  const quantity = parseQuantity(input.quantity);
  return { amount, cost, currency: input.currency, costCurrency, paidAt, product, quantity };
}

/** Количество продаж: целое 1–500, пусто — 1 */
function parseQuantity(v: string | number | null | undefined): number {
  if (v === undefined || v === null || String(v).trim() === "") return 1;
  const n = Number(String(v).trim());
  if (!Number.isInteger(n) || n < 1 || n > 500) throw new ValidationError("err.quantity");
  return n;
}

function revalidate(leadId: string, clientId: string) {
  for (const p of ["/leads", "/kanban", "/", "/clients", "/reports", "/finance", "/debtors"]) revalidatePath(p);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/clients/${clientId}`);
}

/** Создание сделки; если передан wonStatusId — лид сразу переводится в «Продано». */
export async function createDealAction(leadId: string, input: DealInput, wonStatusId?: string | null) {
  return runAction(async () => {
    const user = await requireUser();
    const lead = await getLeadForUser(user, leadId);
    const service = input.service && SERVICE_TYPES.includes(input.service) ? input.service : null;
    // тип услуги лида берём из продукта сделки, если он ещё не указан, — по нему считается прибыль по продуктам
    const serviceType = lead.serviceType ?? service;
    const costConfirmed = dealClosesWithoutCost(serviceType) || service === "VISA";
    // при закрытии указывается только сумма продажи; себестоимость потом вносит администратор.
    // Количество продаж меняет только администратор; у менеджера — число заявлений для визы, иначе 1
    const quantity = user.role === "ADMIN" ? input.quantity : serviceType === "VISA" && input.visaApplications ? input.visaApplications : 1;
    const d = parseDeal({ ...input, cost: "0", costCurrency: input.currency, quantity });
    const paid = parsePaidAtClose(input.paid, d.amount);
    if (paid === null) throw new ValidationError("err.paidAmount");
    const left = debtLeft(d.amount, paid);
    const dueAt = left > 0 ? parseInputDate(input.dueAt) : null;
    await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          ...d,
          costConfirmed,
          leadId,
          clientId: lead.clientId,
          managerId: lead.managerId ?? user.id,
          paidAmount: paid,
          dueAt,
          ...(paid > 0 ? { payments: { create: { amount: paid, paidAt: d.paidAt, userId: user.id } } } : {}),
        },
      });
      const leadPatch = {
        ...(!lead.serviceType && service ? { serviceType: service } : {}),
        ...(serviceType === "VISA" ? visaLeadPatch(lead, input) : {}),
      };
      if (Object.keys(leadPatch).length) await tx.lead.update({ where: { id: leadId }, data: leadPatch });
      await tx.leadHistory.create({
        data: {
          leadId,
          userId: user.id,
          field: "deal",
          newValue: costConfirmed
            ? `${d.product}: ${formatMoney(d.amount, d.currency)}, расходы на визы — в расходах компании`
            : `${d.product}: ${formatMoney(d.amount, d.currency)}, себестоимость укажет администратор`,
        },
      });
      if (left > 0) {
        await tx.leadHistory.create({
          data: { leadId, userId: user.id, field: "debt", newValue: `Оплачено ${formatMoney(paid, d.currency)}, долг ${formatMoney(left, d.currency)}` },
        });
      }
      return deal;
    });
    if (wonStatusId) await changeStatus(leadId, { statusId: wonStatusId }, user);
    revalidate(leadId, lead.clientId);
  });
}

async function getDealForUser(dealId: string) {
  const user = await requireUser();
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new AccessError("err.dealNotFound");
  await getLeadForUser(user, deal.leadId);
  return { user, deal };
}

export async function updateDealAction(dealId: string, input: DealInput) {
  return runAction(async () => {
    const { user, deal } = await getDealForUser(dealId);
    // выручку и себестоимость после создания сделки меняет только администратор
    if (user.role !== "ADMIN") throw new AccessError("err.onlyAdminDealEdit");
    const d = parseDeal(input);
    await prisma.$transaction([
      prisma.deal.update({ where: { id: dealId }, data: { ...d, costConfirmed: true } }),
      prisma.leadHistory.create({
        data: {
          leadId: deal.leadId,
          userId: user.id,
          field: "deal",
          oldValue: dealText({ ...deal, amount: Number(deal.amount), cost: Number(deal.cost) }),
          newValue: dealText(d),
        },
      }),
    ]);
    revalidate(deal.leadId, deal.clientId);
  });
}

/** Администратор указывает себестоимость сделки, закрытой менеджером */
export async function setDealCostAction(dealId: string, costInput: string, costCurrencyInput?: Currency) {
  return runAction(async () => {
    const { user, deal } = await getDealForUser(dealId);
    if (user.role !== "ADMIN") throw new AccessError("err.onlyAdminDealEdit");
    const cost = Number(String(costInput).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(cost) || cost < 0 || String(costInput).trim() === "") throw new ValidationError("err.costNegative");
    const costCurrency = costCurrencyInput ?? deal.currency;
    if (!isCurrency(costCurrency)) throw new ValidationError("err.currency");
    await prisma.$transaction([
      prisma.deal.update({ where: { id: dealId }, data: { cost, costCurrency, costConfirmed: true } }),
      prisma.leadHistory.create({
        data: {
          leadId: deal.leadId,
          userId: user.id,
          field: "deal",
          oldValue: `${deal.product}: себестоимость не указана`,
          newValue: dealText({ ...deal, amount: Number(deal.amount), cost, costCurrency }),
        },
      }),
    ]);
    revalidate(deal.leadId, deal.clientId);
  });
}

export async function deleteDealAction(dealId: string) {
  return runAction(async () => {
    const { user, deal } = await getDealForUser(dealId);
    if (user.role !== "ADMIN") throw new AccessError("err.onlyAdminDeals");
    await prisma.$transaction([
      prisma.deal.delete({ where: { id: dealId } }),
      prisma.leadHistory.create({
        data: { leadId: deal.leadId, userId: user.id, field: "deal", oldValue: `${deal.product}: ${formatMoney(Number(deal.amount), deal.currency)}`, newValue: "удалена" },
      }),
    ]);
    revalidate(deal.leadId, deal.clientId);
  });
}

/** Клиент доплатил по сделке: сумма не больше остатка долга. Вносит менеджер лида или администратор. */
export async function addPaymentAction(dealId: string, input: { amount: string; paidAt: string; note?: string }) {
  return runAction(async () => {
    const { user, deal } = await getDealForUser(dealId);
    const left = debtLeft(toNum(deal.amount), toNum(deal.paidAmount));
    if (left <= 0) throw new ValidationError("err.noDebt");
    const amount = parsePayment(input.amount, left);
    if (amount === null) throw new ValidationError("err.paymentAmount", { max: formatMoney(left, deal.currency) });
    const paidAt = parseInputDate(input.paidAt);
    if (!paidAt) throw new ValidationError("err.paymentDate");
    const note = input.note?.trim().slice(0, 500) || null;
    const rest = debtLeft(left, amount);
    await prisma.$transaction([
      prisma.dealPayment.create({ data: { dealId, amount, paidAt, note, userId: user.id } }),
      prisma.deal.update({ where: { id: dealId }, data: { paidAmount: { increment: amount } } }),
      prisma.leadHistory.create({
        data: {
          leadId: deal.leadId,
          userId: user.id,
          field: "debt",
          oldValue: `Долг ${formatMoney(left, deal.currency)}`,
          newValue: rest > 0 ? `Оплата ${formatMoney(amount, deal.currency)}, осталось ${formatMoney(rest, deal.currency)}` : `Оплата ${formatMoney(amount, deal.currency)}, долг погашен`,
        },
      }),
    ]);
    revalidate(deal.leadId, deal.clientId);
    return { left: rest };
  });
}

/** Срок, до которого клиент обещал доплатить, и заметка о договорённости */
export async function setDebtTermsAction(dealId: string, input: { dueAt: string; note: string }) {
  return runAction(async () => {
    const { deal } = await getDealForUser(dealId);
    const dueAt = input.dueAt ? parseInputDate(input.dueAt) : null;
    if (input.dueAt && !dueAt) throw new ValidationError("err.dueAt");
    await prisma.deal.update({ where: { id: dealId }, data: { dueAt, debtNote: input.note.trim().slice(0, 1000) || null } });
    revalidate(deal.leadId, deal.clientId);
  });
}

/** Удалить ошибочно внесённую оплату (только администратор): долг возвращается */
export async function deletePaymentAction(paymentId: string) {
  return runAction(async () => {
    const payment = await prisma.dealPayment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AccessError("err.dealNotFound");
    const { user, deal } = await getDealForUser(payment.dealId);
    if (user.role !== "ADMIN") throw new AccessError("err.onlyAdminDealEdit");
    await prisma.$transaction([
      prisma.dealPayment.delete({ where: { id: paymentId } }),
      prisma.deal.update({ where: { id: deal.id }, data: { paidAmount: { decrement: payment.amount } } }),
      prisma.leadHistory.create({
        data: { leadId: deal.leadId, userId: user.id, field: "debt", oldValue: `Оплата ${formatMoney(toNum(payment.amount), deal.currency)}`, newValue: "удалена" },
      }),
    ]);
    revalidate(deal.leadId, deal.clientId);
  });
}

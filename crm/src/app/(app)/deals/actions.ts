"use server";

import { revalidatePath } from "next/cache";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getLeadForUser } from "@/lib/access";
import { runAction } from "@/lib/actions";
import { formatMoney, parseInputDate } from "@/lib/format";
import { requireUser, AccessError } from "@/lib/session";
import { changeStatus, ValidationError } from "@/lib/leads/service";
import { dealClosesWithoutCost } from "@/lib/deals";

export interface DealInput {
  amount: string;
  cost: string;
  /** валюта продажи */
  currency: Currency;
  /** валюта себестоимости; если не указана — как у продажи */
  costCurrency?: Currency;
  paidAt: string;
  product: string;
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
  return { amount, cost, currency: input.currency, costCurrency, paidAt, product };
}

function revalidate(leadId: string, clientId: string) {
  for (const p of ["/leads", "/kanban", "/", "/clients", "/reports", "/finance"]) revalidatePath(p);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/clients/${clientId}`);
}

/** Создание сделки; если передан wonStatusId — лид сразу переводится в «Продано». */
export async function createDealAction(leadId: string, input: DealInput, wonStatusId?: string | null) {
  return runAction(async () => {
    const user = await requireUser();
    const lead = await getLeadForUser(user, leadId);
    const isAdmin = user.role === "ADMIN";
    const costConfirmed = dealClosesWithoutCost(user.role, lead.serviceType);
    // менеджер указывает только сумму продажи; себестоимость потом вносит администратор
    const d = parseDeal(isAdmin ? input : { ...input, cost: "0", costCurrency: input.currency });
    await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({ data: { ...d, costConfirmed, leadId, clientId: lead.clientId, managerId: lead.managerId ?? user.id } });
      await tx.leadHistory.create({
        data: {
          leadId,
          userId: user.id,
          field: "deal",
          newValue: isAdmin
            ? dealText(d)
            : costConfirmed
              ? `${d.product}: ${formatMoney(d.amount, d.currency)}, расходы на визы — в расходах компании`
              : `${d.product}: ${formatMoney(d.amount, d.currency)}, себестоимость укажет администратор`,
        },
      });
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

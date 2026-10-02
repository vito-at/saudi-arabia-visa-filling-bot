"use server";

import { revalidatePath } from "next/cache";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getLeadForUser } from "@/lib/access";
import { runAction } from "@/lib/actions";
import { formatMoney, parseInputDate } from "@/lib/format";
import { calcProfit } from "@/lib/money";
import { requireUser, AccessError } from "@/lib/session";
import { changeStatus, ValidationError } from "@/lib/leads/service";

export interface DealInput {
  amount: string;
  cost: string;
  currency: Currency;
  paidAt: string;
  product: string;
}

function parseDeal(input: DealInput) {
  const amount = Number(String(input.amount).replace(/\s/g, "").replace(",", "."));
  const cost = Number(String(input.cost || "0").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError("err.amount");
  if (!Number.isFinite(cost) || cost < 0) throw new ValidationError("err.costNegative");
  if (input.currency !== "UZS" && input.currency !== "USD") throw new ValidationError("err.currency");
  const paidAt = parseInputDate(input.paidAt);
  if (!paidAt) throw new ValidationError("err.paidAt");
  const product = input.product.trim();
  if (!product) throw new ValidationError("err.product");
  return { amount, cost, currency: input.currency, paidAt, product };
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
    // менеджер указывает только сумму продажи; себестоимость потом вносит администратор
    const d = parseDeal(isAdmin ? input : { ...input, cost: "0" });
    await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({ data: { ...d, costConfirmed: isAdmin, leadId, clientId: lead.clientId, managerId: lead.managerId ?? user.id } });
      await tx.leadHistory.create({
        data: {
          leadId,
          userId: user.id,
          field: "deal",
          newValue: isAdmin
            ? `${d.product}: ${formatMoney(d.amount, d.currency)}, прибыль ${formatMoney(calcProfit(d.amount, d.cost), d.currency)}`
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
          oldValue: `${deal.product}: ${formatMoney(Number(deal.amount), deal.currency)}`,
          newValue: `${d.product}: ${formatMoney(d.amount, d.currency)}`,
        },
      }),
    ]);
    revalidate(deal.leadId, deal.clientId);
  });
}

/** Администратор указывает себестоимость сделки, закрытой менеджером */
export async function setDealCostAction(dealId: string, costInput: string) {
  return runAction(async () => {
    const { user, deal } = await getDealForUser(dealId);
    if (user.role !== "ADMIN") throw new AccessError("err.onlyAdminDealEdit");
    const cost = Number(String(costInput).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(cost) || cost < 0 || String(costInput).trim() === "") throw new ValidationError("err.costNegative");
    await prisma.$transaction([
      prisma.deal.update({ where: { id: dealId }, data: { cost, costConfirmed: true } }),
      prisma.leadHistory.create({
        data: {
          leadId: deal.leadId,
          userId: user.id,
          field: "deal",
          oldValue: `${deal.product}: себестоимость не указана`,
          newValue: `${deal.product}: себестоимость ${formatMoney(cost, deal.currency)}, прибыль ${formatMoney(calcProfit(deal.amount, cost), deal.currency)}`,
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

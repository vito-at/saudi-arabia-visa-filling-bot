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
  for (const p of ["/leads", "/kanban", "/", "/clients", "/reports"]) revalidatePath(p);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/clients/${clientId}`);
}

/** Создание сделки; если передан wonStatusId — лид сразу переводится в «Продано». */
export async function createDealAction(leadId: string, input: DealInput, wonStatusId?: string | null) {
  return runAction(async () => {
    const user = await requireUser();
    const lead = await getLeadForUser(user, leadId);
    const d = parseDeal(input);
    await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({ data: { ...d, leadId, clientId: lead.clientId, managerId: lead.managerId ?? user.id } });
      await tx.leadHistory.create({
        data: {
          leadId,
          userId: user.id,
          field: "deal",
          newValue: `${d.product}: ${formatMoney(d.amount, d.currency)}, прибыль ${formatMoney(calcProfit(d.amount, d.cost), d.currency)}`,
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
    const d = parseDeal(input);
    await prisma.$transaction([
      prisma.deal.update({ where: { id: dealId }, data: d }),
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

"use server";

import { revalidatePath } from "next/cache";
import type { Currency, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { SERVICE_TYPES } from "@/lib/constants";
import { toNum } from "@/lib/money";

export interface CellDeal {
  id: string;
  leadId: string;
  leadName: string;
  product: string;
  paidAt: string;
  amount: number;
  currency: Currency;
  quantity: number;
}

/** Сделки за ячейку отчёта «Продажи по продуктам»: менеджер × продукт × период (только администратор) */
export async function listCellDealsAction(input: { managerId: string; service: string; from: string; to: string }) {
  return runAction(async (): Promise<CellDeal[]> => {
    await requireAdmin();
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new ValidationError("err.badCell");
    const service = input.service === "none" ? null : SERVICE_TYPES.includes(input.service as ServiceType) ? (input.service as ServiceType) : undefined;
    if (service === undefined) throw new ValidationError("err.badCell");
    const rows = await prisma.deal.findMany({
      where: { paidAt: { gte: from, lt: to }, managerId: input.managerId === "none" ? null : input.managerId, lead: { serviceType: service } },
      orderBy: { paidAt: "desc" },
      select: { id: true, product: true, paidAt: true, amount: true, currency: true, quantity: true, lead: { select: { id: true, name: true } } },
    });
    return rows.map((d) => ({ id: d.id, leadId: d.lead.id, leadName: d.lead.name, product: d.product, paidAt: d.paidAt.toISOString(), amount: toNum(d.amount), currency: d.currency, quantity: d.quantity }));
  });
}

/** Количество продаж в сделке — меняет только администратор; изменение пишется в историю лида */
export async function setDealQuantityAction(dealId: string, quantity: number) {
  return runAction(async () => {
    const user = await requireAdmin();
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) throw new ValidationError("err.quantity");
    const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true, leadId: true, product: true, quantity: true } });
    if (!deal) throw new ValidationError("err.dealNotFound");
    if (deal.quantity === quantity) return quantity;
    await prisma.$transaction([
      prisma.deal.update({ where: { id: dealId }, data: { quantity } }),
      prisma.leadHistory.create({
        data: { leadId: deal.leadId, userId: user.id, field: "deal", oldValue: `${deal.product} × ${deal.quantity}`, newValue: `${deal.product} × ${quantity}` },
      }),
    ]);
    revalidatePath("/reports");
    revalidatePath(`/leads/${deal.leadId}`);
    return quantity;
  });
}

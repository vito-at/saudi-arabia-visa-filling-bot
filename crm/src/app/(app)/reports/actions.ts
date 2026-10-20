"use server";

import { revalidatePath } from "next/cache";
import type { Currency, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/constants";
import { toNum } from "@/lib/money";
import { confirmVisaDeals } from "@/lib/deal-costs";
import { monthKey, monthRange } from "@/lib/salary";

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

/** Тип услуги лида для сделки из «Не указан» (только администратор); изменение пишется в историю лида */
export async function setLeadServiceAction(leadId: string, service: string) {
  return runAction(async () => {
    const user = await requireAdmin();
    if (!SERVICE_TYPES.includes(service as ServiceType)) throw new ValidationError("err.badCell");
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, serviceType: true } });
    if (!lead) throw new ValidationError("err.leadNotFound");
    await prisma.$transaction([
      prisma.lead.update({ where: { id: leadId }, data: { serviceType: service as ServiceType } }),
      prisma.leadHistory.create({ data: { leadId, userId: user.id, field: "serviceType", oldValue: lead.serviceType ? SERVICE_LABELS[lead.serviceType] : null, newValue: SERVICE_LABELS[service as ServiceType] } }),
    ]);
    if (service === "VISA") await confirmVisaDeals(leadId);
    for (const p of ["/reports", "/finance", `/leads/${leadId}`]) revalidatePath(p);
  });
}

const num = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/** План менеджера на месяц и условия его зарплаты (только администратор) */
export async function savePlanAction(input: {
  userId: string;
  month: string;
  leads: string;
  sales: string;
  profit: string;
  salaryBase: string;
  salaryCurrency: string;
  commissionPct: string;
  planBonusPct: string;
  commissionFrom: string;
}) {
  return runAction(async () => {
    await requireAdmin();
    const range = monthRange(input.month);
    const leads = num(input.leads);
    const sales = num(input.sales);
    const profit = num(input.profit);
    const base = num(input.salaryBase) ?? 0;
    const pct = num(input.commissionPct) ?? 0;
    const bonus = num(input.planBonusPct) ?? 0;
    if ([leads, sales, profit, base, pct, bonus].some((x) => Number.isNaN(x)) || pct > 100 || bonus > 100) throw new ValidationError("err.planValues");
    const currency = input.salaryCurrency === "USD" ? "USD" : "UZS";
    await prisma.$transaction([
      prisma.managerPlan.upsert({
        where: { userId_month: { userId: input.userId, month: monthKey(range.ym) } },
        update: { leads: leads === null ? null : Math.round(leads), sales: sales === null ? null : Math.round(sales), profit },
        create: { userId: input.userId, month: monthKey(range.ym), leads: leads === null ? null : Math.round(leads), sales: sales === null ? null : Math.round(sales), profit },
      }),
      prisma.user.update({ where: { id: input.userId }, data: { salaryBase: base, salaryCurrency: currency, commissionPct: pct, planBonusPct: bonus, commissionFrom: input.commissionFrom === "PROFIT" ? "PROFIT" : "REVENUE" } }),
    ]);
    revalidatePath("/reports");
  });
}

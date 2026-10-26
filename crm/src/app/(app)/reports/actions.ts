"use server";

import { revalidatePath } from "next/cache";
import type { Currency, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { SERVICE_LABELS, SERVICE_TYPES, VISA_COUNTRIES } from "@/lib/constants";
import { toNum, parseAmount } from "@/lib/money";
import { confirmVisaDeals } from "@/lib/deal-costs";
import { monthKey, monthRange } from "@/lib/salary";
import { parseInputDate } from "@/lib/format";

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
      // продукт — тип услуги сделки, у старых сделок без типа — тип услуги лида (как в отчёте)
      where: {
        paidAt: { gte: from, lt: to },
        managerId: input.managerId === "none" ? null : input.managerId,
        OR: [...(service ? [{ serviceType: service }] : []), { serviceType: null, lead: { serviceType: service } }],
      },
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
      // старые сделки лида без своего типа услуги — тот же продукт: по нему считаются отчёты и зарплата
      prisma.deal.updateMany({ where: { leadId, serviceType: null }, data: { serviceType: service as ServiceType } }),
      prisma.leadHistory.create({ data: { leadId, userId: user.id, field: "serviceType", oldValue: lead.serviceType ? SERVICE_LABELS[lead.serviceType] : null, newValue: SERVICE_LABELS[service as ServiceType] } }),
    ]);
    if (service === "VISA") await confirmVisaDeals(leadId);
    for (const p of ["/reports", "/finance", `/leads/${leadId}`]) revalidatePath(p);
  });
}

const num = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = parseAmount(v);
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
    const terms = { base, currency, pct, bonusPct: bonus, commissionFrom: input.commissionFrom === "PROFIT" ? "PROFIT" : "REVENUE" } as const;
    // условия не менялись — новую запись не создаём, чтобы будущая правка более раннего месяца распространялась дальше
    const current = await prisma.salaryTerm.findFirst({ where: { userId: input.userId, fromMonth: { lte: monthKey(range.ym) } }, orderBy: { fromMonth: "desc" } });
    const same =
      current &&
      toNum(current.base) === base &&
      current.currency === currency &&
      toNum(current.pct) === pct &&
      toNum(current.bonusPct) === bonus &&
      current.commissionFrom === terms.commissionFrom;
    await prisma.$transaction([
      prisma.managerPlan.upsert({
        where: { userId_month: { userId: input.userId, month: monthKey(range.ym) } },
        update: { leads: leads === null ? null : Math.round(leads), sales: sales === null ? null : Math.round(sales), profit },
        create: { userId: input.userId, month: monthKey(range.ym), leads: leads === null ? null : Math.round(leads), sales: sales === null ? null : Math.round(sales), profit },
      }),
      // условия действуют с этого месяца до следующего изменения; прошлые месяцы считаются по прежним условиям
      ...(same
        ? []
        : [
            prisma.salaryTerm.upsert({
              where: { userId_fromMonth: { userId: input.userId, fromMonth: monthKey(range.ym) } },
              update: terms,
              create: { userId: input.userId, fromMonth: monthKey(range.ym), ...terms },
            }),
          ]),
    ]);
    revalidatePath("/reports");
  });
}

/** Выплата зарплаты менеджеру за месяц (частями); «Осталось» в отчёте уменьшается на сумму выплаты */
export async function addSalaryPayoutAction(input: { userId: string; month: string; amount: string; paidAt: string; note: string; currency: string }) {
  return runAction(async () => {
    const admin = await requireAdmin();
    const range = monthRange(input.month);
    const amount = num(input.amount);
    if (amount === null || Number.isNaN(amount) || amount <= 0) throw new ValidationError("err.payoutAmount");
    const paidAt = parseInputDate(input.paidAt) ?? new Date();
    const user = await prisma.user.findFirst({ where: { id: input.userId, role: "MANAGER" }, select: { id: true } });
    if (!user) throw new ValidationError("err.managerNotFound");
    await prisma.salaryPayout.create({
      data: {
        userId: user.id,
        month: monthKey(range.ym),
        amount,
        currency: input.currency === "USD" ? "USD" : "UZS",
        paidAt,
        note: input.note.trim().slice(0, 300) || null,
        createdById: admin.id,
      },
    });
    revalidatePath("/reports");
  });
}

export async function deleteSalaryPayoutAction(id: string) {
  return runAction(async () => {
    await requireAdmin();
    await prisma.salaryPayout.delete({ where: { id } }).catch(() => undefined);
    revalidatePath("/reports");
  });
}

/** Особый процент менеджеру с отдельной услуги (и страны визы) с выбранного дня — вместо обычного процента с этих сделок */
export async function addSalaryRuleAction(input: { userId: string; serviceType: string; country: string; pct: string; from: string; fromDate: string }) {
  return runAction(async () => {
    await requireAdmin();
    const serviceType = SERVICE_TYPES.find((s) => s === input.serviceType && s !== "FLIGHTS");
    const pct = parseAmount(input.pct);
    const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(input.fromDate) ? new Date(`${input.fromDate}T00:00:00Z`) : null;
    const country = serviceType === "VISA" ? (VISA_COUNTRIES.find((c) => c.ru === input.country)?.ru ?? null) : null;
    if (!serviceType || !fromDate || Number.isNaN(fromDate.getTime()) || !Number.isFinite(pct) || pct <= 0 || pct > 100) throw new ValidationError("err.salaryRule");
    const user = await prisma.user.findFirst({ where: { id: input.userId, role: "MANAGER" }, select: { id: true } });
    if (!user) throw new ValidationError("err.salaryRule");
    await prisma.salaryRule.create({ data: { userId: user.id, serviceType, country, pct, commissionFrom: input.from === "PROFIT" ? "PROFIT" : "REVENUE", fromDate } });
    revalidatePath("/reports");
  });
}

export async function deleteSalaryRuleAction(id: string) {
  return runAction(async () => {
    await requireAdmin();
    await prisma.salaryRule.delete({ where: { id } }).catch(() => undefined);
    revalidatePath("/reports");
  });
}

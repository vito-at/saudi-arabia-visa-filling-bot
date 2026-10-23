"use server";

import { revalidatePath } from "next/cache";
import type { Currency, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getLeadForUser } from "@/lib/access";
import { runAction } from "@/lib/actions";
import { formatMoney, formatNumber, parseInputDate } from "@/lib/format";
import { requireUser, AccessError } from "@/lib/session";
import { changeStatus, ValidationError } from "@/lib/leads/service";
import { SERVICE_TYPES } from "@/lib/constants";
import { autoVisaCostUsd, currencyMismatch, dealClosesWithoutCost, managerEntersCost, visaLeadPatch } from "@/lib/deals";
import { getSettings } from "@/lib/refs";
import { takeBlocked } from "@/lib/leads/distribution";
import { toNum, parseAmount } from "@/lib/money";
import { notifyCostPending } from "@/lib/notify";

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
}

const isCurrency = (c: unknown): c is Currency => c === "UZS" || c === "USD";

/** «Продажа 1 000 $, себестоимость 9 000 000 сум» — для истории лида */
function dealText(d: { product: string; amount: number; cost: number; currency: Currency; costCurrency: Currency }) {
  return `${d.product}: ${formatMoney(d.amount, d.currency)}, себестоимость ${formatMoney(d.cost, d.costCurrency)}`;
}

function parseDeal(input: DealInput) {
  const amount = parseAmount(input.amount);
  const cost = parseAmount(input.cost || "0");
  // «1,200» — это 1 200 или 1,2? Раньше молча сохранялось 1,2
  for (const v of [input.amount, input.cost]) if (v !== undefined && v !== null && String(v).trim() !== "" && Number.isNaN(parseAmount(v))) throw new ValidationError("err.amountAmbiguous", { value: String(v).trim() });
  if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError("err.amount");
  if (!Number.isFinite(cost) || cost < 0) throw new ValidationError("err.costNegative");
  if (!isCurrency(input.currency)) throw new ValidationError("err.currency");
  const costCurrency = input.costCurrency ?? input.currency;
  if (!isCurrency(costCurrency)) throw new ValidationError("err.currency");
  checkCurrency(amount, input.currency, "amount");
  checkCurrency(cost, costCurrency, "cost");
  const paidAt = parseInputDate(input.paidAt);
  if (!paidAt) throw new ValidationError("err.paidAt");
  const product = input.product.trim();
  if (!product) throw new ValidationError("err.product");
  const quantity = parseQuantity(input.quantity);
  return { amount, cost, currency: input.currency, costCurrency, paidAt, product, quantity };
}

/** Сумма не похожа на выбранную валюту (сумы с валютой «$» или наоборот) — не сохраняем, иначе ломаются продажи и зарплата */
function checkCurrency(value: number, currency: Currency, field: "amount" | "cost") {
  const bad = currencyMismatch(value, currency);
  if (!bad) return;
  const key = field === "amount" ? (bad === "usd" ? "err.amountLooksUzs" : "err.amountLooksUsd") : bad === "usd" ? "err.costLooksUzs" : "err.costLooksUsd";
  throw new ValidationError(key, { sum: formatNumber(value, 2) });
}

/** Количество продаж: целое 1–500, пусто — 1 */
function parseQuantity(v: string | number | null | undefined): number {
  if (v === undefined || v === null || String(v).trim() === "") return 1;
  const n = Number(String(v).trim());
  if (!Number.isInteger(n) || n < 1 || n > 500) throw new ValidationError("err.quantity");
  return n;
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
    const service = input.service && SERVICE_TYPES.includes(input.service) ? input.service : null;
    // тип услуги лида берём из продукта сделки, если он ещё не указан, — по нему считается прибыль по продуктам
    const serviceType = lead.serviceType ?? service;
    // авиабилеты: себестоимость указывается сразу при закрытии сделки
    const withCost = managerEntersCost(service);
    // «Продано» по новому нераспределённому лиду: менеджер сначала должен иметь право его взять (в работе, в пределах лимита).
    // Проверяем до записи сделки — иначе сделка сохранялась, смена статуса падала, и повторное нажатие давало дубль
    if (wonStatusId && user.role === "MANAGER" && !lead.managerId) {
      const status = await prisma.leadStatus.findUnique({ where: { id: lead.statusId }, select: { kind: true } });
      const blocked = status?.kind === "NEW" ? await takeBlocked(prisma, user.id) : null;
      if (blocked) throw new ValidationError(blocked);
    }
    if (withCost && !String(input.cost ?? "").trim()) throw new ValidationError("err.flightCost");
    // тип услуги самой сделки (продукт), а не лида: тур, проданный визовому клиенту, ждёт себестоимость, как любой тур
    const dealService = service ?? serviceType;
    const costConfirmed = withCost || dealClosesWithoutCost(dealService);
    // при закрытии указывается только сумма продажи; себестоимость потом вносит администратор.
    // Количество продаж меняет только администратор; у менеджера — число заявлений для визы, иначе 1
    const quantity = user.role === "ADMIN" ? input.quantity : dealService === "VISA" && input.visaApplications ? input.visaApplications : 1;
    let d = parseDeal(withCost ? { ...input, quantity } : { ...input, cost: "0", costCurrency: input.currency, quantity });
    // виза в Таиланд: себестоимость известна заранее — цена визы из настроек × число заявлений
    const visaCost = dealService === "VISA" ? autoVisaCostUsd(input.destination ?? lead.destination, d.quantity, toNum((await getSettings()).thaiVisaCostUsd)) : null;
    if (visaCost !== null) d = { ...d, cost: visaCost, costCurrency: "USD" };
    await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          ...d,
          // тип услуги сделки — от него зависит комиссия (авиабилеты — процент от прибыли на смену)
          serviceType: dealService,
          costConfirmed,
          leadId,
          clientId: lead.clientId,
          managerId: lead.managerId ?? user.id,
          // учёт долгов убран: сделка считается оплаченной полностью
          paidAmount: d.amount,
        },
      });
      const leadPatch = {
        ...(!lead.serviceType && service ? { serviceType: service } : {}),
        ...(dealService === "VISA" ? visaLeadPatch(lead, input) : {}),
      };
      if (Object.keys(leadPatch).length) await tx.lead.update({ where: { id: leadId }, data: leadPatch });
      await tx.leadHistory.create({
        data: {
          leadId,
          userId: user.id,
          field: "deal",
          newValue: withCost || visaCost !== null
            ? dealText(d)
            : costConfirmed
            ? `${d.product}: ${formatMoney(d.amount, d.currency)}, расходы на визы — в расходах компании`
            : `${d.product}: ${formatMoney(d.amount, d.currency)}, себестоимость укажет администратор`,
        },
      });
      return deal;
    });
    if (!costConfirmed && user.role !== "ADMIN") {
      const created = await prisma.deal.findFirst({ where: { leadId }, orderBy: { createdAt: "desc" }, select: { id: true, product: true } });
      if (created) await notifyCostPending({ id: created.id, leadId, product: created.product, leadName: lead.name });
    }
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
    // исправили продукт (например, «Тур» → «Авиабилеты») — меняется и тип услуги сделки: по нему считается зарплата
    const service = input.service && SERVICE_TYPES.includes(input.service) ? input.service : undefined;
    await prisma.$transaction([
      prisma.deal.update({ where: { id: dealId }, data: { ...d, ...(service ? { serviceType: service } : {}), costConfirmed: true } }),
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
    const cost = parseAmount(costInput);
    if (String(costInput).trim() !== "" && Number.isNaN(cost)) throw new ValidationError("err.amountAmbiguous", { value: String(costInput).trim() });
    if (!Number.isFinite(cost) || cost < 0 || String(costInput).trim() === "") throw new ValidationError("err.costNegative");
    const costCurrency = costCurrencyInput ?? deal.currency;
    if (!isCurrency(costCurrency)) throw new ValidationError("err.currency");
    checkCurrency(cost, costCurrency, "cost");
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

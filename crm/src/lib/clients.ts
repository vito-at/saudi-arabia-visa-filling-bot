import { Prisma, type Currency } from "@prisma/client";
import { prisma } from "./db";
import { round2 } from "./money";

export interface ClientAggRow {
  id: string;
  name: string;
  phone: string | null;
  createdAt: Date;
  leads: number;
  deals: number;
  revenue: number;
  cost: number;
  profit: number;
  lastDealAt: Date | null;
}

export interface ClientAggOptions {
  currency: Currency;
  /** курс продажи $ — для выручки */
  usdRate: number;
  /** курс покупки $ — для себестоимости; по умолчанию равен курсу продажи */
  usdRateCost?: number;
  search?: string;
  /** только клиенты менеджера и только его сделки */
  managerId?: string | null;
  /** сделки в периоде (по дате оплаты); если задан — показываем только клиентов со сделками в периоде */
  period?: { from: Date; to: Date };
  sort?: "revenue" | "profit" | "deals" | "name" | "lastDeal";
  limit?: number;
  offset?: number;
}

/**
 * Клиенты с количеством сделок, выручкой и прибылью.
 * Суммы пересчитываются в выбранную валюту: выручка по курсу продажи $, себестоимость по курсу покупки $ (SQL-агрегация, чтобы сортировать по выручке).
 */
export async function getClientAggregates(o: ClientAggOptions): Promise<{ rows: ClientAggRow[]; total: number }> {
  // коэффициенты пересчёта: сумма_в_целевой = amount * k(currency)
  const factors = (usdRate: number) => {
    const rate = new Prisma.Decimal(usdRate || 1);
    return { usd: o.currency === "UZS" ? rate : new Prisma.Decimal(1), uzs: o.currency === "UZS" ? new Prisma.Decimal(1) : new Prisma.Decimal(1).div(rate) };
  };
  const kSale = factors(o.usdRate);
  const kCost = factors(o.usdRateCost ?? o.usdRate);

  const dealCond: Prisma.Sql[] = [Prisma.sql`d."clientId" = c.id`];
  if (o.managerId) dealCond.push(Prisma.sql`d."managerId" = ${o.managerId}`);
  if (o.period) dealCond.push(Prisma.sql`d."paidAt" >= ${o.period.from} AND d."paidAt" < ${o.period.to}`);

  const where: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (o.search?.trim()) {
    const q = `%${o.search.trim()}%`;
    const digits = o.search.replace(/\D/g, "");
    where.push(digits.length >= 3 ? Prisma.sql`(c.name ILIKE ${q} OR c.phone LIKE ${`%${digits}%`})` : Prisma.sql`c.name ILIKE ${q}`);
  }
  if (o.managerId) where.push(Prisma.sql`EXISTS (SELECT 1 FROM "Lead" l WHERE l."clientId" = c.id AND l."managerId" = ${o.managerId})`);
  if (o.period) where.push(Prisma.sql`EXISTS (SELECT 1 FROM "Deal" d WHERE ${Prisma.join(dealCond, " AND ")})`);

  const order = {
    revenue: Prisma.sql`revenue DESC, c.name ASC`,
    profit: Prisma.sql`profit DESC, c.name ASC`,
    deals: Prisma.sql`deals DESC, revenue DESC`,
    name: Prisma.sql`c.name ASC`,
    lastDeal: Prisma.sql`"lastDealAt" DESC NULLS LAST`,
  }[o.sort ?? "revenue"];

  const conv = (col: "amount" | "cost") => {
    const k = col === "amount" ? kSale : kCost;
    return Prisma.sql`COALESCE(SUM(CASE WHEN d.currency = 'USD' THEN d.${Prisma.raw(`"${col}"`)} * ${k.usd} ELSE d.${Prisma.raw(`"${col}"`)} * ${k.uzs} END), 0)`;
  };

  const rows = await prisma.$queryRaw<
    { id: string; name: string; phone: string | null; createdAt: Date; leads: bigint; deals: bigint; revenue: Prisma.Decimal; cost: Prisma.Decimal; profit: Prisma.Decimal; lastDealAt: Date | null }[]
  >`
    SELECT c.id, c.name, c.phone, c."createdAt",
      (SELECT COUNT(*) FROM "Lead" l WHERE l."clientId" = c.id ${o.managerId ? Prisma.sql`AND l."managerId" = ${o.managerId}` : Prisma.empty}) AS leads,
      COUNT(d.id) AS deals,
      ${conv("amount")} AS revenue,
      ${conv("cost")} AS cost,
      ${conv("amount")} - ${conv("cost")} AS profit,
      MAX(d."paidAt") AS "lastDealAt"
    FROM "Client" c
    LEFT JOIN "Deal" d ON ${Prisma.join(dealCond, " AND ")}
    WHERE ${Prisma.join(where, " AND ")}
    GROUP BY c.id
    ORDER BY ${order}
    LIMIT ${o.limit ?? 50} OFFSET ${o.offset ?? 0}
  `;
  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM "Client" c WHERE ${Prisma.join(where, " AND ")}`;

  return {
    total: Number(count),
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      createdAt: r.createdAt,
      leads: Number(r.leads),
      deals: Number(r.deals),
      revenue: round2(Number(r.revenue)),
      cost: round2(Number(r.cost)),
      profit: round2(Number(r.profit)),
      lastDealAt: r.lastDealAt,
    })),
  };
}

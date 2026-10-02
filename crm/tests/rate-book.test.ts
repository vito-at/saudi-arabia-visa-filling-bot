import { describe, expect, it } from "vitest";
import { ratesOn, type RateBook } from "@/lib/rate-book";
import { convertCost, convertRevenue, sumDeals } from "@/lib/money";
import { groupDealsByLead } from "@/lib/finance";
import { dealProfit, dealRevenue } from "@/lib/reports/calc";

const book: RateBook = {
  days: [
    { date: "2026-09-01", sale: 12_500, cost: 12_600 },
    { date: "2026-09-10", sale: 12_600, cost: 12_700 },
    { date: "2026-10-01", sale: 12_800, cost: 12_950 },
  ],
  current: { sale: 13_000, cost: 13_100 },
};

describe("история курсов", () => {
  it("берёт курс дня операции, а между записями — последний известный", () => {
    expect(ratesOn(book, "2026-09-10")).toMatchObject({ sale: 12_600, cost: 12_700 });
    expect(ratesOn(book, "2026-09-25")).toMatchObject({ sale: 12_600, cost: 12_700 });
    expect(ratesOn(book, "2026-10-02")).toMatchObject({ sale: 12_800, cost: 12_950 });
  });
  it("до начала истории — самый ранний курс, без истории — текущий", () => {
    expect(ratesOn(book, "2026-01-15")).toMatchObject({ sale: 12_500, cost: 12_600 });
    expect(ratesOn({ days: [], current: book.current }, "2026-09-10")).toEqual(book.current);
  });
  it("дата операции — по Ташкенту", () => {
    // 30.09 21:00 UTC = 01.10 02:00 в Ташкенте
    expect(ratesOn(book, new Date("2026-09-30T21:00:00Z"))).toMatchObject({ sale: 12_800 });
    expect(ratesOn(book, new Date("2026-09-30T18:00:00Z"))).toMatchObject({ sale: 12_600 });
  });
  it("сделки прошлых дат считаются по своему курсу, новый курс их не меняет", () => {
    const deals = [
      { amount: 1000, cost: 800, currency: "USD" as const, paidAt: new Date("2026-09-12T08:00:00Z") },
      { amount: 1000, cost: 800, currency: "USD" as const, paidAt: new Date("2026-10-02T08:00:00Z") },
    ];
    const before = sumDeals(deals, "UZS", book);
    expect(before).toMatchObject({ revenue: 12_600_000 + 12_800_000, cost: 800 * 12_700 + 800 * 12_950 });
    // появился курс на новый день — старые сделки не меняются
    const later: RateBook = { ...book, days: [...book.days, { date: "2026-10-05", sale: 14_000, cost: 14_200 }] };
    expect(sumDeals(deals, "UZS", later)).toEqual(before);
  });
  it("финансы и отчёты используют курс дня оплаты", () => {
    const lead = { id: "l1", name: "Нодира", phone: null, source: "CALL" as const, campaignName: null, manager: null };
    const paidAt = new Date("2026-09-12T08:00:00Z");
    const [row] = groupDealsByLead([{ id: "d1", product: "Тур", amount: 1000, cost: 800, currency: "USD", paidAt, lead }], "UZS", book);
    expect(row).toMatchObject({ revenue: 12_600_000, cost: 10_160_000, profit: 2_440_000 });
    const d = { amount: 1000, cost: 800, currency: "USD" as const, paidAt, managerId: null };
    const m = { currency: "UZS" as const, rate: 13_000, book };
    expect(dealRevenue(d, m)).toBe(12_600_000);
    expect(dealProfit(d, m)).toBe(2_440_000);
  });
});

describe("прибыль по минимуму в любой валюте отчёта", () => {
  const r = { sale: 12_600, cost: 12_750 };
  it("доллары → сумы: выручка по меньшему курсу, расходы по большему", () => {
    expect(convertRevenue(1000, "USD", "UZS", r)).toBe(12_600_000);
    expect(convertCost(800, "USD", "UZS", r)).toBe(10_200_000);
  });
  it("сумы → доллары: выручка по большему курсу, расходы по меньшему", () => {
    expect(convertRevenue(12_750_000, "UZS", "USD", r)).toBe(1000); // а не 1011,90 по курсу 12 600
    expect(convertCost(12_600_000, "UZS", "USD", r)).toBe(1000); // а не 988,24 по курсу 12 750
  });
  it("сделка в сумах в долларовом отчёте не даёт завышенной прибыли", () => {
    const deal = { amount: 12_750_000, cost: 6_300_000, currency: "UZS" as const, paidAt: new Date("2026-09-12T08:00:00Z") };
    const s = sumDeals([deal], "USD", 12_600, 12_750);
    expect(s).toMatchObject({ revenue: 1000, cost: 500, profit: 500 });
    // любой одиночный курс дал бы прибыль больше или равную
    for (const one of [12_600, 12_750]) expect(sumDeals([deal], "USD", one).profit).toBeGreaterThanOrEqual(s.profit);
  });
  it("курсы перепутаны местами — результат тот же", () => {
    expect(convertRevenue(1000, "USD", "UZS", { sale: 12_750, cost: 12_600 })).toBe(12_600_000);
  });
});

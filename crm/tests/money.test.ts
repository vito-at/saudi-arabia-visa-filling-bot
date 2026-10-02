import { describe, expect, it } from "vitest";
import { calcMargin, calcProfit, convert, sumDeals } from "@/lib/money";

describe("прибыль и валюты", () => {
  it("прибыль = продажа − себестоимость", () => {
    expect(calcProfit(1200, 1000)).toBe(200);
    expect(calcProfit("1500.50", "1200.25")).toBe(300.25);
    expect(calcProfit(0.3, 0.1)).toBe(0.2); // без ошибок двоичной арифметики
    expect(calcProfit(900, 1000)).toBe(-100); // убыточная сделка
    expect(calcMargin(1000, 800)).toBeCloseTo(0.2);
    expect(calcMargin(0, 0)).toBeNull();
  });
  it("пересчёт по курсу USD→UZS", () => {
    expect(convert(100, "USD", "UZS", 12750)).toBe(1_275_000);
    expect(convert(1_275_000, "UZS", "USD", 12750)).toBe(100);
    expect(convert(5_000_000, "UZS", "UZS", 12750)).toBe(5_000_000);
    expect(() => convert(1, "USD", "UZS", 0)).toThrow();
  });
  it("итоги по сделкам в разных валютах", () => {
    const deals = [
      { amount: 1000, cost: 800, currency: "USD" as const },
      { amount: 6_375_000, cost: 5_100_000, currency: "UZS" as const }, // = $500 / $400
    ];
    expect(sumDeals(deals, "USD", 12750)).toEqual({ revenue: 1500, cost: 1200, profit: 300, count: 2, avgCheck: 750 });
    expect(sumDeals(deals, "UZS", 12750)).toEqual({ revenue: 19_125_000, cost: 15_300_000, profit: 3_825_000, count: 2, avgCheck: 9_562_500 });
    expect(sumDeals([], "USD", 12750)).toEqual({ revenue: 0, cost: 0, profit: 0, count: 0, avgCheck: 0 });
  });
  it("выручка по курсу продажи, себестоимость по курсу покупки", () => {
    const deals = [{ amount: 1000, cost: 800, currency: "USD" as const }];
    expect(sumDeals(deals, "UZS", 12_600, 12_750)).toEqual({ revenue: 12_600_000, cost: 10_200_000, profit: 2_400_000, count: 1, avgCheck: 12_600_000 });
    // сделка в долларах в долларовом отчёте не пересчитывается
    expect(sumDeals(deals, "USD", 12_600, 12_750)).toMatchObject({ revenue: 1000, cost: 800, profit: 200 });
  });
});

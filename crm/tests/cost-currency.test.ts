import { describe, expect, it } from "vitest";
import { dealProfitInSale, sumDeals } from "@/lib/money";
import { groupDealsByLead } from "@/lib/finance";
import { dealProfit, dealRevenue } from "@/lib/reports/calc";

// продажа в долларах, себестоимость в сумах — и наоборот
const r = { sale: 12_600, cost: 12_750 };
const usdSaleUzsCost = { amount: 1000, cost: 6_300_000, currency: "USD" as const, costCurrency: "UZS" as const, paidAt: new Date("2026-09-12T08:00:00Z") };
const uzsSaleUsdCost = { amount: 12_750_000, cost: 500, currency: "UZS" as const, costCurrency: "USD" as const, paidAt: new Date("2026-09-12T08:00:00Z") };

describe("себестоимость в другой валюте", () => {
  it("прибыль в валюте продажи: себестоимость пересчитывается по курсу, при котором она больше", () => {
    expect(dealProfitInSale(usdSaleUzsCost, r)).toBe(500); // 6 300 000 / 12 600 = $500
    expect(dealProfitInSale(uzsSaleUsdCost, r)).toBe(6_375_000); // 500 × 12 750 = 6 375 000 сум
  });
  it("итоги в долларах и сумах", () => {
    expect(sumDeals([usdSaleUzsCost], "USD", 12_600, 12_750)).toMatchObject({ revenue: 1000, cost: 500, profit: 500 });
    expect(sumDeals([usdSaleUzsCost], "UZS", 12_600, 12_750)).toMatchObject({ revenue: 12_600_000, cost: 6_300_000, profit: 6_300_000 });
    expect(sumDeals([uzsSaleUsdCost], "USD", 12_600, 12_750)).toMatchObject({ revenue: 1000, cost: 500, profit: 500 });
  });
  it("отчёты и финансы считают себестоимость из её валюты", () => {
    const m = { currency: "USD" as const, rate: 12_600, costRate: 12_750 };
    const d = { ...usdSaleUzsCost, managerId: null };
    expect(dealRevenue(d, m)).toBe(1000);
    expect(dealProfit(d, m)).toBe(500);
    const lead = { id: "l1", name: "Нодира", phone: null, source: "CALL" as const, campaignName: null, manager: null };
    const [row] = groupDealsByLead([{ id: "d1", product: "Виза", ...usdSaleUzsCost, lead }], "USD", 12_600, 12_750);
    expect(row).toMatchObject({ revenue: 1000, cost: 500, profit: 500 });
    expect(row.deals[0]).toMatchObject({ costCurrency: "UZS", profit: 500 });
  });
  it("без валюты себестоимости — как у продажи (старые данные)", () => {
    expect(sumDeals([{ amount: 1000, cost: 800, currency: "USD" }], "USD", 12_600, 12_750)).toMatchObject({ profit: 200 });
  });
});

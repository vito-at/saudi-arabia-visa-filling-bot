import { describe, expect, it } from "vitest";
import { productsByManager, type ProductDeal } from "@/lib/reports/products";

const m = { currency: "USD" as const, rate: 12_500 };
const deal = (managerId: string | null, serviceType: ProductDeal["serviceType"], amount: number, cost = 0): ProductDeal => ({
  amount,
  cost,
  currency: "USD",
  paidAt: new Date("2026-10-01T10:00:00Z"),
  managerId,
  serviceType,
});

describe("продажи по продуктам у менеджеров", () => {
  const rows = productsByManager(
    [deal("m1", "TOUR", 1000, 800), deal("m1", "TOUR", 500, 400), deal("m1", "VISA", 100), deal("m2", "FLIGHTS", 300, 250), deal("m2", null, 50), deal(null, "VISA", 90)],
    m,
  );

  it("считает количество сделок по каждому продукту, выручку и прибыль", () => {
    const m1 = rows.find((r) => r.id === "m1")!;
    expect(m1.counts).toMatchObject({ TOUR: 2, VISA: 1, FLIGHTS: 0, OTHER: 0, none: 0 });
    expect(m1).toMatchObject({ sales: 3, revenue: 1600, profit: 400 });
  });

  it("сделки без типа услуги — в «Не указан», без менеджера — отдельной строкой", () => {
    expect(rows.find((r) => r.id === "m2")!.counts).toMatchObject({ FLIGHTS: 1, none: 1 });
    expect(rows.find((r) => r.id === null)).toMatchObject({ sales: 1, revenue: 90 });
  });

  it("сортировка — по количеству продаж", () => {
    expect(rows.map((r) => r.id)).toEqual(["m1", "m2", null]);
  });
});

describe("количество в сделке", () => {
  it("виза на 6 человек считается как 6 продаж", () => {
    const [row] = productsByManager([{ ...deal("m1", "VISA", 600), quantity: 6 }, deal("m1", "TOUR", 100)], m);
    expect(row.counts).toMatchObject({ VISA: 6, TOUR: 1 });
    expect(row.sales).toBe(7);
    expect(row.revenue).toBe(700); // выручка — по сумме сделки, не умножается
  });
});

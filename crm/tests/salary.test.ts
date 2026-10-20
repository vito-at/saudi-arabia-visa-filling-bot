import { describe, expect, it } from "vitest";
import { calcPayout, monthRange, shiftMonth } from "@/lib/salary";

const fact = { leads: 40, sales: 12, profitUsd: 5000, profitSalary: 60_000_000, revenueUsd: 20_000, revenueSalary: 240_000_000 };

describe("зарплата и план", () => {
  it("оклад + процент от прибыли; надбавка при выполнении плана по прибыли", () => {
    const terms = { base: 3_000_000, currency: "UZS" as const, pct: 8, bonusPct: 2, from: "PROFIT" as const };
    const met = calcPayout(terms, { leads: 50, sales: 10, profit: 4000 }, fact);
    expect(met.planMet).toBe(true);
    expect(met.ratePct).toBe(10);
    expect(met.commission).toBe(6_000_000);
    expect(met.total).toBe(9_000_000);
    expect(met.done).toEqual({ leads: 0.8, sales: 1.2, profit: 1.25 });
    const notMet = calcPayout(terms, { leads: null, sales: null, profit: 6000 }, fact);
    expect(notMet.planMet).toBe(false);
    expect(notMet.commission).toBe(4_800_000);
    expect(notMet.done.leads).toBeNull();
  });
  it("по умолчанию: 1 500 000 сум + 5% от суммы продаж (не от прибыли)", () => {
    const r = calcPayout({ base: 1_500_000, currency: "UZS", pct: 5, bonusPct: 0, from: "REVENUE" }, { leads: null, sales: null, profit: null }, fact);
    expect(r.commission).toBe(12_000_000);
    expect(r.total).toBe(13_500_000);
  });
  it("убыточный месяц — только оклад", () => {
    const r = calcPayout({ base: 500, currency: "USD", pct: 10, bonusPct: 0, from: "PROFIT" }, { leads: null, sales: null, profit: null }, { ...fact, profitUsd: -100, profitSalary: -100 });
    expect(r.commission).toBe(0);
    expect(r.total).toBe(500);
  });
  it("границы месяца по Ташкенту", () => {
    const r = monthRange("2026-12");
    expect(r.from.toISOString()).toBe("2026-11-30T19:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-12-31T19:00:00.000Z");
    expect(monthRange("bad", new Date("2026-10-17T12:00:00Z")).ym).toBe("2026-10");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

import { monthGrid } from "@/lib/calendar";
describe("сетка календаря", () => {
  it("недели с понедельника, октябрь 2026 начинается в четверг", () => {
    const g = monthGrid("2026-10");
    expect(g[0][0]).toBe("2026-09-28");
    expect(g[0][3]).toBe("2026-10-01");
    expect(g.at(-1)!.includes("2026-10-31")).toBe(true);
    expect(g.length).toBe(5);
  });
});

import { describe, expect, it } from "vitest";
import { calcPayout, dealCountry, ruleForDeal, type SalaryRuleView } from "@/lib/salary";

const thai: SalaryRuleView = { id: "r1", serviceType: "VISA", country: "Таиланд", pct: 9, from: "REVENUE", fromDate: "2026-10-25" };
// 25.10 по Ташкенту начинается 24.10 в 19:00 UTC
const at = (iso: string) => new Date(iso);

describe("особые проценты", () => {
  it("страна визы из названия продукта на любом языке", () => {
    expect(dealCountry("Виза: Таиланд, 2 заявл.")).toBe("Таиланд");
    expect(dealCountry("Viza ko‘magi: Tailand, 1 ariza")).toBe("Таиланд");
    expect(dealCountry("Visa support: Thailand")).toBe("Таиланд");
    expect(dealCountry("Виза: Саудовская Аравия")).toBe("Саудовская Аравия");
    expect(dealCountry("Виза: Вьетнам")).toBe("Вьетнам");
    expect(dealCountry("Тур: Дубай")).toBeNull();
  });

  it("правило действует с 25.10 включительно (по Ташкенту) и только для своей страны", () => {
    const deal = (product: string, paidAt: string) => ({ serviceType: "VISA" as const, product, paidAt: at(paidAt) });
    expect(ruleForDeal(deal("Виза: Таиланд", "2026-10-24T19:30:00Z"), [thai])?.id).toBe("r1");
    expect(ruleForDeal(deal("Виза: Таиланд", "2026-10-24T18:30:00Z"), [thai])).toBeNull();
    expect(ruleForDeal(deal("Виза: Вьетнам", "2026-10-26T10:00:00Z"), [thai])).toBeNull();
    expect(ruleForDeal({ serviceType: "TOUR", product: "Тур: Таиланд", paidAt: at("2026-10-26T10:00:00Z") }, [thai])).toBeNull();
  });

  it("правило для страны важнее общего правила услуги", () => {
    const any: SalaryRuleView = { ...thai, id: "r2", country: null, pct: 5, fromDate: "2026-10-26" };
    const d = { serviceType: "VISA" as const, product: "Виза: Таиланд", paidAt: at("2026-10-27T10:00:00Z") };
    expect(ruleForDeal(d, [thai, any])?.id).toBe("r1");
    expect(ruleForDeal({ ...d, product: "Виза: Вьетнам" }, [thai, any])?.id).toBe("r2");
  });

  it("особый процент прибавляется к начислению, надбавка за план на него не действует", () => {
    const terms = { base: 0, currency: "USD" as const, pct: 5, bonusPct: 2, from: "REVENUE" as const };
    const fact = { leads: 0, sales: 0, profitUsd: 100, profitSalary: 0, revenueUsd: 0, revenueSalary: 1000, flightProfitSalary: 0, flightCommission: 0, ruleCommission: 18 };
    const pay = calcPayout(terms, { leads: null, sales: null, profit: 50 }, fact);
    expect(pay.commission).toBe(1000 * 0.07 + 18);
  });
});

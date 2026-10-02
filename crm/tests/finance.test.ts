import { describe, expect, it } from "vitest";
import { expensesByCategory, financeSummary, groupDealsByLead, type ExpenseRow } from "@/lib/finance";

const lead = (id: string, name: string) => ({ id, name, phone: "998901234567", source: "META_IG" as const, campaignName: "Дубай", manager: { name: "Гулнора" } });
const RATE = 12_500;

describe("финансы: прибыль по лидам", () => {
  const deals = [
    { id: "d1", product: "Тур", amount: 1000, cost: 800, currency: "USD" as const, paidAt: new Date("2026-09-10T10:00:00Z"), lead: lead("l1", "Нодира") },
    { id: "d2", product: "Виза", amount: 1_250_000, cost: 250_000, currency: "UZS" as const, paidAt: new Date("2026-09-20T10:00:00Z"), lead: lead("l1", "Нодира") },
    { id: "d3", product: "Авиабилеты", amount: 500, cost: 520, currency: "USD" as const, paidAt: new Date("2026-09-15T10:00:00Z"), lead: lead("l2", "Фаррух") },
  ];

  it("себестоимость пересчитывается по курсу покупки, выручка — по курсу продажи", () => {
    const [row] = groupDealsByLead([deals[0]], "UZS", 12_600, 12_750);
    expect(row).toMatchObject({ revenue: 12_600_000, cost: 10_200_000, profit: 2_400_000 });
  });

  it("суммирует сделки лида в валюте отчёта, считает прибыль и маржу", () => {
    const rows = groupDealsByLead(deals, "USD", RATE);
    expect(rows.map((r) => r.id)).toEqual(["l1", "l2"]); // по последней оплате, новые сверху
    expect(rows[0]).toMatchObject({ revenue: 1100, cost: 820, profit: 280, lastPaidAt: "2026-09-20T10:00:00.000Z" });
    expect(rows[0].margin).toBeCloseTo(280 / 1100);
    expect(rows[0].deals).toHaveLength(2);
    expect(rows[1]).toMatchObject({ revenue: 500, cost: 520, profit: -20 }); // убыточная сделка
  });

  it("сделка без себестоимости (закрыл менеджер) помечается у лида", () => {
    const rows = groupDealsByLead([{ ...deals[2], costConfirmed: false, cost: 0 }, deals[0]], "USD", RATE);
    const l2 = rows.find((r) => r.id === "l2")!;
    expect(l2.costPending).toBe(true);
    expect(l2.deals[0].costConfirmed).toBe(false);
    expect(rows.find((r) => r.id === "l1")!.costPending).toBe(false);
  });

  it("в сумах — по текущему курсу", () => {
    const [l1] = groupDealsByLead(deals, "UZS", RATE);
    expect(l1).toMatchObject({ revenue: 13_750_000, cost: 10_250_000, profit: 3_500_000 });
  });

  it("чистая прибыль = валовая − реклама − расходы компании", () => {
    const rows = groupDealsByLead(deals, "USD", RATE);
    expect(financeSummary(rows, 100, 50)).toMatchObject({ revenue: 1600, cost: 1340, grossProfit: 260, adSpend: 100, expenses: 50, netProfit: 110, deals: 3, leads: 2 });
    // реклама не подключена — вычитаются только расходы компании
    expect(financeSummary(rows, null, 0)).toMatchObject({ adSpend: null, netProfit: 260 });
  });

  it("расходы по статьям — по убыванию", () => {
    const e = (category: string, converted: number): ExpenseRow => ({ id: category + converted, date: "2026-09-01", category, amount: converted, currency: "USD", converted, note: null, createdBy: null });
    expect(expensesByCategory([e("Аренда", 300), e("Зарплата", 900), e("Аренда", 300)])).toEqual([
      { category: "Зарплата", total: 900 },
      { category: "Аренда", total: 600 },
    ]);
  });
});

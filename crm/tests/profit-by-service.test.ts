import { describe, expect, it } from "vitest";
import { groupDealsByLead, profitByService } from "@/lib/finance";

const lead = (id: string, serviceType: "FLIGHTS" | "TOUR" | "VISA" | "OTHER" | null) => ({ id, name: id, phone: null, source: "CALL" as const, serviceType, campaignName: null, manager: null });
const deal = (id: string, leadId: string, service: Parameters<typeof lead>[1], amount: number, cost: number) => ({
  id,
  product: "x",
  amount,
  cost,
  currency: "USD" as const,
  paidAt: new Date("2026-09-10T10:00:00Z"),
  lead: lead(leadId, service),
});

describe("прибыль по продуктам", () => {
  const leads = groupDealsByLead(
    [deal("d1", "l1", "TOUR", 1000, 800), deal("d2", "l1", "TOUR", 500, 400), deal("d3", "l2", "VISA", 300, 100), deal("d4", "l3", "FLIGHTS", 500, 520), deal("d5", "l4", null, 100, 60)],
    "USD",
    12_500,
  );

  it("суммирует выручку, себестоимость и прибыль по типу услуги лида, сортирует по прибыли", () => {
    const rows = profitByService(leads);
    expect(rows.map((r) => r.service)).toEqual(["TOUR", "VISA", null, "FLIGHTS"]);
    expect(rows[0]).toMatchObject({ revenue: 1500, cost: 1200, profit: 300, deals: 2, leads: 1 });
    expect(rows[0].margin).toBeCloseTo(0.2);
    expect(rows.find((r) => r.service === "FLIGHTS")).toMatchObject({ profit: -20 });
  });

  it("доля — от общей прибыли, убыточный продукт — ноль", () => {
    const rows = profitByService(leads);
    const total = 300 + 200 + 40 - 20;
    expect(rows[0].share).toBeCloseTo(300 / total);
    expect(rows.find((r) => r.service === "FLIGHTS")!.share).toBe(0);
  });

  it("без сделок — пустой список", () => {
    expect(profitByService([])).toEqual([]);
  });
});

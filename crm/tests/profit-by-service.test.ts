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

  it("суммирует выручку, себестоимость и прибыль по продукту, сортирует по прибыли", () => {
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

  it("продукт — тип услуги сделки: билет визовому клиенту считается авиабилетом", () => {
    const rows = profitByService(groupDealsByLead([{ ...deal("d6", "l5", "VISA", 400, 300), serviceType: "FLIGHTS" as const }, deal("d7", "l5", "VISA", 100, 40)], "USD", 12_500));
    expect(rows.find((r) => r.service === "FLIGHTS")).toMatchObject({ revenue: 400, profit: 100, deals: 1, leads: 1 });
    expect(rows.find((r) => r.service === "VISA")).toMatchObject({ revenue: 100, profit: 60, deals: 1, leads: 1 });
  });

  it("менеджер — тот, кто продал, а не текущий ответственный лида", () => {
    const [row] = groupDealsByLead([{ ...deal("d8", "l6", "TOUR", 100, 50), manager: { name: "Анна" }, lead: { ...lead("l6", "TOUR"), manager: { name: "Бобур" } } }], "USD", 12_500);
    expect(row.manager).toBe("Анна");
    expect(row.deals[0].manager).toBe("Анна");
  });

  it("без сделок — пустой список", () => {
    expect(profitByService([])).toEqual([]);
  });
});

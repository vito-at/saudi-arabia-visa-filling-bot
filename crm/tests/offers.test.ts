import { describe, expect, it } from "vitest";
import { offerPrice, offersText, type OfferView } from "@/lib/offers";

const o: OfferView = { id: "1", hotel: "Swiss Heaven Sharming Inn", stars: 4, destination: "Шарм-эль-Шейх", meal: "All Inclusive", dateFrom: "2026-10-27", nights: 7, adults: 2, children: null, operator: "Easy Booking", priceOperator: 1442, markup: 100, currency: "USD", photoUrl: null, link: null, note: null };

describe("подборка туров", () => {
  it("цена клиенту = цена оператора + наценка; оператор в тексте не виден", () => {
    expect(offerPrice(o)).toBe(1542);
    const text = offersText([o], "ru", "https://crm.test/o/abc");
    expect(text).toContain("1) Swiss Heaven Sharming Inn ★★★★ — Шарм-эль-Шейх");
    expect(text).toContain("📅 27.10.2026 · 7 ночей · 2 взр.");
    expect(text).toContain("💰");
    expect(text).toContain("1 542");
    expect(text).not.toContain("Easy Booking");
    expect(text).not.toContain("1 442");
    expect(text.endsWith("https://crm.test/o/abc")).toBe(true);
  });
});

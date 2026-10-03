import { describe, expect, it } from "vitest";
import { groupVisaSales } from "@/lib/reports/visas";

describe("отчёт «Визы»", () => {
  it("складывает заявления по странам, разные написания — одна страна", () => {
    const { rows, noCount } = groupVisaSales([
      { destination: "Таиланд", applications: 3, revenue: 300, profit: 90 },
      { destination: "тайланд", applications: 2, revenue: 200, profit: 60 },
      { destination: "Сингапур", applications: 1, revenue: 150, profit: 40 },
      { destination: "Индия", applications: null, revenue: 100, profit: 20 },
      { destination: null, applications: 4, revenue: 400, profit: 100 },
    ]);
    expect(rows.map((r) => [r.name, r.applications, r.sales, r.revenue])).toEqual([
      ["Таиланд", 5, 2, 500],
      [null, 4, 1, 400],
      ["Сингапур", 1, 1, 150],
      ["Индия", 1, 1, 100],
    ]);
    expect(noCount).toBe(1); // без количества — считаем как одно заявление
  });
});

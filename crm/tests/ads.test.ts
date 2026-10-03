import { describe, expect, it } from "vitest";
import { adBuckets, adStats, bucketStart, bucketStarts, defaultAdGroup, type AdDay, type AdLead } from "@/lib/reports/ads";

const day = (date: string, spend: number, clicks = 0, impressions = 0): AdDay => ({ date, spend, clicks, impressions });
const lead = (d: string, won = false, revenue = 0, profit = 0): AdLead => ({ day: d, won, revenue, profit });

describe("реклама: периоды", () => {
  it("неделя начинается с понедельника, месяц — с 1-го числа", () => {
    expect(bucketStart("2026-10-03", "week")).toBe("2026-09-28"); // суббота → понедельник
    expect(bucketStart("2026-09-28", "week")).toBe("2026-09-28");
    expect(bucketStart("2026-10-04", "week")).toBe("2026-09-28"); // воскресенье
    expect(bucketStart("2026-10-17", "month")).toBe("2026-10-01");
  });
  it("перечисляет все периоды, в том числе без расхода", () => {
    expect(bucketStarts("2026-09-29", "2026-10-02", "day")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(bucketStarts("2026-11-15", "2027-01-10", "month")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });
  it("шаг по умолчанию зависит от длины периода", () => {
    const p = (days: number) => ({ from: new Date("2026-01-01"), to: new Date(new Date("2026-01-01").getTime() + days * 86_400_000) });
    expect(defaultAdGroup(p(30))).toBe("day");
    expect(defaultAdGroup(p(90))).toBe("week");
    expect(defaultAdGroup(p(365))).toBe("month");
  });
});

describe("реклама: показатели", () => {
  it("цена лида, цена продажи, CTR, CPC и ROI", () => {
    const s = adStats([day("2026-10-01", 60, 30, 3000), day("2026-10-02", 40, 20, 2000)], [lead("2026-10-01"), lead("2026-10-01", true, 1000, 300), lead("2026-10-02"), lead("2026-10-02")]);
    expect(s).toMatchObject({ spend: 100, leads: 4, sales: 1, cpl: 25, cps: 100, cpc: 2, ctr: 0.01, conversion: 0.25, revenue: 1000, profit: 300 });
    expect(s.roi).toBeCloseTo(2); // (300 − 100) / 100
  });
  it("без лидов и продаж цены не считаются, без расхода нет ROI", () => {
    expect(adStats([day("2026-10-01", 50)], [])).toMatchObject({ cpl: null, cps: null, roi: -1 });
    expect(adStats([], [lead("2026-10-01")])).toMatchObject({ cpl: 0, roi: null });
  });
  it("цена лида по неделям", () => {
    const rows = adBuckets(
      [day("2026-09-28", 30), day("2026-10-01", 30), day("2026-10-05", 50)],
      [lead("2026-09-29"), lead("2026-09-30"), lead("2026-10-02"), lead("2026-10-06", true)],
      "2026-09-28",
      "2026-10-11",
      "week",
    );
    expect(rows.map((r) => [r.start, r.spend, r.leads, r.cpl, r.sales])).toEqual([
      ["2026-09-28", 60, 3, 20, 0],
      ["2026-10-05", 50, 1, 50, 1],
    ]);
  });
});

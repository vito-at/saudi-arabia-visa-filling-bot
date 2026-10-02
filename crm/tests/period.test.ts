import { describe, expect, it } from "vitest";
import { dateColumnRange, resolvePeriod } from "@/lib/period";

describe("границы периода для колонок DATE", () => {
  it("включает последний день периода и не захватывает лишний день в начале", () => {
    // 2 октября 2026, 15:00 по Ташкенту
    const now = new Date("2026-10-02T10:00:00Z");
    const p = resolvePeriod("7d", undefined, undefined, now);
    const r = dateColumnRange(p);
    expect(r.gte.toISOString()).toBe("2026-09-26T00:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });
  it("свой период: с первой по последнюю дату включительно", () => {
    const r = dateColumnRange(resolvePeriod("custom", "2026-09-01", "2026-09-30"));
    expect(r.gte.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

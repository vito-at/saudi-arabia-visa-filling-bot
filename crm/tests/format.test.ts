import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMoney, formatNumber, parseInputDate, toInputDate } from "@/lib/format";
import { previousPeriod, resolvePeriod } from "@/lib/period";

describe("форматирование", () => {
  it("дата в формате ДД.ММ.ГГГГ по Ташкенту", () => {
    // 20:30 UTC 31 декабря — в Ташкенте уже 1 января
    expect(formatDate(new Date("2025-12-31T20:30:00Z"))).toBe("01.01.2026");
    expect(formatDateTime(new Date("2026-03-05T04:07:00Z"))).toBe("05.03.2026 09:07");
  });
  it("числа и суммы с разделителями разрядов", () => {
    expect(formatNumber(1234567)).toBe("1 234 567");
    expect(formatMoney(15500000, "UZS")).toBe("15 500 000 сум");
    expect(formatMoney(1250.5, "USD")).toBe("$1 250,5");
  });
  it("разбор даты из input как ташкентской полуночи", () => {
    const d = parseInputDate("2026-09-30")!;
    expect(d.toISOString()).toBe("2026-09-29T19:00:00.000Z");
    expect(toInputDate(d)).toBe("2026-09-30");
  });
});

describe("периоды", () => {
  const now = new Date("2026-09-30T10:00:00+05:00");
  it("этот месяц и сравнение с прошлым", () => {
    const p = resolvePeriod("month", undefined, undefined, now);
    expect(toInputDate(p.from)).toBe("2026-09-01");
    expect(toInputDate(p.to)).toBe("2026-10-01");
    const prev = previousPeriod(p);
    expect(toInputDate(prev.from)).toBe("2026-08-01");
    expect(prev.to.getTime()).toBe(p.from.getTime());
  });
  it("7 дней включают сегодня", () => {
    const p = resolvePeriod("7d", undefined, undefined, now);
    expect(toInputDate(p.from)).toBe("2026-09-24");
    expect(toInputDate(p.to)).toBe("2026-10-01");
  });
  it("произвольный период", () => {
    const p = resolvePeriod("custom", "2026-01-10", "2026-01-12", now);
    expect(toInputDate(p.from)).toBe("2026-01-10");
    expect(toInputDate(p.to)).toBe("2026-01-13");
  });
});

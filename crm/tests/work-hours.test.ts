import { describe, expect, it } from "vitest";
import { isWorkTime, timeToMin, workMinutesBetween } from "@/lib/work-hours";

// время по Ташкенту
const T = (s: string) => new Date(`${s}+05:00`);

describe("рабочее время (09:00–18:00, пн–сб)", () => {
  it("внутри рабочего дня — обычные минуты", () => {
    expect(workMinutesBetween(T("2026-10-14T10:00:00"), T("2026-10-14T10:25:00"))).toBe(25);
  });
  it("лид ночью: отсчёт с 09:00 следующего дня", () => {
    expect(workMinutesBetween(T("2026-10-14T23:10:00"), T("2026-10-15T09:20:00"))).toBe(20);
  });
  it("вечер пятницы → понедельник через выходной воскресенья", () => {
    // пт 17:50 → пт 18:00 (10) + сб весь день (540) + вс не рабочий + пн 09:00–09:05 (5)
    expect(workMinutesBetween(T("2026-10-16T17:50:00"), T("2026-10-19T09:05:00"))).toBe(555);
  });
  it("ответ раньше начала дня — 0", () => {
    expect(workMinutesBetween(T("2026-10-14T23:00:00"), T("2026-10-15T08:30:00"))).toBe(0);
  });
  it("рабочее ли время", () => {
    expect(isWorkTime(T("2026-10-14T09:00:00"))).toBe(true);
    expect(isWorkTime(T("2026-10-14T18:00:00"))).toBe(false);
    expect(isWorkTime(T("2026-10-18T12:00:00"))).toBe(false); // воскресенье
  });
  it("разбор времени", () => {
    expect(timeToMin("09:30")).toBe(570);
    expect(timeToMin("25:00")).toBeNull();
  });
});

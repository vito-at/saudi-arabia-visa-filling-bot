import { describe, expect, it } from "vitest";
import { dayState, distanceM, lateMinutes, monthDays, summarize, tashkentMinutes } from "@/lib/attendance";
import { DEFAULT_SCHEDULE } from "@/lib/work-hours";

const at = (s: string) => new Date(`${s}+05:00`);

describe("посещаемость", () => {
  it("минуты по Ташкенту", () => {
    expect(tashkentMinutes(at("2026-10-19T09:07:00"))).toBe(547);
  });
  it("опоздание с учётом льготных минут и выходных", () => {
    // понедельник, начало 09:00, льгота 10 минут
    expect(lateMinutes(at("2026-10-19T09:09:00"), DEFAULT_SCHEDULE, 10)).toBe(0);
    expect(lateMinutes(at("2026-10-19T09:25:00"), DEFAULT_SCHEDULE, 10)).toBe(25);
    // воскресенье — выходной
    expect(lateMinutes(at("2026-10-18T11:00:00"), DEFAULT_SCHEDULE, 10)).toBe(0);
  });
  it("расстояние", () => {
    const d = distanceM({ lat: 40.3864, lng: 71.7864 }, { lat: 40.3874, lng: 71.7864 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });
  it("табель и итоги месяца", () => {
    expect(monthDays("2026-02")).toHaveLength(28);
    const marks = [
      { day: "2026-10-19", checkInAt: at("2026-10-19T08:55:00"), checkOutAt: at("2026-10-19T18:05:00"), lateMin: 0, fine: 0 },
      { day: "2026-10-20", checkInAt: at("2026-10-20T09:30:00"), checkOutAt: null, lateMin: 30, fine: 50_000 },
    ];
    const today = "2026-10-22";
    expect(dayState("2026-10-19", marks[0], DEFAULT_SCHEDULE, today, "2026-10-19")).toBe("ok");
    expect(dayState("2026-10-20", marks[1], DEFAULT_SCHEDULE, today, "2026-10-19")).toBe("late");
    expect(dayState("2026-10-21", undefined, DEFAULT_SCHEDULE, today, "2026-10-19")).toBe("absent");
    expect(dayState("2026-10-22", undefined, DEFAULT_SCHEDULE, today, "2026-10-19")).toBe("off");
    expect(dayState("2026-10-25", undefined, DEFAULT_SCHEDULE, today, "2026-10-19")).toBe("future");
    // до первой отметки пропусков нет
    expect(dayState("2026-10-16", undefined, DEFAULT_SCHEDULE, today, "2026-10-19")).toBe("off");
    expect(dayState("2026-10-21", undefined, DEFAULT_SCHEDULE, today, null)).toBe("off");
    const sum = summarize(["2026-10-16", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"], marks, DEFAULT_SCHEDULE, today, "2026-10-19");
    expect(sum).toMatchObject({ worked: 2, late: 1, lateMin: 30, absent: 1, fines: 50_000, hours: 9.2 });
    expect(sum.avgIn).toBe(Math.round((535 + 570) / 2));
  });
});

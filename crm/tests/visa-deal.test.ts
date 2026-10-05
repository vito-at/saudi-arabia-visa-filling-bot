import { describe, expect, it } from "vitest";
import { dealClosesWithoutCost } from "@/lib/deals";

describe("сделка без ожидания себестоимости", () => {
  it("визовая поддержка у менеджера закрывается сразу", () => {
    expect(dealClosesWithoutCost("MANAGER", "VISA")).toBe(true);
  });
  it("остальные услуги менеджера ждут себестоимость от администратора", () => {
    for (const s of ["FLIGHTS", "TOUR", "OTHER", null] as const) expect(dealClosesWithoutCost("MANAGER", s)).toBe(false);
  });
  it("сделка администратора всегда закрыта", () => {
    expect(dealClosesWithoutCost("ADMIN", "TOUR")).toBe(true);
  });
});

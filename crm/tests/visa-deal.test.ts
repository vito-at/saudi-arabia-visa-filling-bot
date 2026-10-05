import { describe, expect, it } from "vitest";
import { composeProduct, dealClosesWithoutCost, joinDetails, splitProduct, visaLeadPatch } from "@/lib/deals";

describe("сделка без ожидания себестоимости", () => {
  it("визовая поддержка закрывается сразу", () => {
    expect(dealClosesWithoutCost("VISA")).toBe(true);
  });
  it("остальные услуги ждут себестоимость от администратора — кто бы ни закрыл сделку", () => {
    for (const s of ["FLIGHTS", "TOUR", "OTHER", null] as const) expect(dealClosesWithoutCost(s)).toBe(false);
  });
});

describe("продукт сделки из списка", () => {
  const labels = { FLIGHTS: "Авиабилеты", TOUR: "Тур", VISA: "Визовая поддержка", OTHER: "Другое" } as const;
  it("собирает название из типа услуги и подробностей", () => {
    expect(composeProduct("Тур", " Дубай, 7 ночей ")).toBe("Тур: Дубай, 7 ночей");
    expect(composeProduct("Визовая поддержка", "")).toBe("Визовая поддержка");
  });
  it("разбирает название обратно, старое произвольное — в подробности", () => {
    expect(splitProduct("Тур: Дубай, 7 ночей", labels)).toEqual({ service: "TOUR", details: "Дубай, 7 ночей" });
    expect(splitProduct("Визовая поддержка", labels)).toEqual({ service: "VISA", details: "" });
    expect(splitProduct("Тур в Стамбул", labels)).toEqual({ service: "", details: "Тур в Стамбул" });
  });
});

describe("сделка из данных лида", () => {
  it("подробности склеиваются без пустых частей", () => {
    expect(joinDetails(["Дубай", "", null, "10.10.2026 — 17.10.2026", "2 чел."])).toBe("Дубай, 10.10.2026 — 17.10.2026, 2 чел.");
    expect(joinDetails([null, false, " "])).toBe("");
  });
  it("в лид записываются только незаполненные визовые поля", () => {
    expect(visaLeadPatch({ destination: null, visaApplications: null }, { destination: "Таиланд", visaApplications: 3 })).toEqual({ destination: "Таиланд", visaApplications: 3 });
    expect(visaLeadPatch({ destination: "Вьетнам", visaApplications: 2 }, { destination: "Таиланд", visaApplications: 3 })).toEqual({});
    expect(visaLeadPatch({ destination: null, visaApplications: null }, { destination: " ", visaApplications: 0 })).toEqual({});
  });
});

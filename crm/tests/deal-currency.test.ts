import { describe, expect, it } from "vitest";
import { autoVisaCostUsd, currencyMismatch } from "@/lib/deals";

describe("проверка валюты суммы сделки", () => {
  it("сумы, сохранённые как доллары, не пропускаются", () => {
    // 2 500 000 сум (≈ 200 $) с валютой «$» превращались в 2,5 млн долларов в продажах и зарплате
    expect(currencyMismatch(2_500_000, "USD")).toBe("usd");
    expect(currencyMismatch(100_000, "USD")).toBe("usd");
  });
  it("доллары, сохранённые как сумы, не пропускаются", () => {
    expect(currencyMismatch(250, "UZS")).toBe("uzs");
    expect(currencyMismatch(9_999, "UZS")).toBe("uzs");
  });
  it("обычные суммы в своей валюте проходят", () => {
    expect(currencyMismatch(250, "USD")).toBeNull();
    expect(currencyMismatch(45_000, "USD")).toBeNull();
    expect(currencyMismatch(10_000, "UZS")).toBeNull();
    expect(currencyMismatch(2_500_000, "UZS")).toBeNull();
  });
  it("пустая и нулевая сумма не проверяется (себестоимость 0 — норма)", () => {
    expect(currencyMismatch(0, "UZS")).toBeNull();
    expect(currencyMismatch(0, "USD")).toBeNull();
    expect(currencyMismatch(Number.NaN, "USD")).toBeNull();
  });
});

describe("себестоимость визы в Таиланд", () => {
  it("цена визы × число заявлений", () => {
    expect(autoVisaCostUsd("Таиланд", 1, 48)).toBe(48);
    expect(autoVisaCostUsd("Таиланд", 3, 48)).toBe(144);
    expect(autoVisaCostUsd("тайланд", 2, 48)).toBe(96);
    expect(autoVisaCostUsd("Thailand", 1, 48)).toBe(48);
    expect(autoVisaCostUsd("Таиланд, 2 заявл.", 2, 48)).toBe(96);
  });
  it("другие страны и выключенная настройка — без себестоимости", () => {
    expect(autoVisaCostUsd("Вьетнам", 1, 48)).toBeNull();
    expect(autoVisaCostUsd(null, 1, 48)).toBeNull();
    expect(autoVisaCostUsd("Таиланд", 1, 0)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { matchVisaCountry } from "@/lib/constants";

describe("страна визы", () => {
  it("узнаёт страну по разным написаниям", () => {
    expect(matchVisaCountry("Тайланд")).toBe("Таиланд");
    expect(matchVisaCountry(" thailand ")).toBe("Таиланд");
    expect(matchVisaCountry("Саудовская Аравия")).toBe("Саудовская Аравия");
    expect(matchVisaCountry("Киргизия")).toBe("Кыргызстан");
  });
  it("неизвестная страна — «Другое»", () => {
    expect(matchVisaCountry("Индия")).toBeNull();
    expect(matchVisaCountry("")).toBeNull();
    expect(matchVisaCountry(null)).toBeNull();
  });
});

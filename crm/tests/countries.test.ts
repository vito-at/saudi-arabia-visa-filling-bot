import { describe, expect, it } from "vitest";
import { canEditCountries, documentLines, normalizeUrl, parseCountry, type CountryInput } from "@/lib/countries";

const empty: CountryInput = { name: "", visaKind: "", documents: "", consularFee: "", salePrice: "", saleCurrency: "USD", processingTime: "", validity: "", whereToApply: "", applyUrl: "", appointmentUrl: "", visaCenter: "", notes: "" };

describe("справочник стран", () => {
  it("адрес сайта без https дополняется, не сайт — ошибка", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("vfsglobal.com/uzbekistan")).toBe("https://vfsglobal.com/uzbekistan");
    expect(normalizeUrl("https://thaievisa.go.th")).toBe("https://thaievisa.go.th/");
    expect(normalizeUrl("javascript:alert(1)")).toBe("invalid");
    expect(normalizeUrl("просто текст")).toBe("invalid");
  });

  it("форма: название обязательно, цена — число, пустые строки документов убираются", () => {
    expect(parseCountry(empty)).toEqual({ error: "err.countryName" });
    expect(parseCountry({ ...empty, name: "Таиланд", salePrice: "сто" })).toEqual({ error: "err.countryPrice" });
    expect(parseCountry({ ...empty, name: "Таиланд", applyUrl: "не сайт" })).toEqual({ error: "err.countryUrl" });
    const r = parseCountry({ ...empty, name: "  Шенген   (Италия) ", visaKind: "STICKER", salePrice: "1 200", documents: "Паспорт\n\n  Фото  \n", saleCurrency: "UZS" });
    expect("data" in r && r.data).toMatchObject({ name: "Шенген (Италия)", visaKind: "STICKER", salePrice: 1200, saleCurrency: "UZS", documents: "Паспорт\nФото", consularFee: null });
    expect("data" in r && r.data.visaKind).toBe("STICKER");
    expect(parseCountry({ ...empty, name: "X", visaKind: "WRONG" })).toMatchObject({ data: { visaKind: null } });
  });

  it("документы списком без своих номеров и маркеров", () => {
    expect(documentLines("1. Паспорт\n2) Фото\n- Справка\n• Выписка\n\nБилеты")).toEqual(["Паспорт", "Фото", "Справка", "Выписка", "Билеты"]);
  });

  it("править могут администратор и визовые специалисты", () => {
    expect(canEditCountries("ADMIN")).toBe(true);
    expect(canEditCountries("VISA")).toBe(true);
    expect(canEditCountries("MANAGER")).toBe(false);
  });
});

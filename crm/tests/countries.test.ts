import { describe, expect, it } from "vitest";
import { canEditCountries, documentLines, normalizeUrl, parseCountry, sourceLines, type CountryInput } from "@/lib/countries";
import { CITIZENSHIPS, WORLD, flag, worldCountry } from "@/lib/world";

const empty: CountryInput = { citizenship: "UZ", code: "", sources: "", name: "", visaKind: "", documents: "", consularFee: "", salePrice: "", saleCurrency: "USD", processingTime: "", validity: "", whereToApply: "", applyUrl: "", appointmentUrl: "", visaCenter: "", notes: "" };

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

  it("страна из списка: название и часть света — из списка; своё направление — по названию; гражданство из списка", () => {
    expect(parseCountry({ ...empty, code: "th", name: "что угодно" })).toMatchObject({ data: { code: "TH", name: "Таиланд", region: "ASIA", citizenship: "UZ" } });
    expect(parseCountry({ ...empty, code: "", name: "Шенген" })).toMatchObject({ data: { code: null, name: "Шенген", region: null } });
    expect(parseCountry({ ...empty, citizenship: "RU", name: "X" })).toEqual({ error: "err.countryCitizenship" });
    expect(parseCountry({ ...empty, citizenship: "TJ", code: "AE" })).toMatchObject({ data: { citizenship: "TJ", code: "AE", name: "ОАЭ" } });
  });

  it("источники — только ссылки, без повторов", () => {
    expect(sourceLines("thaievisa.go.th\nне ссылка\nhttps://thaievisa.go.th/\n\nhttps://www.mfa.go.th")).toEqual(["https://thaievisa.go.th/", "https://www.mfa.go.th/"]);
  });

  it("список стран мира: коды уникальны, без кириллицы в узбекском и английском, гражданства есть в списке", () => {
    const codes = WORLD.map((w) => w.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    for (const w of WORLD) expect(/[А-Яа-яЁё]/.test(w.uz + w.en), w.code).toBe(false);
    for (const c of CITIZENSHIPS) expect(worldCountry(c)).not.toBeNull();
    expect(WORLD.length).toBeGreaterThan(190);
    expect(flag("UZ")).toBe("🇺🇿");
  });
});

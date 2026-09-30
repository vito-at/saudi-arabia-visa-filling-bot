import { describe, expect, it } from "vitest";
import { normalizePhone, prettyPhone, telegramLink, whatsappLink } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["+998 (90) 123-45-67", "+998901234567"],
    ["998901234567", "+998901234567"],
    ["+998901234567", "+998901234567"],
    ["90 123 45 67", "+998901234567"],
    ["901234567", "+998901234567"],
    ["8 90 123 45 67", "+998901234567"],
    ["00998 93 555 44 33", "+998935554433"],
    ["  +998-33-777-88-99 ", "+998337778899"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([[""], [null], [undefined], ["12345"], ["+7 912 345 67 89"], ["abc"]])("невалидный %s → null", (input) => {
    expect(normalizePhone(input as string)).toBeNull();
  });
});

describe("ссылки на мессенджеры", () => {
  it("формирует ссылки WhatsApp и Telegram", () => {
    expect(whatsappLink("+998901234567")).toBe("https://wa.me/998901234567");
    expect(telegramLink("+998901234567")).toBe("https://t.me/+998901234567");
    expect(whatsappLink(null)).toBeNull();
  });
  it("красиво форматирует номер", () => {
    expect(prettyPhone("+998901234567")).toBe("+998 90 123 45 67");
  });
});

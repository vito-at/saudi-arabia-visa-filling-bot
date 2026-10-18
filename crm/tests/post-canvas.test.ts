import { describe, expect, it } from "vitest";
import { wrapText } from "@/lib/post-canvas";

// ширина = число символов
const m = (s: string) => s.length;

describe("wrapText", () => {
  it("переносит по словам и сохраняет явные переносы", () => {
    expect(wrapText(m, "Турция Анталья всё включено", 14)).toEqual(["Турция Анталья", "всё включено"]);
    expect(wrapText(m, "Отель 5★\n\nВылет 5 ноября", 40)).toEqual(["Отель 5★", "Вылет 5 ноября"]);
  });
  it("обрезает лишние строки многоточием", () => {
    expect(wrapText(m, "один два три четыре пять", 9, 2)).toEqual(["один два", "три…"]);
  });
  it("длинное слово остаётся одной строкой", () => {
    expect(wrapText(m, "Суперотельпремиум", 5)).toEqual(["Суперотельпремиум"]);
  });
});

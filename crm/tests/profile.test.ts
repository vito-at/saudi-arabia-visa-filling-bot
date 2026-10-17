import { describe, expect, it } from "vitest";
import { mergeProfile, ProfileError, profileFilled, readProfile, type ProfileQuestionView } from "@/lib/leads/profile";

const Q: ProfileQuestionView[] = [
  { id: "with", label: "С кем едет?", type: "SELECT", options: ["Один", "Пара"], role: null },
  { id: "adults", label: "Взрослых", type: "NUMBER", options: [], role: null },
  { id: "dep", label: "Вылет", type: "DATE", options: [], role: "DEPART_DATE" },
  { id: "ret", label: "Возвращение", type: "DATE", options: [], role: "RETURN_DATE" },
  { id: "budget", label: "Бюджет", type: "TEXT", options: [], role: null },
];

describe("анкета клиента", () => {
  it("сливает ответы, пустое стирает, скрытые вопросы не трогает", () => {
    const r = mergeProfile(Q, { budget: "1000$", old: "ответ на удалённый вопрос" }, { with: "Пара", adults: "2", budget: "", ret: "2026-11-01" });
    expect(r.answers).toEqual({ with: "Пара", adults: "2", ret: "2026-11-01", old: "ответ на удалённый вопрос" });
    expect(r.changed).toEqual(["С кем едет?", "Взрослых", "Возвращение", "Бюджет"]);
    expect(r.travelTo?.toISOString()).toBe("2026-10-31T19:00:00.000Z");
    expect(r.travelFrom).toBeUndefined();
  });
  it("проверяет типы", () => {
    expect(() => mergeProfile(Q, {}, { adults: "два" })).toThrow(ProfileError);
    expect(() => mergeProfile(Q, {}, { dep: "01.11.2026" })).toThrow(ProfileError);
    expect(() => mergeProfile(Q, {}, { with: "Компания" })).toThrow(ProfileError);
  });
  it("стёртая дата возвращения — null", () => {
    expect(mergeProfile(Q, { ret: "2026-11-01" }, { ret: "" }).travelTo).toBeNull();
  });
  it("чтение JSON и счётчик заполненных", () => {
    expect(readProfile({ a: " x ", b: "", c: 5 })).toEqual({ a: "x" });
    expect(readProfile(null)).toEqual({});
    expect(profileFilled(Q, { with: "Один", budget: "1" })).toBe(2);
  });
});

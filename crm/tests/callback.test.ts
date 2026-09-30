import { describe, expect, it } from "vitest";
import { callbackLabel, callbackState } from "@/lib/callback";
import { isRateStale, todayRateTime } from "@/lib/rates";
import { createT } from "@/i18n/core";
import { MESSAGES } from "@/i18n/messages";

const tRu = createT(MESSAGES.ru);
const tUz = createT(MESSAGES.uz);
const tEn = createT(MESSAGES.en);

describe("напоминание о повторном звонке", () => {
  const at = new Date("2026-10-01T15:30:00+05:00");
  const min = (m: number) => at.getTime() - m * 60_000;

  it("за 10 минут и раньше — не напоминаем", () => {
    expect(callbackState(at, min(11)).remind).toBe(false);
    expect(callbackState(at, min(10.5)).remind).toBe(false);
  });
  it("за 10 минут начинается обратный отсчёт в минутах (с округлением вверх)", () => {
    expect(callbackState(at, min(10))).toEqual({ remind: true, due: false, minutesLeft: 10 });
    expect(callbackState(at, min(7.2))).toEqual({ remind: true, due: false, minutesLeft: 8 });
    expect(callbackState(at, min(0.3))).toEqual({ remind: true, due: false, minutesLeft: 1 });
    expect(callbackLabel(callbackState(at, min(3)), tRu)).toBe("через 3 мин");
    expect(callbackLabel(callbackState(at, min(3)), tEn)).toBe("in 3 min");
    expect(callbackLabel(callbackState(at, min(3)), tUz)).toBe("3 daqiqadan so‘ng");
  });
  it("время наступило — «Пора позвонить», без пометки о просрочке", () => {
    expect(callbackState(at, min(0))).toEqual({ remind: true, due: true, minutesLeft: 0 });
    expect(callbackState(at, min(-45))).toEqual({ remind: true, due: true, minutesLeft: 0 });
    expect(callbackLabel(callbackState(at, min(-45)), tRu)).toBe("Пора позвонить");
    expect(callbackLabel(callbackState(at, min(-45)), tEn)).toBe("Time to call");
  });
});

describe("ежедневное обновление курса в 07:00 по Ташкенту", () => {
  it("07:00 по Ташкенту = 02:00 UTC", () => {
    expect(todayRateTime(new Date("2026-10-01T10:00:00+05:00")).toISOString()).toBe("2026-10-01T02:00:00.000Z");
  });
  it("до 07:00 сравниваем со вчерашними 07:00", () => {
    const night = new Date("2026-10-01T01:15:00+05:00");
    expect(isRateStale(new Date("2026-09-30T07:00:10+05:00"), night)).toBe(false); // вчера обновился
    expect(isRateStale(new Date("2026-09-29T07:00:10+05:00"), night)).toBe(true); // вчера не обновился — уведомление и ночью
  });
  it("после 07:00 без обновления за сегодня — устарел, после обновления — нет", () => {
    const now = new Date("2026-10-01T08:30:00+05:00");
    expect(isRateStale(new Date("2026-09-30T07:00:00+05:00"), now)).toBe(true);
    expect(isRateStale(null, now)).toBe(true);
    expect(isRateStale(new Date("2026-10-01T07:00:05+05:00"), now)).toBe(false);
  });
});

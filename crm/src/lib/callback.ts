import { CALLBACK_REMIND_MIN } from "./constants";
import type { TFunction } from "@/i18n/core";

export interface CallbackState {
  /** пора показывать напоминание (за 10 минут и позже) */
  remind: boolean;
  /** время звонка наступило */
  due: boolean;
  /** сколько целых минут осталось (округление вверх, 0 — время наступило) */
  minutesLeft: number;
}

/** Состояние напоминания о повторном звонке на момент now */
export function callbackState(callbackAt: Date | string | number, now: number = Date.now(), remindMin = CALLBACK_REMIND_MIN): CallbackState {
  const at = new Date(callbackAt).getTime();
  const diff = at - now;
  const due = diff <= 0;
  return { remind: diff <= remindMin * 60_000, due, minutesLeft: due ? 0 : Math.ceil(diff / 60_000) };
}

/** Подпись для отсчёта: «через 7 мин» / «Пора позвонить» */
export function callbackLabel(s: CallbackState, t: TFunction): string {
  return s.due ? t("callback.due") : t("callback.in", { n: s.minutesLeft });
}

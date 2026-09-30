import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { i18nFor } from "./instance";

/** Язык текущего пользователя (cookie), по умолчанию — русский */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const v = (await cookies()).get(LOCALE_COOKIE)?.value;
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    // вне запроса (воркер, тесты) — язык по умолчанию
    return DEFAULT_LOCALE;
  }
});

export { i18nFor };

/** Переводы и форматирование для серверных компонентов и server actions */
export const getI18n = cache(async () => i18nFor(await getLocale()));

import { AccessError } from "./session";
import { ValidationError } from "./leads/service";
import { getI18n } from "@/i18n/server";
import type { TKey } from "@/i18n/core";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Обёртка для server actions: ожидаемые ошибки превращаются в сообщение для пользователя. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof AccessError) {
      const { t } = await getI18n();
      // ключ перевода → текст на языке пользователя; обычный текст (например, ошибка Meta) остаётся как есть
      return { ok: false, error: t(e.message as TKey, e instanceof ValidationError ? e.vars : undefined) };
    }
    // redirect()/notFound() должны пробрасываться дальше
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, error: (await getI18n()).t("common.errorGeneric") };
  }
}

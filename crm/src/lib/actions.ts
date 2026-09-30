import { AccessError } from "./session";
import { ValidationError } from "./leads/service";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Обёртка для server actions: ожидаемые ошибки превращаются в сообщение для пользователя. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof AccessError) return { ok: false, error: e.message };
    // redirect()/notFound() должны пробрасываться дальше
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, error: "Произошла ошибка. Попробуйте ещё раз." };
  }
}

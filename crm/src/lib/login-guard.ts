/**
 * Защита входа от подбора пароля: после 5 неудачных попыток для пары «логин + IP» вход закрыт на 15 минут.
 * Пара, а не только логин — иначе кто угодно мог бы запереть администратору вход, вводя неверный пароль.
 * Хранится в памяти процесса (приложение — один процесс); после перезапуска счётчики обнуляются.
 */
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000;
const fails = new Map<string, { count: number; first: number }>();

const keyOf = (login: string, ip: string) => `${login.trim().toLowerCase()}|${ip}`;

/** Вход для этой пары сейчас закрыт */
export function loginBlocked(login: string, ip: string, now = Date.now()): boolean {
  const f = fails.get(keyOf(login, ip));
  if (!f) return false;
  if (now - f.first > WINDOW_MS) {
    fails.delete(keyOf(login, ip));
    return false;
  }
  return f.count >= MAX_FAILS;
}

export function loginFailed(login: string, ip: string, now = Date.now()) {
  const key = keyOf(login, ip);
  const f = fails.get(key);
  if (!f || now - f.first > WINDOW_MS) fails.set(key, { count: 1, first: now });
  else f.count++;
  if (fails.size > 10_000) fails.delete(fails.keys().next().value as string);
}

export function loginSucceeded(login: string, ip: string) {
  fails.delete(keyOf(login, ip));
}

/** IP клиента за прокси Caddy */
export function clientIp(headers: Headers | undefined): string {
  return headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || headers?.get("x-real-ip") || "unknown";
}

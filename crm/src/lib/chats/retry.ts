/**
 * Повтор доставки вебхука при сбое. Telegram и Meta присылают сообщение ещё раз, только если мы ответили ошибкой.
 * Сбой посреди записи (обрыв или таймаут базы) — отвечаем 500, и сообщение придёт снова (дубли отсекаются по id).
 * Сообщение, которое падает всегда, после нескольких попыток принимаем (200), чтобы не застопорить очередь доставки.
 */
const MAX_RETRIES = 3;
const failures = new Map<string, number>();

/** true — ответить ошибкой, чтобы мессенджер повторил доставку */
export function retryDelivery(key: string): boolean {
  const n = (failures.get(key) ?? 0) + 1;
  failures.set(key, n);
  if (failures.size > 1000) failures.delete(failures.keys().next().value as string);
  return n <= MAX_RETRIES;
}

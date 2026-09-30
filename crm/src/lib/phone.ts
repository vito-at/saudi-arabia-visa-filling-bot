/**
 * Нормализация телефонов к формату +998XXXXXXXXX.
 * Принимает любые варианты записи: «+998 (90) 123-45-67», «998901234567», «90 123 45 67», «8 90 1234567».
 * Возвращает null, если номер не похож на узбекский (иностранные номера сохраняем как есть в phoneRaw).
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, "");
  if (!digits) return null;

  // 00998... — международный префикс
  if (digits.startsWith("00998")) digits = digits.slice(2);
  // 8 (9x) ... — старый формат с «восьмёркой»
  if (digits.length === 10 && digits.startsWith("8")) digits = digits.slice(1);

  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return null;
}

/** Номер для отображения: +998 90 123 45 67 */
export function prettyPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const m = phone.match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

/** Номер в международном формате для ссылок: wa.me, tel: */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function whatsappLink(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone);
  return d ? `https://wa.me/${d}` : null;
}

/** Telegram открывает чат по номеру через t.me/+<номер> (если пользователь разрешил поиск по номеру) */
export function telegramLink(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone);
  return d ? `https://t.me/+${d}` : null;
}

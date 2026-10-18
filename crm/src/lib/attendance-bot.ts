/**
 * Посещаемость в Telegram-боте CRM. Сотрудник привязывает Telegram по ссылке из раздела «Посещаемость»
 * (/start att_<код>), дальше одна кнопка: «Пришёл» утром, «Ушёл» вечером. Сообщения сотрудников
 * в переписки с клиентами не попадают. Вечером администраторам приходит итог дня.
 */
import { prisma } from "@/lib/db";
import { formatMoney, formatTime, toInputDate } from "@/lib/format";
import { toNum } from "@/lib/money";
import { getSettings } from "@/lib/refs";
import { scheduleOf } from "@/lib/work-hours";
import { getTelegram, telegramBot, type TelegramBot, type TgMessage } from "@/lib/chats/telegram";
import { dayKey, distanceM, isoWeekday, lateMinutes, tashkentMinutes } from "./attendance";

export const BTN_IN = "✅ Пришёл / Keldim";
export const BTN_OUT = "🏁 Ушёл / Ketdim";

type Next = "in" | "out";

function keyboard(next: Next, geo: boolean) {
  return { keyboard: [[{ text: next === "in" ? BTN_IN : BTN_OUT, ...(geo ? { request_location: true } : {}) }]], resize_keyboard: true, is_persistent: true };
}

const duration = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return `${Math.floor(m / 60)} ч ${m % 60} мин`;
};

/** Привязка по коду из CRM. Код одноразовый и живёт сутки. */
async function link(msg: TgMessage, code: string, bot: TelegramBot, now: Date) {
  const tgId = String(msg.from!.id);
  const user = await prisma.user.findFirst({ where: { telegramLinkCode: code, telegramLinkUntil: { gt: now }, isActive: true } });
  if (!user) {
    await bot.call("sendMessage", { chat_id: msg.chat.id, text: "Ссылка недействительна или устарела. Откройте CRM → «Посещаемость» и получите новую." });
    return;
  }
  const name = [msg.from!.first_name, msg.from!.last_name].filter(Boolean).join(" ") || (msg.from!.username ? `@${msg.from!.username}` : null);
  await prisma.$transaction([
    prisma.user.updateMany({ where: { telegramId: tgId, id: { not: user.id } }, data: { telegramId: null, telegramName: null } }),
    prisma.user.update({ where: { id: user.id }, data: { telegramId: tgId, telegramName: name, telegramLinkCode: null, telegramLinkUntil: null } }),
  ]);
  const settings = await getSettings();
  const mark = await prisma.attendance.findUnique({ where: { userId_day: { userId: user.id, day: dayKey(now) } } });
  await bot.call("sendMessage", {
    chat_id: msg.chat.id,
    text: `${user.name}, Telegram привязан к CRM.\nОтмечайте приход и уход кнопкой внизу${settings.attendanceGeo ? " — бот попросит геолокацию, отметка возможна только в офисе" : ""}.`,
    reply_markup: keyboard(mark?.checkInAt && !mark.checkOutAt ? "out" : "in", settings.attendanceGeo),
  });
}

/**
 * Сообщение боту от сотрудника (или команда привязки). true — сообщение обработано здесь
 * и в переписки с клиентами его записывать не нужно.
 */
export async function handleStaffMessage(msg: TgMessage, bot: TelegramBot | null, now = new Date()): Promise<boolean> {
  if (msg.chat.type !== "private" || !msg.from || !bot) return false;
  const text = (msg.text ?? "").trim();
  const start = /^\/start\s+att_([\w-]{6,40})$/.exec(text);
  if (start) {
    await link(msg, start[1], bot, now);
    return true;
  }
  const user = await prisma.user.findFirst({ where: { telegramId: String(msg.from.id), isActive: true } });
  if (!user) return false;

  const reply = (t: string, next?: Next, geo = false) => bot.call("sendMessage", { chat_id: msg.chat.id, text: t, ...(next ? { reply_markup: keyboard(next, geo) } : {}) });
  const settings = await getSettings();
  if (!settings.attendanceEnabled) {
    await reply("Учёт посещаемости сейчас выключен администратором.");
    return true;
  }
  const geo = settings.attendanceGeo;
  const day = dayKey(now);
  const mark = await prisma.attendance.findUnique({ where: { userId_day: { userId: user.id, day } } });
  const next: Next = mark?.checkInAt && !mark.checkOutAt ? "out" : "in";

  let action: Next | null = null;
  if (text === BTN_IN || text === "/in") action = "in";
  else if (text === BTN_OUT || text === "/out") action = "out";
  else if (msg.location) action = next === "in" && mark?.checkOutAt ? "out" : next;

  if (!action) {
    const status = !mark?.checkInAt
      ? "Сегодня приход ещё не отмечен."
      : `Сегодня: приход ${formatTime(mark.checkInAt)}${mark.checkOutAt ? `, уход ${formatTime(mark.checkOutAt)}` : ""}.`;
    await reply(status, next, geo);
    return true;
  }

  let lat: number | null = null;
  let lng: number | null = null;
  if (geo) {
    if (!msg.location) {
      await reply("Отправьте геолокацию кнопкой ниже — без неё отметка не засчитывается.", action, true);
      return true;
    }
    if (msg.forward_origin || msg.forward_date) {
      await reply("Пересланная геолокация не подходит — нажмите кнопку ниже.", action, true);
      return true;
    }
    if (settings.officeLat === null || settings.officeLng === null) {
      await reply("Администратор ещё не указал координаты офиса. Отметка пока невозможна.");
      return true;
    }
    const dist = distanceM({ lat: msg.location.latitude, lng: msg.location.longitude }, { lat: settings.officeLat, lng: settings.officeLng });
    if (dist > settings.officeRadiusM) {
      await reply(`Вы в ${dist} м от офиса. Отметиться можно в радиусе ${settings.officeRadiusM} м.`, action, true);
      return true;
    }
    lat = msg.location.latitude;
    lng = msg.location.longitude;
  }

  if (action === "in") {
    if (mark?.checkInAt) {
      await reply(`Приход сегодня уже отмечен в ${formatTime(mark.checkInAt)}.`, next, geo);
      return true;
    }
    const late = lateMinutes(now, scheduleOf(settings), settings.attendanceGraceMin);
    const fine = late > 0 ? toNum(settings.lateFine) : 0;
    await prisma.attendance.upsert({
      where: { userId_day: { userId: user.id, day } },
      create: { userId: user.id, day, checkInAt: now, lateMin: late, fine, inLat: lat, inLng: lng },
      update: { checkInAt: now, lateMin: late, fine, inLat: lat, inLng: lng },
    });
    const t = late > 0 ? `Приход отмечен: ${formatTime(now)}. Опоздание ${late} мин.${fine > 0 ? ` Штраф: ${formatMoney(fine, "UZS")}.` : ""}` : `Приход отмечен: ${formatTime(now)}. Хорошего дня!`;
    await reply(t, "out", geo);
    return true;
  }

  if (!mark?.checkInAt) {
    await reply("Сначала отметьте приход.", "in", geo);
    return true;
  }
  await prisma.attendance.update({ where: { id: mark.id }, data: { checkOutAt: now, outLat: lat, outLng: lng } });
  await reply(`${mark.checkOutAt ? "Уход обновлён" : "Уход отмечен"}: ${formatTime(now)}. Отработано ${duration(now.getTime() - mark.checkInAt.getTime())}. До завтра!`, "in", geo);
  return true;
}

/** Итог дня администраторам в Telegram: через 30 минут после конца рабочего дня, один раз в день */
export async function attendanceDailyReport(now = new Date()): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.attendanceEnabled) return false;
  const s = scheduleOf(settings);
  const today = toInputDate(now);
  if (!s.days.includes(isoWeekday(today)) || tashkentMinutes(now) < s.endMin + 30) return false;
  const bot = telegramBot(await getTelegram());
  if (!bot) return false;
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true, telegramId: { not: null } }, select: { telegramId: true } });
  if (!admins.length) return false;
  const day = dayKey(now);
  // атомарно «забираем» день, чтобы два воркера не отправили итог дважды
  const claimed = await prisma.appSettings.updateMany({ where: { id: 1, OR: [{ attendanceReportDay: null }, { attendanceReportDay: { not: day } }] }, data: { attendanceReportDay: day } });
  if (!claimed.count) return false;

  const staff = await prisma.user.findMany({
    // администраторы попадают в итог, только если сами отмечаются
    where: { isActive: true, OR: [{ role: "MANAGER" }, { attendance: { some: { day } } }] },
    orderBy: { name: "asc" },
    include: { attendance: { where: { day } } },
  });
  const lines = staff.map((u) => {
    const m = u.attendance[0];
    if (!m?.checkInAt) return `❌ ${u.name} — не отметился`;
    const range = `${formatTime(m.checkInAt)}–${m.checkOutAt ? formatTime(m.checkOutAt) : "?"}`;
    if (m.lateMin > 0) return `⏰ ${u.name} — ${range}, опоздание ${m.lateMin} мин${toNum(m.fine) > 0 ? `, штраф ${formatMoney(toNum(m.fine), "UZS")}` : ""}`;
    return `✅ ${u.name} — ${range}`;
  });
  const text = `Посещаемость за ${today.split("-").reverse().join(".")}\n\n${lines.join("\n") || "Сотрудников нет"}`;
  for (const a of admins) {
    try {
      await bot.call("sendMessage", { chat_id: a.telegramId, text });
    } catch (e) {
      console.error("attendance report:", e);
    }
  }
  return true;
}

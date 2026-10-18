"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { AccessError, requireAdmin, requireUser } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { getTelegram } from "@/lib/chats/telegram";
import { lateMinutes } from "@/lib/attendance";
import { getSettings } from "@/lib/refs";
import { scheduleOf, timeToMin } from "@/lib/work-hours";

/** Ссылка для привязки Telegram сотрудника к CRM: t.me/<бот>?start=att_<код>, действует сутки */
export async function telegramLinkAction() {
  return runAction(async () => {
    const user = await requireUser();
    const tg = await getTelegram();
    if (!tg.enabled || !tg.botUsername) throw new ValidationError("err.attNoBot");
    const code = crypto.randomBytes(12).toString("base64url");
    await prisma.user.update({ where: { id: user.id }, data: { telegramLinkCode: code, telegramLinkUntil: new Date(Date.now() + 86_400_000) } });
    return `https://t.me/${tg.botUsername}?start=att_${code}`;
  });
}

/** Отвязать Telegram: сотрудник — свой, администратор — любой */
export async function unlinkTelegramAction(userId: string) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== "ADMIN" && user.id !== userId) throw new AccessError();
    await prisma.user.update({ where: { id: userId }, data: { telegramId: null, telegramName: null, telegramLinkCode: null, telegramLinkUntil: null } });
    revalidatePath("/attendance");
  });
}

export interface AttendanceSettingsInput {
  enabled: boolean;
  graceMin: string;
  lateFine: string;
  geo: boolean;
  officeLat: string;
  officeLng: string;
  radiusM: string;
}

const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));

export async function saveAttendanceSettingsAction(i: AttendanceSettingsInput) {
  return runAction(async () => {
    await requireAdmin();
    const grace = num(i.graceMin);
    if (!Number.isInteger(grace) || grace < 0 || grace > 240) throw new ValidationError("err.attGrace");
    const fine = i.lateFine.trim() ? num(i.lateFine) : 0;
    if (!Number.isFinite(fine) || fine < 0 || fine > 1e10) throw new ValidationError("err.attFine");
    const lat = i.officeLat.trim() ? num(i.officeLat) : null;
    const lng = i.officeLng.trim() ? num(i.officeLng) : null;
    if ((lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) || (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))) throw new ValidationError("err.attCoords");
    if (i.geo && (lat === null || lng === null)) throw new ValidationError("err.attCoords");
    const radius = num(i.radiusM);
    if (!Number.isInteger(radius) || radius < 20 || radius > 50_000) throw new ValidationError("err.attRadius");
    await prisma.appSettings.update({
      where: { id: 1 },
      data: { attendanceEnabled: i.enabled, attendanceGraceMin: grace, lateFine: fine, attendanceGeo: i.geo, officeLat: lat, officeLng: lng, officeRadiusM: radius },
    });
    revalidatePath("/attendance");
  });
}

export interface MarkInput {
  userId: string;
  day: string;
  checkIn: string;
  checkOut: string;
  fine: string;
  note: string;
}

/** Исправление отметки администратором (забыл отметиться, отпуск, отмена штрафа) */
export async function saveMarkAction(i: MarkInput) {
  return runAction(async () => {
    const admin = await requireAdmin();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.day)) throw new ValidationError("err.attTime");
    const at = (v: string) => {
      if (!v.trim()) return null;
      const m = timeToMin(v);
      if (m === null || m >= 1440) throw new ValidationError("err.attTime");
      return new Date(`${i.day}T${v.trim().padStart(5, "0")}:00+05:00`);
    };
    const checkInAt = at(i.checkIn);
    const checkOutAt = at(i.checkOut);
    if (checkOutAt && (!checkInAt || checkOutAt <= checkInAt)) throw new ValidationError("err.attTime");
    const fine = i.fine.trim() ? num(i.fine) : 0;
    if (!Number.isFinite(fine) || fine < 0) throw new ValidationError("err.attFine");
    const day = new Date(`${i.day}T00:00:00Z`);
    const settings = await getSettings();
    const lateMin = checkInAt ? lateMinutes(checkInAt, scheduleOf(settings), settings.attendanceGraceMin) : 0;
    const data = { checkInAt, checkOutAt, lateMin, fine, note: i.note.trim().slice(0, 300) || null, editedById: admin.id };
    if (!checkInAt && !checkOutAt && !data.note && !fine) {
      await prisma.attendance.deleteMany({ where: { userId: i.userId, day } });
    } else {
      await prisma.attendance.upsert({ where: { userId_day: { userId: i.userId, day } }, create: { userId: i.userId, day, ...data }, update: data });
    }
    revalidatePath("/attendance");
  });
}

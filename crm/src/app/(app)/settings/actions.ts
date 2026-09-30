"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role, StatusKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { formatNumber } from "@/lib/format";
import { updateUsdRate } from "@/lib/rates";
import { requireAdmin } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const revalidateAll = () => revalidatePath("/", "layout");

// ——— Общие настройки ———

export async function saveGeneralAction(formData: FormData) {
  return runAction(async () => {
    await requireAdmin();
    const mode = str(formData.get("distributionMode"));
    if (mode !== "MANUAL" && mode !== "ROUND_ROBIN") throw new ValidationError("Выберите режим распределения");
    const alert = Number(formData.get("unprocessedAlertMin"));
    if (!Number.isInteger(alert) || alert < 1 || alert > 10080) throw new ValidationError("Порог — от 1 минуты");
    await prisma.appSettings.update({ where: { id: 1 }, data: { distributionMode: mode, unprocessedAlertMin: alert } });
    revalidateAll();
    return "Сохранено";
  });
}

export async function saveRateAction(formData: FormData) {
  return runAction(async () => {
    await requireAdmin();
    const source = str(formData.get("usdRateSource"));
    const side = str(formData.get("usdRateSide"));
    if (source !== "MANUAL" && source !== "IPAK_YULI") throw new ValidationError("Выберите источник курса");
    if (side !== "BUY" && side !== "SELL") throw new ValidationError("Выберите курс покупки или продажи");
    const data: Parameters<typeof prisma.appSettings.update>[0]["data"] = { usdRateSource: source, usdRateSide: side };
    if (source === "MANUAL") {
      const rate = Number(str(formData.get("usdRate")).replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(rate) || rate < 1000 || rate > 100000) throw new ValidationError("Укажите курс USD→UZS, например 12 700");
      Object.assign(data, { usdRate: rate, usdRateUpdatedAt: new Date(), usdRateError: null });
    }
    await prisma.appSettings.update({ where: { id: 1 }, data });
    if (source === "IPAK_YULI") {
      const r = await updateUsdRate();
      revalidateAll();
      if (!r.ok) throw new ValidationError(`Настройки сохранены, но курс получить не удалось: ${"error" in r ? r.error : ""}. Используется последний известный курс.`);
      return `Курс Ипак Йули Банка: ${formatNumber("rate" in r ? r.rate : 0, 2)} сум`;
    }
    revalidateAll();
    return "Курс сохранён";
  });
}

export async function refreshRateAction() {
  return runAction(async () => {
    await requireAdmin();
    const r = await updateUsdRate({ force: true });
    revalidateAll();
    if (!r.ok) throw new ValidationError(`Не удалось получить курс: ${"error" in r ? r.error : ""}`);
    return `Курс обновлён: покупка ${formatNumber("buy" in r ? r.buy : 0, 2)}, продажа ${formatNumber("sell" in r ? r.sell : 0, 2)}`;
  });
}

// ——— Статусы ———

const COLOR = /^#[0-9a-f]{6}$/i;

export async function saveStatusAction(input: { id?: string; name: string; color: string; kind: StatusKind }) {
  return runAction(async () => {
    await requireAdmin();
    const name = input.name.trim();
    if (!name) throw new ValidationError("Название не может быть пустым");
    if (!COLOR.test(input.color)) throw new ValidationError("Цвет в формате #RRGGBB");
    if (input.id) {
      const cur = await prisma.leadStatus.findUniqueOrThrow({ where: { id: input.id } });
      // тип системных статусов менять нельзя — на нём держится логика
      await prisma.leadStatus.update({ where: { id: input.id }, data: { name, color: input.color, kind: cur.isSystem ? cur.kind : input.kind } });
    } else {
      if (["NEW", "WON", "LOST"].includes(input.kind)) throw new ValidationError("Статусы «Новый», «Продано» и «Отказ» уже есть — добавьте промежуточный статус");
      const last = await prisma.leadStatus.findFirst({ where: { kind: { notIn: ["WON", "LOST"] } }, orderBy: { order: "desc" } });
      const order = (last?.order ?? 0) + 1;
      // сдвигаем «Продано»/«Отказ» в конец
      await prisma.leadStatus.updateMany({ where: { order: { gte: order } }, data: { order: { increment: 1 } } });
      await prisma.leadStatus.create({ data: { name, color: input.color, kind: input.kind, order } });
    }
    revalidateAll();
  });
}

export async function moveStatusAction(id: string, dir: -1 | 1) {
  return runAction(async () => {
    await requireAdmin();
    const list = await prisma.leadStatus.findMany({ orderBy: { order: "asc" } });
    const i = list.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await prisma.$transaction(list.map((s, idx) => prisma.leadStatus.update({ where: { id: s.id }, data: { order: idx + 1 } })));
    revalidateAll();
  });
}

export async function deleteStatusAction(id: string, moveTo: string) {
  return runAction(async () => {
    await requireAdmin();
    const s = await prisma.leadStatus.findUniqueOrThrow({ where: { id } });
    if (s.isSystem) throw new ValidationError("Системный статус удалить нельзя");
    const count = await prisma.lead.count({ where: { statusId: id } });
    if (count > 0) {
      const target = await prisma.leadStatus.findUnique({ where: { id: moveTo } });
      if (!target || target.id === id || target.kind === "WON" || target.kind === "LOST") throw new ValidationError(`В статусе ${count} лидов — выберите, куда их перенести (кроме «Продано» и «Отказ»)`);
      await prisma.lead.updateMany({ where: { statusId: id }, data: { statusId: target.id } });
    }
    await prisma.leadHistory.updateMany({ where: { toStatusId: id }, data: { toStatusId: null } });
    await prisma.leadStatus.delete({ where: { id } });
    revalidateAll();
  });
}

// ——— Причины отказа ———

export async function saveReasonAction(input: { id?: string; name: string; isActive?: boolean }) {
  return runAction(async () => {
    await requireAdmin();
    const name = input.name.trim();
    if (!name) throw new ValidationError("Название не может быть пустым");
    if (input.id) await prisma.lossReason.update({ where: { id: input.id }, data: { name, isActive: input.isActive ?? true } });
    else {
      const last = await prisma.lossReason.findFirst({ orderBy: { order: "desc" } });
      await prisma.lossReason.create({ data: { name, order: (last?.order ?? 0) + 1 } });
    }
    revalidateAll();
  });
}

export async function moveReasonAction(id: string, dir: -1 | 1) {
  return runAction(async () => {
    await requireAdmin();
    const list = await prisma.lossReason.findMany({ orderBy: { order: "asc" } });
    const i = list.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await prisma.$transaction(list.map((s, idx) => prisma.lossReason.update({ where: { id: s.id }, data: { order: idx + 1 } })));
    revalidateAll();
  });
}

export async function deleteReasonAction(id: string) {
  return runAction(async () => {
    await requireAdmin();
    const used = await prisma.lead.count({ where: { lossReasonId: id } });
    // использованную причину не удаляем, чтобы не ломать отчёты, — только скрываем
    if (used) await prisma.lossReason.update({ where: { id }, data: { isActive: false } });
    else await prisma.lossReason.delete({ where: { id } });
    revalidateAll();
    return used ? `Причина используется в ${used} лидах — она скрыта из списка, но осталась в отчётах` : "Удалено";
  });
}

// ——— Пользователи ———

export async function saveUserAction(input: { id?: string; login: string; name: string; role: Role; password?: string; isActive: boolean }) {
  return runAction(async () => {
    const admin = await requireAdmin();
    const login = input.login.trim().toLowerCase();
    const name = input.name.trim();
    if (!/^[a-z0-9._-]{3,32}$/.test(login)) throw new ValidationError("Логин: 3–32 символа, латиница, цифры, . _ -");
    if (!name) throw new ValidationError("Укажите имя");
    if (input.role !== "ADMIN" && input.role !== "MANAGER") throw new ValidationError("Выберите роль");
    if (input.password && input.password.length < 8) throw new ValidationError("Пароль — минимум 8 символов");
    const dup = await prisma.user.findFirst({ where: { login, NOT: input.id ? { id: input.id } : undefined } });
    if (dup) throw new ValidationError("Такой логин уже занят");

    if (input.id) {
      if (input.id === admin.id && (input.role !== "ADMIN" || !input.isActive)) throw new ValidationError("Нельзя снять права администратора или заблокировать себя");
      await prisma.user.update({
        where: { id: input.id },
        data: { login, name, role: input.role, isActive: input.isActive, ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}) },
      });
      if (!input.isActive) {
        // лиды заблокированного менеджера в работе становятся нераспределёнными
        await prisma.lead.updateMany({ where: { managerId: input.id, status: { kind: { in: ["NEW"] } } }, data: { managerId: null } });
      }
    } else {
      if (!input.password) throw new ValidationError("Задайте пароль");
      await prisma.user.create({ data: { login, name, role: input.role, isActive: input.isActive, passwordHash: await bcrypt.hash(input.password, 10) } });
    }
    revalidateAll();
  });
}

"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role, StatusKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { formatNumber } from "@/lib/format";
import { SPECIAL_STATUS_KINDS } from "@/lib/constants";
import { getI18n } from "@/i18n/server";
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
    if (mode !== "MANUAL" && mode !== "ROUND_ROBIN") throw new ValidationError("err.distribution");
    const alert = Number(formData.get("unprocessedAlertMin"));
    if (!Number.isInteger(alert) || alert < 1 || alert > 10080) throw new ValidationError("err.alertMin");
    await prisma.appSettings.update({ where: { id: 1 }, data: { distributionMode: mode, unprocessedAlertMin: alert } });
    revalidateAll();
    return (await getI18n()).t("msg.saved");
  });
}

export async function saveRateAction(formData: FormData) {
  return runAction(async () => {
    await requireAdmin();
    const source = str(formData.get("usdRateSource"));
    const side = str(formData.get("usdRateSide"));
    if (source !== "MANUAL" && source !== "IPAK_YULI") throw new ValidationError("err.rateSource");
    if (side !== "BUY" && side !== "SELL") throw new ValidationError("err.rateSide");
    const data: Parameters<typeof prisma.appSettings.update>[0]["data"] = { usdRateSource: source, usdRateSide: side };
    if (source === "MANUAL") {
      const rate = Number(str(formData.get("usdRate")).replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(rate) || rate < 1000 || rate > 100000) throw new ValidationError("err.rateValue");
      Object.assign(data, { usdRate: rate, usdRateUpdatedAt: new Date(), usdRateError: null });
    }
    await prisma.appSettings.update({ where: { id: 1 }, data });
    if (source === "IPAK_YULI") {
      const r = await updateUsdRate();
      revalidateAll();
      if (!r.ok) throw new ValidationError("err.rateSavedButFailed", { error: ("error" in r ? r.error : "") ?? "" });
      const { t, f } = await getI18n();
      return t("msg.rateIpak", { rate: formatNumber("rate" in r ? r.rate : 0, 2), sum: f.sum });
    }
    revalidateAll();
    return (await getI18n()).t("msg.rateSaved");
  });
}

/** Установить курс вручную прямо сейчас (в любом режиме); в авто-режиме действует до следующего обновления в 07:00 */
export async function setUsdRateAction(value: string) {
  return runAction(async () => {
    await requireAdmin();
    const rate = Number(String(value).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(rate) || rate < 1000 || rate > 100000) throw new ValidationError("err.rateValue");
    const s = await prisma.appSettings.update({
      where: { id: 1 },
      data: { usdRate: rate, usdRateUpdatedAt: new Date(), usdRateError: null },
    });
    revalidateAll();
    const { t, f } = await getI18n();
    return t(s.usdRateSource === "IPAK_YULI" ? "msg.rateSetAuto" : "msg.rateSet", { rate: formatNumber(rate, 2), sum: f.sum });
  });
}

export async function refreshRateAction() {
  return runAction(async () => {
    await requireAdmin();
    const r = await updateUsdRate({ force: true });
    revalidateAll();
    if (!r.ok) throw new ValidationError("err.rateFetch", { error: ("error" in r ? r.error : "") ?? "" });
    return (await getI18n()).t("msg.rateUpdated", { buy: formatNumber("buy" in r ? r.buy : 0, 2), sell: formatNumber("sell" in r ? r.sell : 0, 2) });
  });
}

// ——— Статусы ———

const COLOR = /^#[0-9a-f]{6}$/i;

export async function saveStatusAction(input: { id?: string; name: string; color: string; kind: StatusKind }) {
  return runAction(async () => {
    await requireAdmin();
    const name = input.name.trim();
    if (!name) throw new ValidationError("err.emptyName");
    if (!COLOR.test(input.color)) throw new ValidationError("err.color");
    if (input.id) {
      const cur = await prisma.leadStatus.findUniqueOrThrow({ where: { id: input.id } });
      if (!cur.isSystem && SPECIAL_STATUS_KINDS.includes(input.kind)) throw new ValidationError("err.kindExists");
      // тип системных статусов менять нельзя — на нём держится логика
      await prisma.leadStatus.update({ where: { id: input.id }, data: { name, color: input.color, kind: cur.isSystem ? cur.kind : input.kind } });
    } else {
      if (SPECIAL_STATUS_KINDS.includes(input.kind)) throw new ValidationError("err.specialStatusExists");
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
    if (s.isSystem) throw new ValidationError("err.systemStatus");
    const count = await prisma.lead.count({ where: { statusId: id } });
    if (count > 0) {
      const target = await prisma.leadStatus.findUnique({ where: { id: moveTo } });
      if (!target || target.id === id || target.kind === "WON" || target.kind === "LOST") throw new ValidationError("err.statusHasLeads", { n: count });
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
    if (!name) throw new ValidationError("err.emptyName");
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
    const { t } = await getI18n();
    return used ? t("msg.reasonHidden", { n: used }) : t("msg.deleted");
  });
}

// ——— Пользователи ———

export async function saveUserAction(input: { id?: string; login: string; name: string; role: Role; password?: string; isActive: boolean }) {
  return runAction(async () => {
    const admin = await requireAdmin();
    const login = input.login.trim().toLowerCase();
    const name = input.name.trim();
    if (!/^[a-z0-9._-]{3,32}$/.test(login)) throw new ValidationError("err.login");
    if (!name) throw new ValidationError("err.name");
    if (input.role !== "ADMIN" && input.role !== "MANAGER") throw new ValidationError("err.role");
    if (input.password && input.password.length < 8) throw new ValidationError("err.passwordShort");
    const dup = await prisma.user.findFirst({ where: { login, NOT: input.id ? { id: input.id } : undefined } });
    if (dup) throw new ValidationError("err.loginTaken");

    if (input.id) {
      if (input.id === admin.id && (input.role !== "ADMIN" || !input.isActive)) throw new ValidationError("err.selfDemote");
      await prisma.user.update({
        where: { id: input.id },
        data: { login, name, role: input.role, isActive: input.isActive, ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}) },
      });
      if (!input.isActive) {
        // лиды заблокированного менеджера в работе становятся нераспределёнными
        await prisma.lead.updateMany({ where: { managerId: input.id, status: { kind: { in: ["NEW"] } } }, data: { managerId: null } });
      }
    } else {
      if (!input.password) throw new ValidationError("err.passwordRequired");
      await prisma.user.create({ data: { login, name, role: input.role, isActive: input.isActive, passwordHash: await bcrypt.hash(input.password, 10) } });
    }
    revalidateAll();
  });
}

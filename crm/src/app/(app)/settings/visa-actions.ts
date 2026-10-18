"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { SERVICE_TYPES } from "@/lib/constants";
import { ensureDocDefaults, hashSiteKey } from "@/lib/visa";

/** Список документов для типа услуги и страны (country пусто — общий список). Пустой список страны — удалить его */
export async function saveRequirementsAction(input: { type: string; country: string; names: string }) {
  return runAction(async () => {
    await requireAdmin();
    const type = input.type as ServiceType;
    if (!SERVICE_TYPES.includes(type)) throw new ValidationError("err.serviceType");
    const country = input.country.trim().slice(0, 100) || null;
    const names = [...new Set(input.names.split("\n").map((n) => n.trim().slice(0, 120)).filter(Boolean))].slice(0, 50);
    if (!country && !names.length) throw new ValidationError("err.docListEmpty");
    await ensureDocDefaults();
    await prisma.$transaction([
      prisma.docRequirement.deleteMany({ where: { type, country: country ? { equals: country, mode: "insensitive" } : null } }),
      prisma.docRequirement.createMany({ data: names.map((name, i) => ({ type, country, name, order: i + 1 })) }),
    ]);
    revalidatePath("/settings");
  });
}

/** Новый ключ API для сайта: показывается один раз, в базе — только хэш. Старый ключ перестаёт работать */
export async function generateSiteKeyAction() {
  return runAction(async () => {
    await requireAdmin();
    const key = `ot_${crypto.randomBytes(24).toString("base64url")}`;
    await prisma.appSettings.update({ where: { id: 1 }, data: { siteApiKeyHash: hashSiteKey(key) } });
    revalidatePath("/settings");
    return key;
  });
}

export async function revokeSiteKeyAction() {
  return runAction(async () => {
    await requireAdmin();
    await prisma.appSettings.update({ where: { id: 1 }, data: { siteApiKeyHash: null } });
    revalidatePath("/settings");
  });
}

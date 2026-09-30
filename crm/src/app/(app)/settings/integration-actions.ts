"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { encrypt } from "@/lib/crypto";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { getIntegration, inspectToken, pageClient, readSecrets } from "@/lib/meta/integration";
import { syncLeads } from "@/lib/meta/sync";
import { syncSpend } from "@/lib/meta/insights";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function saveIntegrationAction(formData: FormData) {
  return runAction(async () => {
    await requireAdmin();
    const current = await getIntegration();
    const appId = str(formData.get("appId"));
    const pageId = str(formData.get("pageId"));
    if (appId && !/^\d+$/.test(appId)) throw new ValidationError("App ID — это число");
    if (pageId && !/^\d+$/.test(pageId)) throw new ValidationError("Page ID — это число");
    const adAccountId = str(formData.get("adAccountId")).replace(/^act_/, "");
    if (adAccountId && !/^\d+$/.test(adAccountId)) throw new ValidationError("ID рекламного кабинета — число (можно с префиксом act_)");
    const poll = Number(formData.get("pollIntervalMin"));
    if (!Number.isInteger(poll) || poll < 1 || poll > 1440) throw new ValidationError("Интервал опроса — от 1 до 1440 минут");
    const initialDays = Number(formData.get("initialDays"));
    if (!Number.isInteger(initialDays) || initialDays < 1 || initialDays > 90) throw new ValidationError("Период первой загрузки — от 1 до 90 дней");

    const appSecret = str(formData.get("appSecret"));
    const pageToken = str(formData.get("pageToken"));
    const adsToken = str(formData.get("adsToken"));
    const tokenChanged = !!pageToken && !!current.pageTokenEnc;

    await prisma.metaIntegration.update({
      where: { id: 1 },
      data: {
        appId: appId || null,
        pageId: pageId || null,
        adAccountId: adAccountId ? `act_${adAccountId}` : null,
        pollIntervalMin: poll,
        initialDays,
        enabled: formData.get("enabled") === "on",
        verifyToken: str(formData.get("verifyToken")) || current.verifyToken || crypto.randomBytes(16).toString("hex"),
        ...(appSecret ? { appSecretEnc: encrypt(appSecret) } : {}),
        ...(pageToken ? { pageTokenEnc: encrypt(pageToken), tokenValid: true, tokenError: null, tokenExpiresAt: null } : {}),
        ...(adsToken ? { adsTokenEnc: encrypt(adsToken) } : {}),
        ...(formData.get("clearAdsToken") === "on" ? { adsTokenEnc: null } : {}),
        // при смене страницы начинаем загрузку заново
        ...(pageId && pageId !== current.pageId ? { lastSyncAt: null } : {}),
      },
    });
    revalidateAll();
    return tokenChanged ? "Настройки сохранены, токен обновлён" : "Настройки сохранены";
  });
}

export async function checkTokenAction() {
  return runAction(async () => {
    await requireAdmin();
    const secrets = readSecrets(await getIntegration());
    if (!secrets) throw new ValidationError("Сначала заполните App ID, App Secret, Page ID и токен");
    const info = await inspectToken(secrets);
    await prisma.metaIntegration.update({
      where: { id: 1 },
      data: { tokenValid: info.isValid, tokenError: info.isValid ? null : info.error ?? "Токен недействителен", tokenExpiresAt: info.expiresAt },
    });
    revalidateAll();
    if (!info.isValid) throw new ValidationError(`Токен недействителен: ${info.error ?? "проверьте токен"}`);
    const parts = [`Токен действителен${info.pageName ? `, страница «${info.pageName}»` : ""}`];
    parts.push(info.expiresAt ? `истекает ${formatDate(info.expiresAt)}` : "бессрочный");
    if (info.missingScopes.length) parts.push(`не хватает прав: ${info.missingScopes.join(", ")}`);
    return parts.join("; ");
  });
}

export async function syncNowAction() {
  return runAction(async () => {
    await requireAdmin();
    const r = await syncLeads("MANUAL");
    revalidateAll();
    if (r.skipped) throw new ValidationError(r.skipped);
    if (!r.ok) throw new ValidationError(`Ошибка синхронизации: ${r.errors.join("; ")}`);
    return r.created ? `Загружено новых лидов: ${r.created}` : "Новых лидов нет";
  });
}

export async function subscribeWebhookAction() {
  return runAction(async () => {
    await requireAdmin();
    const secrets = readSecrets(await getIntegration());
    if (!secrets) throw new ValidationError("Сначала заполните настройки интеграции");
    await pageClient(secrets).post(`${secrets.pageId}/subscribed_apps`, { subscribed_fields: "leadgen" });
    return "Страница подписана на события leadgen";
  });
}

export async function syncSpendAction() {
  return runAction(async () => {
    await requireAdmin();
    const i = await getIntegration();
    const r = await syncSpend(i.lastSpendSyncAt ? 7 : 90);
    revalidateAll();
    if ("skipped" in r && r.skipped) throw new ValidationError(r.skipped);
    if (!r.ok) throw new ValidationError(`Ошибка загрузки расходов: ${"error" in r ? r.error : ""}`);
    return `Загружено строк расходов: ${r.rows}`;
  });
}

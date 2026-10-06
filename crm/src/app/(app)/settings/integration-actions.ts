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
import { checkCapi, sendPendingConversions } from "@/lib/meta/capi";
import { decrypt } from "@/lib/crypto";
import { getI18n } from "@/i18n/server";

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
    if (appId && !/^\d+$/.test(appId)) throw new ValidationError("err.appId");
    if (pageId && !/^\d+$/.test(pageId)) throw new ValidationError("err.pageId");
    const adAccountId = str(formData.get("adAccountId")).replace(/^act_/, "");
    if (adAccountId && !/^\d+$/.test(adAccountId)) throw new ValidationError("err.adAccount");
    const poll = Number(formData.get("pollIntervalMin"));
    if (!Number.isInteger(poll) || poll < 1 || poll > 1440) throw new ValidationError("err.poll");
    const initialDays = Number(formData.get("initialDays"));
    if (!Number.isInteger(initialDays) || initialDays < 1 || initialDays > 90) throw new ValidationError("err.initialDays");

    const capiDatasetId = str(formData.get("capiDatasetId"));
    if (capiDatasetId && !/^\d+$/.test(capiDatasetId)) throw new ValidationError("err.capiDataset");
    const capiToken = str(formData.get("capiToken"));
    const capiEnabled = formData.get("capiEnabled") === "on";
    if (capiEnabled && (!capiDatasetId || (!capiToken && !current.capiTokenEnc))) throw new ValidationError("err.capiSetup");

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
        capiDatasetId: capiDatasetId || null,
        capiTestCode: str(formData.get("capiTestCode")) || null,
        capiEnabled,
        ...(capiToken ? { capiTokenEnc: encrypt(capiToken), capiLastError: null } : {}),
        // при смене страницы начинаем загрузку заново
        ...(pageId && pageId !== current.pageId ? { lastSyncAt: null } : {}),
      },
    });
    revalidateAll();
    const { t } = await getI18n();
    return tokenChanged ? t("msg.integrationSavedToken") : t("msg.integrationSaved");
  });
}

export async function checkTokenAction() {
  return runAction(async () => {
    await requireAdmin();
    const secrets = readSecrets(await getIntegration());
    if (!secrets) throw new ValidationError("err.integrationFirst");
    const info = await inspectToken(secrets);
    await prisma.metaIntegration.update({
      where: { id: 1 },
      data: { tokenValid: info.isValid, tokenError: info.isValid ? null : info.error ?? "Invalid OAuth access token", tokenExpiresAt: info.expiresAt },
    });
    revalidateAll();
    const { t } = await getI18n();
    if (!info.isValid) throw new ValidationError("err.tokenInvalid", { error: info.error ?? t("err.checkToken") });
    const parts = [`${t("msg.tokenValid")}${info.pageName ? `, ${t("msg.tokenPage", { name: info.pageName })}` : ""}`];
    parts.push(info.expiresAt ? t("msg.tokenExpires", { date: formatDate(info.expiresAt) }) : t("msg.tokenNeverExpires"));
    if (info.missingScopes.length) parts.push(t("msg.tokenMissingScopes", { scopes: info.missingScopes.join(", ") }));
    return parts.join("; ");
  });
}

export async function syncNowAction() {
  return runAction(async () => {
    await requireAdmin();
    const r = await syncLeads("MANUAL");
    revalidateAll();
    if (r.skipped) throw new ValidationError(r.skipped);
    if (!r.ok) {
      const error = r.errors.join("; ");
      // Meta заблокировала приложение (код 200) — подсказываем, где смотреть причину
      if (/api access blocked/i.test(error)) throw new ValidationError("err.metaBlocked", { error, privacyUrl: `${(process.env.APP_URL || "").replace(/\/$/, "")}/privacy` });
      throw new ValidationError("err.syncFailed", { error });
    }
    const { t } = await getI18n();
    return r.created ? t("msg.syncCreated", { n: r.created }) : t("msg.syncNone");
  });
}

export async function subscribeWebhookAction() {
  return runAction(async () => {
    await requireAdmin();
    const secrets = readSecrets(await getIntegration());
    if (!secrets) throw new ValidationError("err.integrationSetup");
    await pageClient(secrets).post(`${secrets.pageId}/subscribed_apps`, { subscribed_fields: "leadgen" });
    return (await getI18n()).t("msg.subscribed");
  });
}

export async function syncSpendAction() {
  return runAction(async () => {
    await requireAdmin();
    const i = await getIntegration();
    const r = await syncSpend(i.lastSpendSyncAt ? 7 : 90);
    revalidateAll();
    if ("skipped" in r && r.skipped) throw new ValidationError(r.skipped);
    if (!r.ok) throw new ValidationError("err.spendFailed", { error: "error" in r ? r.error ?? "" : "" });
    return (await getI18n()).t("msg.spendRows", { n: r.rows });
  });
}

/** Проверка Conversions API: набор данных доступен по маркеру; заодно отправляем события из очереди */
export async function checkCapiAction() {
  return runAction(async () => {
    await requireAdmin();
    const i = await getIntegration();
    const token = decrypt(i.capiTokenEnc);
    if (!i.capiDatasetId || !token) throw new ValidationError("err.capiSetup");
    let check: Awaited<ReturnType<typeof checkCapi>>;
    try {
      check = await checkCapi({ datasetId: i.capiDatasetId, token });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await prisma.metaIntegration.update({ where: { id: 1 }, data: { capiLastError: error.slice(0, 500) } });
      revalidateAll();
      throw new ValidationError("err.capiCheck", { error });
    }
    const r = await sendPendingConversions();
    const sentTotal = await prisma.conversionEvent.count({ where: { status: "SENT" } });
    // проверка прошла — старую ошибку проверки больше не показываем
    if (!r.failed) await prisma.metaIntegration.update({ where: { id: 1 }, data: { capiLastError: null } });
    revalidateAll();
    const { t } = await getI18n();
    if (check.name === null) {
      if (r.failed) throw new ValidationError("err.capiCheck", { error: (await getIntegration()).capiLastError ?? "" });
      return sentTotal ? t("msg.capiWriteOnlyOk", { n: sentTotal }) : t("msg.capiWriteOnlyWait");
    }
    const name = check.name;
    return t("msg.capiOk", { name }) + (r.sent ? ` ${t("msg.capiSent", { n: r.sent })}` : "");
  });
}

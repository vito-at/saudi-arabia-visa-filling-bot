/**
 * Интеграция с сайтом Orient Visa — формат обмена в docs/orient-visa-integration.md (читать перед изменениями).
 * Сайт присылает оплаченные заявки (POST /api/public/visa-application), CRM забирает анкету и документы
 * (GET {сайт}/api/integration/applications/{externalId}) и отправляет события (POST {сайт}/api/integration/crm-events)
 * через очередь с повторами.
 */
import crypto from "node:crypto";
import type { Prisma, VisaStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { guessMime } from "@/lib/mime";

export interface OrientVisaConfig {
  url: string;
  key: string;
  secret: string;
}

/** Адрес и ключи: из «Настройки → Визы и документы», иначе из окружения (SITE_URL, SITE_INTEGRATION_KEY, CRM_WEBHOOK_SECRET) */
export async function orientVisaConfig(): Promise<OrientVisaConfig | null> {
  const s = await prisma.appSettings.findUnique({ where: { id: 1 }, select: { orientVisaUrl: true, orientVisaKeyEnc: true, orientVisaSecretEnc: true } });
  const url = (s?.orientVisaUrl || process.env.SITE_URL || "").trim().replace(/\/$/, "");
  const key = decrypt(s?.orientVisaKeyEnc) || process.env.SITE_INTEGRATION_KEY || "";
  const secret = decrypt(s?.orientVisaSecretEnc) || process.env.CRM_WEBHOOK_SECRET || "";
  return url && key && secret ? { url, key, secret } : null;
}

export const hmacHex = (secret: string, body: string) => crypto.createHmac("sha256", secret).update(body).digest("hex");

const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Подписанная ссылка на файл визы / отказа для сайта: живёт час, сайт скачивает файл сразу при получении события */
export function signedFileUrl(secret: string, documentId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + 3600;
  const sig = hmacHex(secret, `${documentId}.${exp}`);
  return `${appUrl()}/api/public/visa-file/${documentId}?exp=${exp}&sig=${sig}`;
}

export function verifyFileSignature(secret: string, documentId: string, exp: string, sig: string, now = Date.now()): boolean {
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const want = hmacHex(secret, `${documentId}.${exp}`);
  return crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}

// ——— События CRM → сайт ———

export interface StatusEventInput {
  status: VisaStatus;
  comment?: string | null;
  rejectedDocuments?: string[];
  portalReference?: string | null;
  fileDocumentId?: string | null;
  proofType?: "OFFICIAL" | "EMAIL" | "SCREENSHOT" | null;
}

/** Событие о смене этапа: только для заявок с сайта */
export async function enqueueStatusEvent(service: { id: string; externalId: string | null }, e: StatusEventInput) {
  if (!service.externalId) return;
  const payload: Record<string, unknown> = { externalId: service.externalId, serviceId: service.id, type: "status", status: e.status };
  if (e.comment) payload.comment = e.comment;
  if (e.rejectedDocuments?.length) payload.rejectedDocuments = e.rejectedDocuments;
  if (e.portalReference) payload.portalReference = e.portalReference;
  // ссылка на файл подписывается в момент отправки (у каждой попытки — свежая)
  if (e.fileDocumentId) payload.fileDocumentId = e.fileDocumentId;
  if (e.proofType) payload.proofType = e.proofType;
  await prisma.siteEvent.create({ data: { serviceId: service.id, payload: payload as Prisma.InputJsonValue } });
}

export async function enqueueMessageEvent(service: { id: string; externalId: string | null }, text: string) {
  if (!service.externalId) return;
  await prisma.siteEvent.create({ data: { serviceId: service.id, payload: { externalId: service.externalId, type: "message", text } } });
}

/** Пауза перед следующей попыткой: 1, 2, 4… минут, не больше 6 часов */
export const retryDelayMs = (attempts: number) => Math.min(6 * 60, 2 ** Math.max(0, attempts - 1)) * 60_000;

export type FetchFn = typeof fetch;

/**
 * Отправить события, которым пора. Внутри одной заявки — строго по порядку:
 * пока не ушло раннее событие, следующие не отправляются (сайт применяет статусы последовательно).
 */
export async function processSiteEvents(now = new Date(), fetchFn: FetchFn = fetch): Promise<number> {
  const cfg = await orientVisaConfig();
  if (!cfg) return 0;
  const pending = await prisma.siteEvent.findMany({ where: { sentAt: null }, orderBy: { createdAt: "asc" }, take: 100 });
  const blocked = new Set<string>();
  let sent = 0;
  for (const ev of pending) {
    if (blocked.has(ev.serviceId)) continue;
    if (ev.nextAt > now) {
      blocked.add(ev.serviceId);
      continue;
    }
    const p = { ...(ev.payload as Record<string, unknown>) };
    if (typeof p.fileDocumentId === "string") {
      const doc = await prisma.leadDocument.findUnique({ where: { id: p.fileDocumentId }, select: { id: true, fileName: true } });
      if (doc) p.file = { url: signedFileUrl(cfg.secret, doc.id, now.getTime()), name: doc.fileName };
      delete p.fileDocumentId;
    }
    const body = JSON.stringify(p);
    let error: string | null = null;
    try {
      const res = await fetchFn(`${cfg.url}/api/integration/crm-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Event-Id": ev.id, "X-Signature": `sha256=${hmacHex(cfg.secret, body)}` },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) error = `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    if (!error) {
      await prisma.siteEvent.update({ where: { id: ev.id }, data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null } });
      sent++;
    } else {
      await prisma.siteEvent.update({ where: { id: ev.id }, data: { attempts: { increment: 1 }, lastError: error.slice(0, 500), nextAt: new Date(now.getTime() + retryDelayMs(ev.attempts + 1)) } });
      blocked.add(ev.serviceId);
    }
  }
  return sent;
}

// ——— Анкета и документы с сайта ———

export interface SiteField {
  key: string;
  label: string;
  value: string | null;
}
export interface SiteTraveler {
  id: string;
  position: number;
  name: string;
  fields: SiteField[];
}
export interface SiteData {
  number: string | null;
  status: string | null;
  visaType: string | null;
  /** гражданство заявителя (ISO2); нет — Узбекистан */
  nationality?: string | null;
  urgent: boolean;
  travelDate: string | null;
  returnDate: string | null;
  contact: { name?: string | null; phone?: string | null; email?: string | null; telegram?: string | null } | null;
  travelers: SiteTraveler[];
  updatedAt: string | null;
}

interface SiteDocument {
  id: string;
  title: string;
  mime?: string | null;
  size?: number | null;
  status?: string | null;
  url?: string | null;
}

export function readSiteData(enc: string | null | undefined): SiteData | null {
  const raw = decrypt(enc);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SiteData;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? null : String(v));

/** Забрать анкету и документы заявки с сайта: анкета — зашифрованно в заявку, новые файлы — в документы CRM */
export async function fetchSiteApplication(serviceId: string, fetchFn: FetchFn = fetch): Promise<{ ok: boolean; added: number; error?: string }> {
  const s = await prisma.leadService.findUnique({ where: { id: serviceId }, select: { id: true, leadId: true, externalId: true } });
  if (!s?.externalId) return { ok: false, added: 0, error: "not a site application" };
  const fail = async (error: string) => {
    await prisma.leadService.update({ where: { id: s.id }, data: { siteFetchError: error.slice(0, 500), siteFetchTries: { increment: 1 } } });
    return { ok: false, added: 0, error };
  };
  const cfg = await orientVisaConfig();
  if (!cfg) return fail("Не настроена связь с сайтом Orient Visa");

  let json: Record<string, unknown>;
  try {
    const res = await fetchFn(`${cfg.url}/api/integration/applications/${encodeURIComponent(s.externalId)}`, {
      headers: { Authorization: `Bearer ${cfg.key}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return fail(`HTTP ${res.status}`);
    json = (await res.json()) as Record<string, unknown>;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  const travelersRaw = Array.isArray(json.travelers) ? (json.travelers as Record<string, unknown>[]) : [];
  const data: SiteData = {
    number: str(json.number),
    status: str(json.status),
    visaType: str(json.visaType),
    nationality: typeof json.nationality === "string" && /^[A-Za-z]{2}$/.test(json.nationality) ? json.nationality.toUpperCase() : null,
    urgent: !!json.urgent,
    travelDate: str(json.travelDate),
    returnDate: str(json.returnDate),
    contact: json.contact && typeof json.contact === "object" ? (json.contact as SiteData["contact"]) : null,
    travelers: travelersRaw.map((t, i) => ({
      id: str(t.id) ?? String(i),
      position: Number(t.position) || i + 1,
      name: str(t.name) ?? "",
      fields: (Array.isArray(t.fields) ? (t.fields as Record<string, unknown>[]) : []).map((f) => ({ key: str(f.key) ?? "", label: str(f.label) ?? str(f.key) ?? "", value: str(f.value) })),
    })),
    updatedAt: str(json.updatedAt),
  };

  // файлы: ссылки живут 10 минут — скачиваем сразу; уже скачанные (по id документа на сайте) не трогаем
  const have = new Set((await prisma.leadDocument.findMany({ where: { serviceId: s.id, externalId: { not: null } }, select: { externalId: true } })).map((d) => d.externalId));
  let added = 0;
  const errors: string[] = [];
  for (const t of travelersRaw) {
    const docs = Array.isArray(t.documents) ? (t.documents as SiteDocument[]) : [];
    for (const d of docs) {
      if (!d?.id || !d.url || have.has(d.id)) continue;
      try {
        const res = await fetchFn(d.url, { signal: AbortSignal.timeout(60_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = new Uint8Array(await res.arrayBuffer());
        if (body.length > 25 * 1024 * 1024) throw new Error("файл больше 25 МБ");
        const mime = d.mime || res.headers.get("content-type")?.split(";")[0] || null;
        const ext = mime?.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
        const fileName = `${(d.title || "document").replace(/[\\/:*?"<>|\r\n]/g, " ").trim()}${t.name ? ` — ${str(t.name)}` : ""}.${ext}`;
        await prisma.leadDocument.create({
          data: { serviceId: s.id, leadId: s.leadId, docType: d.title || "Документ", fileName: fileName.slice(0, 200), mime: guessMime(fileName, mime), size: body.length, data: Buffer.from(body), externalId: d.id, travelerName: str(t.name) },
        });
        have.add(d.id);
        added++;
      } catch (e) {
        errors.push(`${d.title}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  await prisma.leadService.update({
    where: { id: s.id },
    data: {
      siteDataEnc: encrypt(JSON.stringify(data)),
      ...(data.visaType ? { visaType: data.visaType } : {}),
      ...(data.nationality ? { nationality: data.nationality } : {}),
      ...(data.number ? { externalNumber: data.number } : {}),
      // не скачались не все файлы — попробуем ещё раз (ссылки при повторе будут новые)
      siteFetchNeeded: errors.length > 0,
      siteFetchedAt: new Date(),
      siteFetchError: errors.length ? errors.join("; ").slice(0, 500) : null,
      siteFetchTries: errors.length ? { increment: 1 } : 0,
    },
  });
  return { ok: !errors.length, added, error: errors[0] };
}

/** Воркер: заявки, у которых надо (заново) забрать анкету — с паузой между неудачными попытками */
export async function processSiteFetches(now = new Date()): Promise<number> {
  if (!(await orientVisaConfig())) return 0;
  const list = await prisma.leadService.findMany({ where: { siteFetchNeeded: true, externalId: { not: null }, siteFetchTries: { lt: 30 } }, select: { id: true, siteFetchTries: true, updatedAt: true }, take: 20 });
  let done = 0;
  for (const s of list) {
    if (s.siteFetchTries > 0 && now.getTime() - s.updatedAt.getTime() < retryDelayMs(s.siteFetchTries)) continue;
    if ((await fetchSiteApplication(s.id)).ok) done++;
  }
  return done;
}

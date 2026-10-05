/**
 * Meta Conversions API для CRM («качественные лиды»): CRM сообщает Meta, что стало с лидом из формы —
 * квалифицирован, продажа или отказ. По этим событиям Meta учится показывать рекламу тем, кто покупает.
 * Событие привязывается к лиду по его leadgen id (user_data.lead_id), каждая стадия — один раз на лид.
 * Отправка — сразу после смены статуса и повторно воркером, если Meta была недоступна.
 */
import type { MetaIntegration, StatusKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { convertRevenue, round2, toNum } from "@/lib/money";
import { GraphClient, GraphError, type FetchFn } from "./graph";

/** Стадии воронки, которые получает Meta (имена событий задаёт CRM) */
export const CAPI_EVENTS = ["Qualified", "Converted", "Disqualified"] as const;
export type CapiEvent = (typeof CAPI_EVENTS)[number];

/** Meta принимает события не старше 7 дней */
export const CAPI_MAX_AGE_MS = 7 * 86_400_000;
/** Сколько раз пробуем отправить событие, прежде чем оставить его с ошибкой */
export const CAPI_MAX_ATTEMPTS = 6;

/**
 * Какие события отправить при переходе в статус:
 * этап воронки («Консультация», «Ожидает оплату» и т. п.) — «Qualified»; попытки дозвона («Не дозвонились», «Перезвонить»
 * — статусы без отметки «В воронке») квалификацией не считаются; «Продано» — «Qualified» + «Converted»; «Отказ» — «Disqualified».
 * Каждая стадия уходит по лиду один раз (повторы отсекает уникальный ключ в очереди).
 */
export function conversionEventsFor(to: { kind: StatusKind; inFunnel: boolean }): CapiEvent[] {
  if (to.kind === "WON") return ["Qualified", "Converted"];
  if (to.kind === "LOST") return ["Disqualified"];
  if (to.kind === "NEW" || !to.inFunnel) return [];
  return ["Qualified"];
}

export interface CapiEventRow {
  leadgenId: string;
  eventName: string;
  eventTime: Date;
  value: number | null;
}

/**
 * Тело запроса к /{dataset}/events. lead_id — 15–17-значное число: в JS оно не помещается в number без потери точности,
 * поэтому подставляем цифры в JSON как есть.
 */
export function buildCapiPayload(events: CapiEventRow[], testCode?: string | null): string {
  const data = events.map((e) => ({
    action_source: "system_generated",
    event_name: e.eventName,
    event_time: Math.floor(e.eventTime.getTime() / 1000),
    user_data: { lead_id: `__LEAD_${e.leadgenId}__` },
    custom_data: {
      event_source: "crm",
      lead_event_source: "Orient Travel CRM",
      ...(e.value !== null ? { value: e.value, currency: "USD" } : {}),
    },
  }));
  const json = JSON.stringify({ data, ...(testCode ? { test_event_code: testCode } : {}) });
  return json.replace(/"__LEAD_(\d+)__"/g, "$1");
}

export interface CapiConfig {
  datasetId: string;
  token: string;
  testCode: string | null;
}

export function capiConfig(i: MetaIntegration | null): CapiConfig | null {
  if (!i?.capiEnabled || !i.capiDatasetId) return null;
  const token = decrypt(i.capiTokenEnc);
  if (!token) return null;
  return { datasetId: i.capiDatasetId, token, testCode: i.capiTestCode || null };
}

/** Поставить события в очередь (только для лидов из формы Meta и при включённой интеграции) и сразу попробовать отправить */
export async function queueConversions(leadId: string, to: { kind: StatusKind; inFunnel: boolean }): Promise<void> {
  const names = conversionEventsFor(to);
  if (!names.length) return;
  const integration = await prisma.metaIntegration.findUnique({ where: { id: 1 } });
  if (!capiConfig(integration)) return;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { leadgenId: true, deals: { select: { amount: true, currency: true } } } });
  if (!lead?.leadgenId || !/^\d+$/.test(lead.leadgenId)) return;

  let value: number | null = null;
  if (names.includes("Converted")) {
    const s = await prisma.appSettings.findUnique({ where: { id: 1 } });
    const sale = toNum(s?.usdRate);
    const rates = { sale, cost: toNum(s?.usdRateCost) || sale };
    // сумма продаж лида в $ (по минимальному курсу, как выручка в отчётах)
    value = sale > 0 ? round2(lead.deals.reduce((sum, d) => sum + convertRevenue(toNum(d.amount), d.currency, "USD", rates), 0)) : null;
  }
  await prisma.conversionEvent.createMany({
    data: names.map((eventName) => ({ leadId, leadgenId: lead.leadgenId!, eventName, value: eventName === "Converted" ? value : null })),
    skipDuplicates: true,
  });
  await sendPendingConversions();
}

/** Отправить события из очереди (и повторить неудачные). Возвращает число отправленных. */
export async function sendPendingConversions(fetchFn?: FetchFn): Promise<{ sent: number; failed: number; skipped?: string }> {
  const integration = await prisma.metaIntegration.findUnique({ where: { id: 1 } });
  const cfg = capiConfig(integration);
  if (!cfg) return { sent: 0, failed: 0, skipped: "off" };

  const now = Date.now();
  // слишком старые Meta не примет — сразу помечаем ошибкой
  await prisma.conversionEvent.updateMany({
    where: { status: { not: "SENT" }, eventTime: { lt: new Date(now - CAPI_MAX_AGE_MS) } },
    data: { status: "FAILED", attempts: CAPI_MAX_ATTEMPTS, error: "Событие старше 7 дней — Meta его не принимает" },
  });
  const rows = await prisma.conversionEvent.findMany({
    where: { status: { not: "SENT" }, attempts: { lt: CAPI_MAX_ATTEMPTS } },
    orderBy: { eventTime: "asc" },
    take: 500,
  });
  // повтор с паузой: после n-й неудачи ждём n × 5 минут
  const due = rows.filter((r) => r.attempts === 0 || now - r.updatedAt.getTime() >= r.attempts * 5 * 60_000);
  if (!due.length) return { sent: 0, failed: 0 };

  const client = new GraphClient(cfg.token, fetchFn);
  let sent = 0;
  let failed = 0;
  // Meta принимает до 1000 событий за запрос; берём пачки по 100
  for (let i = 0; i < due.length; i += 100) {
    const batch = due.slice(i, i + 100);
    const ids = batch.map((r) => r.id);
    try {
      await client.postJson(`${cfg.datasetId}/events`, buildCapiPayload(batch.map((r) => ({ ...r, value: r.value === null ? null : toNum(r.value) })), cfg.testCode));
      await prisma.conversionEvent.updateMany({ where: { id: { in: ids } }, data: { status: "SENT", sentAt: new Date(), error: null } });
      await prisma.metaIntegration.update({ where: { id: 1 }, data: { capiLastSentAt: new Date(), capiLastError: null } });
      sent += batch.length;
    } catch (e) {
      const msg = (e instanceof GraphError || e instanceof Error ? e.message : String(e)).slice(0, 500);
      await prisma.conversionEvent.updateMany({ where: { id: { in: ids } }, data: { status: "FAILED", attempts: { increment: 1 }, error: msg } });
      await prisma.metaIntegration.update({ where: { id: 1 }, data: { capiLastError: msg } });
      failed += batch.length;
    }
  }
  return { sent, failed };
}

/** Проверка набора данных и маркера: Meta отдаёт название набора, если доступ есть */
export async function checkCapi(cfg: { datasetId: string; token: string }, fetchFn?: FetchFn): Promise<string> {
  const r = await new GraphClient(cfg.token, fetchFn).get<{ id: string; name?: string }>(cfg.datasetId, { fields: "id,name" });
  return r.name || r.id;
}

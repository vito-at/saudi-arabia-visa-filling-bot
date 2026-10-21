import { Prisma, type SyncTrigger } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createLead } from "@/lib/leads/service";
import { GraphError, type FetchFn } from "./graph";
import { getIntegration, markTokenError, markTokenOk, pageClient, readSecrets, type IntegrationSecrets } from "./integration";
import { LEAD_FIELDS, nameFromAnswers, parseMetaLead, phoneFromAnswers, type MetaLead } from "./parse";
import { normalizePhone } from "@/lib/phone";

interface MetaFormInfo {
  id: string;
  name: string;
  status?: string;
  questions?: { key: string; label?: string }[];
}

export interface SyncResult {
  ok: boolean;
  formsChecked: number;
  fetched: number;
  created: number;
  duplicates: number;
  errors: string[];
  skipped?: string;
}

/** Запас при запросе «новых» лидов: Meta иногда отдаёт лиды с задержкой */
const OVERLAP_SEC = 60 * 60;
/** Сколько держится блокировка загрузки; если процесс упал посреди загрузки, через это время её можно запускать снова */
export const SYNC_LOCK_MS = 10 * 60_000;

function labelsOf(form: MetaFormInfo): Record<string, string> {
  return Object.fromEntries((form.questions ?? []).filter((q) => q.label).map((q) => [q.key, q.label!]));
}

/** Сохранение одного лида Meta в CRM. Возвращает true, если лид новый. */
export async function importMetaLead(raw: MetaLead, form: { name?: string | null; labels?: Record<string, string> }) {
  const input = parseMetaLead(raw, { formName: form.name, labels: form.labels });
  const lead = await createLead(input, null);
  if (lead && raw.form_id) {
    await prisma.metaForm.updateMany({ where: { id: raw.form_id, OR: [{ lastLeadAt: null }, { lastLeadAt: { lt: lead.createdAt } }] }, data: { lastLeadAt: lead.createdAt } });
  }
  return !!lead;
}

/**
 * Одна загрузка за раз. Блокировка — строка в базе со сроком, а не advisory-lock Postgres:
 * advisory-lock принадлежит соединению, а Prisma берёт соединения из пула, поэтому снятие могло уйти
 * в другое соединение, и блокировка оставалась висеть навсегда («Синхронизация уже выполняется»).
 */
export async function withSyncLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const now = new Date();
  const until = new Date(now.getTime() + SYNC_LOCK_MS);
  const { count } = await prisma.metaIntegration.updateMany({
    where: { id: 1, OR: [{ syncLockedUntil: null }, { syncLockedUntil: { lt: now } }] },
    data: { syncLockedUntil: until },
  });
  if (!count) return null;
  try {
    return await fn();
  } finally {
    await prisma.metaIntegration.updateMany({ where: { id: 1, syncLockedUntil: until }, data: { syncLockedUntil: null } });
  }
}

/**
 * Загрузка новых лидов со всех форм страницы.
 * Берём лиды, созданные после последней синхронизации (с запасом), дубли отсекаются по leadgen_id.
 */
export async function syncLeads(trigger: SyncTrigger, opts: { fetchFn?: FetchFn; secrets?: IntegrationSecrets } = {}): Promise<SyncResult> {
  const result: SyncResult = { ok: true, formsChecked: 0, fetched: 0, created: 0, duplicates: 0, errors: [] };
  const integration = await getIntegration();
  const secrets = opts.secrets ?? readSecrets(integration);
  if (!secrets) return { ...result, ok: false, skipped: "err.integrationMissing" };

  const run = await withSyncLock(async () => {
    const log = await prisma.syncLog.create({ data: { trigger } });
    const startedAt = new Date();
    const sinceMs = integration.lastSyncAt
      ? integration.lastSyncAt.getTime() - OVERLAP_SEC * 1000
      : Date.now() - Math.min(90, Math.max(1, integration.initialDays)) * 86_400_000;
    const since = Math.floor(sinceMs / 1000);
    const client = pageClient(secrets, opts.fetchFn);

    try {
      const forms = await client.all<MetaFormInfo>(`${secrets.pageId}/leadgen_forms`, { fields: "id,name,status,questions", limit: 100 });
      for (const f of forms) {
        await prisma.metaForm.upsert({ where: { id: f.id }, update: { name: f.name, status: f.status }, create: { id: f.id, name: f.name, status: f.status } });
      }
      for (const form of forms) {
        // архивные формы тоже проверяем: по ним могут доходить поздние лиды
        result.formsChecked++;
        const labels = labelsOf(form);
        try {
          for await (const raw of client.paginate<MetaLead>(`${form.id}/leads`, {
            fields: LEAD_FIELDS,
            limit: 100,
            filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]),
          })) {
            result.fetched++;
            const isNew = await importMetaLead({ ...raw, form_id: raw.form_id ?? form.id }, { name: form.name, labels });
            if (isNew) result.created++;
            else result.duplicates++;
          }
        } catch (e) {
          if (e instanceof GraphError && e.isTokenError) throw e;
          result.errors.push(`Форма «${form.name}»: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      result.ok = result.errors.length === 0;
      await prisma.metaIntegration.update({ where: { id: 1 }, data: { lastSyncAt: startedAt } });
      await markTokenOk();
    } catch (e) {
      result.ok = false;
      const tokenProblem = await markTokenError(e);
      result.errors.push(`${tokenProblem ? "Токен недействителен: " : ""}${e instanceof Error ? e.message : String(e)}`);
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        formsChecked: result.formsChecked,
        fetched: result.fetched,
        created: result.created,
        duplicates: result.duplicates,
        ok: result.ok,
        error: result.errors.length ? result.errors.join("\n").slice(0, 4000) : null,
      },
    });
    return result;
  });

  return run ?? { ...result, ok: false, skipped: "err.syncBusy" };
}

/** Обработка одного leadgen_id из вебхука */
export async function importLeadById(leadgenId: string, opts: { fetchFn?: FetchFn } = {}) {
  const integration = await getIntegration();
  const secrets = readSecrets(integration);
  if (!secrets) throw new Error("Интеграция не настроена");
  const exists = await prisma.lead.findUnique({ where: { leadgenId }, select: { id: true } });
  if (exists) return false;
  const client = pageClient(secrets, opts.fetchFn);
  try {
    const raw = await client.get<MetaLead>(leadgenId, { fields: LEAD_FIELDS });
    let formName: string | null = null;
    let labels: Record<string, string> = {};
    if (raw.form_id) {
      const known = await prisma.metaForm.findUnique({ where: { id: raw.form_id } });
      const form = await client.get<MetaFormInfo>(raw.form_id, { fields: "id,name,status,questions" }).catch(() => null);
      formName = form?.name ?? known?.name ?? null;
      labels = form ? labelsOf(form) : {};
      if (form) await prisma.metaForm.upsert({ where: { id: form.id }, update: { name: form.name, status: form.status }, create: { id: form.id, name: form.name, status: form.status } });
    }
    const created = await importMetaLead(raw, { name: formName, labels });
    await markTokenOk();
    return created;
  } catch (e) {
    await markTokenError(e);
    throw e;
  }
}

/** Meta хранит лиды 90 дней — старше этого признак уже не узнать */
const ORGANIC_LOOKBACK_MS = 89 * 86_400_000;

/**
 * Признак «органический лид» для лидов, загруженных до того, как CRM его сохраняла.
 * Берёт до 50 лидов за раз одним запросом ?ids=…; вызывается воркером, пока такие лиды есть.
 */
export async function backfillOrganic(opts: { fetchFn?: FetchFn; secrets?: IntegrationSecrets } = {}): Promise<number> {
  const secrets = opts.secrets ?? readSecrets(await getIntegration());
  if (!secrets) return 0;
  const leads = await prisma.lead.findMany({
    where: { leadgenId: { not: null }, isOrganic: null, createdAt: { gt: new Date(Date.now() - ORGANIC_LOOKBACK_MS) } },
    select: { id: true, leadgenId: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const byLeadgen = new Map(leads.filter((l) => /^\d+$/.test(l.leadgenId!)).map((l) => [l.leadgenId!, l.id]));
  if (!byLeadgen.size) return 0;
  const client = pageClient(secrets, opts.fetchFn);
  type Row = { id: string; is_organic?: boolean };
  let res: Record<string, Row>;
  try {
    res = await client.get<Record<string, Row>>("", { ids: [...byLeadgen.keys()].join(","), fields: "id,is_organic" });
  } catch (e) {
    if (e instanceof GraphError && e.isTokenError) throw e;
    // один удалённый или недоступный лид ломает весь пакет — тогда по одному
    res = {};
    for (const leadgenId of byLeadgen.keys()) {
      const r = await client.get<Row>(leadgenId, { fields: "id,is_organic" }).catch(() => null);
      // лид, который Meta уже не отдаёт, считаем рекламным (как было до учёта органики), чтобы не запрашивать его снова
      res[leadgenId] = r ?? { id: leadgenId, is_organic: false };
    }
  }
  let updated = 0;
  for (const [leadgenId, id] of byLeadgen) {
    const r = res[leadgenId];
    if (!r) continue;
    await prisma.lead.update({ where: { id }, data: { isOrganic: r.is_organic === true } });
    updated++;
  }
  return updated;
}

/**
 * Лиды «Без имени», у которых имя есть в ответах формы на свой вопрос («Ваше имя?», «Ismingiz?»):
 * раньше CRM узнавала только стандартное поле Meta. Имя записывается в лид и в клиента (если у клиента тоже «Без имени»).
 */
export async function fixUnnamedLeads(): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: { name: "Без имени", formAnswers: { not: Prisma.AnyNull } },
    select: { id: true, clientId: true, formAnswers: true },
  });
  let fixed = 0;
  for (const l of leads) {
    const name = nameFromAnswers(l.formAnswers);
    if (!name) continue;
    await prisma.$transaction([
      prisma.lead.update({ where: { id: l.id }, data: { name } }),
      prisma.client.updateMany({ where: { id: l.clientId, name: "Без имени" }, data: { name } }),
    ]);
    fixed++;
  }
  return fixed;
}

/**
 * Лиды без телефона, у которых номер есть в ответах формы на свой вопрос («Номер телефона для связи?»):
 * раньше CRM брала номер только из стандартного поля Meta. Номер записывается в лид; если клиент с таким номером
 * уже есть — лид привязывается к нему (повторное обращение), иначе номер получает клиент лида.
 */
export async function fixPhonelessLeads(): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: { phone: null, phoneRaw: null, formAnswers: { not: Prisma.AnyNull } },
    select: { id: true, clientId: true, formAnswers: true },
  });
  let fixed = 0;
  for (const l of leads) {
    const raw = phoneFromAnswers(l.formAnswers);
    if (!raw) continue;
    const phone = normalizePhone(raw);
    const existing = phone ? await prisma.client.findUnique({ where: { phone }, select: { id: true } }) : null;
    await prisma.$transaction([
      prisma.lead.update({
        where: { id: l.id },
        data: { phone, phoneRaw: raw, ...(existing && existing.id !== l.clientId ? { clientId: existing.id, isRepeat: true } : {}) },
      }),
      ...(phone && !existing ? [prisma.client.updateMany({ where: { id: l.clientId, phone: null }, data: { phone } })] : []),
    ]);
    fixed++;
  }
  return fixed;
}

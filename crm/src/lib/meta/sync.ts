import type { SyncTrigger } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createLead } from "@/lib/leads/service";
import { GraphError, type FetchFn } from "./graph";
import { getIntegration, markTokenError, markTokenOk, pageClient, readSecrets, type IntegrationSecrets } from "./integration";
import { LEAD_FIELDS, parseMetaLead, type MetaLead } from "./parse";

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
const LOCK_KEY = 7_340_001;

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

async function withLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS locked`;
  if (!locked) return null;
  try {
    return await fn();
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_KEY})`;
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

  const run = await withLock(async () => {
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

/**
 * Фоновый воркер: опрос Meta по расписанию, загрузка расходов на рекламу, обновление курса USD.
 * Запуск: npm run worker (в Docker — отдельный сервис worker).
 */
import cron from "node-cron";
import { prisma } from "../src/lib/db";
import { syncLeads } from "../src/lib/meta/sync";
import { syncSpend } from "../src/lib/meta/insights";
import { isRateStale, RATE_RETRY_UNTIL_HOUR, updateUsdRate } from "../src/lib/rates";

const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);
let busy = false;

/** Каждую минуту проверяем, не пора ли синхронизироваться (интервал задаётся в настройках) */
async function tickLeads() {
  if (busy) return;
  busy = true;
  try {
    const i = await prisma.metaIntegration.findUnique({ where: { id: 1 } });
    if (!i?.enabled) return;
    const intervalMs = Math.max(1, i.pollIntervalMin) * 60_000;
    if (i.lastSyncAt && Date.now() - i.lastSyncAt.getTime() < intervalMs - 5_000) return;
    const r = await syncLeads("CRON");
    if (r.skipped) log("Синхронизация пропущена:", r.skipped);
    else log(`Синхронизация: форм ${r.formsChecked}, получено ${r.fetched}, новых ${r.created}, дублей ${r.duplicates}`, r.errors.length ? r.errors : "");
  } catch (e) {
    log("Ошибка синхронизации лидов:", e);
  } finally {
    busy = false;
  }
}

async function tickSpend() {
  try {
    const i = await prisma.metaIntegration.findUnique({ where: { id: 1 } });
    if (!i?.enabled || !i.adAccountId) return;
    // первый запуск — за 90 дней, дальше — последние 3 дня (Meta уточняет расходы задним числом)
    const r = await syncSpend(i.lastSpendSyncAt ? 3 : 90);
    log("Расходы на рекламу:", r);
  } catch (e) {
    log("Ошибка загрузки расходов:", e);
  }
}

/**
 * Курс USD: каждый день в 07:00 по Ташкенту. Если не получилось — повтор каждые 30 минут до 12:00.
 * Пока курс за сегодня не обновлён, сотрудники видят уведомление (см. RateNotice).
 */
async function tickRate(force = false) {
  try {
    const s = await prisma.appSettings.findUnique({ where: { id: 1 } });
    if (!s || s.usdRateSource !== "IPAK_YULI") return;
    if (!force && !isRateStale(s.usdRateUpdatedAt)) return;
    const r = await updateUsdRate();
    log("Курс USD:", r);
  } catch (e) {
    log("Ошибка обновления курса:", e);
  }
}

cron.schedule("* * * * *", tickLeads);
cron.schedule("17 * * * *", tickSpend);
cron.schedule("0 7 * * *", () => tickRate(true), { timezone: "Asia/Tashkent" });
cron.schedule(`*/30 7-${RATE_RETRY_UNTIL_HOUR - 1} * * *`, () => tickRate(), { timezone: "Asia/Tashkent" });

log("Воркер запущен");
void tickLeads();
// при запуске воркера после 07:00 — догоняем пропущенное обновление
void tickRate();

async function shutdown() {
  log("Остановка воркера");
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

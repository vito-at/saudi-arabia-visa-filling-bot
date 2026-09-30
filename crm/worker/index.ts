/**
 * Фоновый воркер: опрос Meta по расписанию, загрузка расходов на рекламу, обновление курса USD.
 * Запуск: npm run worker (в Docker — отдельный сервис worker).
 */
import cron from "node-cron";
import { prisma } from "../src/lib/db";
import { syncLeads } from "../src/lib/meta/sync";
import { syncSpend } from "../src/lib/meta/insights";
import { updateUsdRate } from "../src/lib/rates";

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

async function tickRate() {
  try {
    const r = await updateUsdRate();
    if (!("skipped" in r && r.skipped)) log("Курс USD:", r);
  } catch (e) {
    log("Ошибка обновления курса:", e);
  }
}

cron.schedule("* * * * *", tickLeads);
cron.schedule("17 * * * *", tickSpend);
cron.schedule("5 */2 * * *", tickRate, { timezone: "Asia/Tashkent" });

log("Воркер запущен");
void tickLeads();
void tickRate();

async function shutdown() {
  log("Остановка воркера");
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

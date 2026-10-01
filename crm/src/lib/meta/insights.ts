import { prisma } from "@/lib/db";
import { GraphClient, type FetchFn } from "./graph";
import { getIntegration, markTokenError, readSecrets } from "./integration";

interface InsightRow {
  campaign_id: string;
  adset_id?: string;
  ad_id?: string;
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  spend: string;
  impressions?: string;
  inline_link_clicks?: string;
  account_currency?: string;
  date_start: string;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Загрузка расходов, показов и кликов по объявлениям за последние N дней (Marketing API /insights, level=ad, по дням).
 * Нужен токен с правом ads_read и ID рекламного кабинета act_XXXX.
 */
export async function syncSpend(days = 7, fetchFn?: FetchFn) {
  const integration = await getIntegration();
  const secrets = readSecrets(integration);
  if (!integration.adAccountId || !secrets) return { ok: false, rows: 0, skipped: "err.noAdAccount" };
  const account = integration.adAccountId.startsWith("act_") ? integration.adAccountId : `act_${integration.adAccountId}`;
  const client = new GraphClient(secrets.adsToken || secrets.pageToken, fetchFn);
  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  let rows = 0;
  try {
    for await (const r of client.paginate<InsightRow>(`${account}/insights`, {
      level: "ad",
      fields: "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,inline_link_clicks,account_currency",
      time_increment: 1,
      time_range: JSON.stringify({ since: ymd(since), until: ymd(until) }),
      limit: 500,
    })) {
      const date = new Date(`${r.date_start}T00:00:00Z`);
      const key = { date, campaignId: r.campaign_id, adsetId: r.adset_id ?? "", adId: r.ad_id ?? "" };
      const data = {
        spend: Number(r.spend) || 0,
        currency: r.account_currency ?? "USD",
        impressions: Math.round(Number(r.impressions) || 0),
        clicks: Math.round(Number(r.inline_link_clicks) || 0),
        campaignName: r.campaign_name ?? null,
        adsetName: r.adset_name ?? null,
        adName: r.ad_name ?? null,
      };
      await prisma.adSpend.upsert({
        where: { date_campaignId_adsetId_adId: key },
        update: data,
        create: { ...key, ...data },
      });
      rows++;
    }
    await prisma.metaIntegration.update({ where: { id: 1 }, data: { lastSpendSyncAt: new Date() } });
    return { ok: true, rows };
  } catch (e) {
    if (!secrets.adsToken) await markTokenError(e);
    return { ok: false, rows, error: e instanceof Error ? e.message : String(e) };
  }
}

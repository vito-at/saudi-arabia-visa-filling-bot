import type { MetaIntegration } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { GraphClient, GraphError, type FetchFn } from "./graph";

export async function getIntegration(): Promise<MetaIntegration> {
  return (await prisma.metaIntegration.findUnique({ where: { id: 1 } })) ?? (await prisma.metaIntegration.create({ data: { id: 1 } }));
}

export interface IntegrationSecrets {
  appId: string;
  appSecret: string;
  pageId: string;
  pageToken: string;
  adsToken: string | null;
}

export function readSecrets(i: MetaIntegration): IntegrationSecrets | null {
  const pageToken = decrypt(i.pageTokenEnc);
  const appSecret = decrypt(i.appSecretEnc);
  if (!i.appId || !i.pageId || !pageToken || !appSecret) return null;
  return { appId: i.appId, appSecret, pageId: i.pageId, pageToken, adsToken: decrypt(i.adsTokenEnc) };
}

export function pageClient(s: IntegrationSecrets, fetchFn?: FetchFn) {
  return new GraphClient(s.pageToken, fetchFn);
}

/** Отметка о проблеме с токеном — показывается баннером во всём интерфейсе */
export async function markTokenError(e: unknown) {
  if (e instanceof GraphError && e.isTokenError) {
    await prisma.metaIntegration.update({ where: { id: 1 }, data: { tokenValid: false, tokenError: e.message.slice(0, 500) } });
    return true;
  }
  return false;
}

export async function markTokenOk() {
  await prisma.metaIntegration.updateMany({ where: { id: 1, OR: [{ tokenValid: false }, { tokenError: { not: null } }] }, data: { tokenValid: true, tokenError: null } });
}

export interface TokenInfo {
  isValid: boolean;
  expiresAt: Date | null; // null — бессрочный
  scopes: string[];
  missingScopes: string[];
  pageName?: string;
  error?: string;
}

export const REQUIRED_SCOPES = ["leads_retrieval", "pages_show_list", "pages_read_engagement", "pages_manage_metadata", "ads_read"];

/** Проверка токена через /debug_token (нужен app access token = appId|appSecret) */
export async function inspectToken(s: IntegrationSecrets, fetchFn?: FetchFn): Promise<TokenInfo> {
  const appClient = new GraphClient(`${s.appId}|${s.appSecret}`, fetchFn);
  try {
    const { data } = await appClient.get<{ data: { is_valid: boolean; expires_at?: number; data_access_expires_at?: number; scopes?: string[]; error?: { message: string } } }>(
      "debug_token",
      { input_token: s.pageToken },
    );
    const scopes = data.scopes ?? [];
    const info: TokenInfo = {
      isValid: data.is_valid,
      expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
      scopes,
      missingScopes: REQUIRED_SCOPES.filter((sc) => !scopes.includes(sc)),
      error: data.error?.message,
    };
    if (data.is_valid) {
      const page = await pageClient(s, fetchFn).get<{ name: string }>(s.pageId, { fields: "name" });
      info.pageName = page.name;
    }
    return info;
  } catch (e) {
    return { isValid: false, expiresAt: null, scopes: [], missingScopes: REQUIRED_SCOPES, error: e instanceof Error ? e.message : String(e) };
  }
}

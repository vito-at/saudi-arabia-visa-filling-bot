import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { hashSiteKey } from "@/lib/visa";

export const dynamic = "force-dynamic";

/**
 * Сообщение клиента по визовой заявке с сайта Orient Visa (docs/orient-visa-integration.md, раздел 4):
 *   POST /api/public/visa-message
 *   Authorization: Bearer <тот же ключ, что для заявок>
 *   { "externalId": "<id заявки на сайте>", "messageId": "<id сообщения на сайте>", "text": "…", "at"?: "2026-10-22T10:00:00Z" }
 * Сообщение попадает в историю заявки с отметкой «от клиента», визовик получает уведомление.
 * Повтор с тем же messageId дубль не создаёт (200 duplicate); заявка не найдена — 404 (повторять не нужно).
 */
export async function POST(req: NextRequest) {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 }, select: { siteApiKeyHash: true } });
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || req.headers.get("x-api-key") || "";
  const want = settings?.siteApiKeyHash ?? "";
  const got = key ? hashSiteKey(key) : "";
  if (!want || !got || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ ok: false, error: "Invalid API key" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }
  const str = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const externalId = str("externalId", 100);
  const messageId = str("messageId", 100);
  const text = str("text", 4000);
  if (!externalId || !messageId || !text) return NextResponse.json({ ok: false, error: "Required: externalId, messageId, text" }, { status: 422 });

  const service = await prisma.leadService.findUnique({ where: { externalId }, select: { id: true, assigneeId: true, lead: { select: { name: true } } } });
  if (!service) return NextResponse.json({ ok: false, error: "Application not found" }, { status: 404 });

  const at = new Date(str("at", 40));
  try {
    await prisma.visaEvent.create({
      data: { serviceId: service.id, comment: text, fromClient: true, externalId: `msg:${messageId}`, ...(Number.isNaN(at.getTime()) ? {} : { createdAt: at }) },
    });
  } catch (e) {
    // повтор доставки того же сообщения
    if ((e as { code?: string }).code === "P2002") return NextResponse.json({ ok: true, result: "duplicate" });
    throw e;
  }
  const to = service.assigneeId
    ? [service.assigneeId]
    : (await prisma.user.findMany({ where: { role: "VISA", isActive: true }, select: { id: true } })).map((u) => u.id);
  await notify(to.map((userId) => ({ userId, type: "visaMsg" as const, key: `visaMsg:${messageId}`, link: `/visa/${service.id}`, data: { name: service.lead.name } })));
  return NextResponse.json({ ok: true, result: "applied" }, { status: 201 });
}

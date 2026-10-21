import crypto from "node:crypto";
import { NextResponse, after, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createLead } from "@/lib/leads/service";
import { normalizePhone } from "@/lib/phone";
import { notify } from "@/lib/notify";
import { hashSiteKey } from "@/lib/visa";
import { fetchSiteApplication } from "@/lib/orient-visa";

export const dynamic = "force-dynamic";

/**
 * Заявка на визу с сайта агентства. Вызывается с сервера сайта (ключ в браузер не отдавать):
 *   POST /api/public/visa-application
 *   Authorization: Bearer <ключ из «Настройки → Визы и документы»>
 *   { "name": "…", "phone": "+998…", "country": "Таиланд", "email"?: "…", "travelers"?: 2,
 *     "travelFrom"?: "2026-12-01", "travelTo"?: "2026-12-10", "comment"?: "…", "nationality"?: "IN" }
 * Создаётся лид (источник «Сайт») и визовая заявка, сразу переданная визовым специалистам.
 *
 * Сайт Orient Visa (docs/orient-visa-integration.md) дополнительно присылает externalId — ключ идемпотентности:
 * повтор с тем же externalId дубль не создаёт и возвращает 200 с тем же id; "event": "corrections_submitted" —
 * клиент прислал исправления: заявка возвращается в работу, анкета и документы забираются заново.
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
  // повторы с одним externalId обрабатываются по очереди: второй увидит уже созданную заявку и вернёт её id
  const ext = typeof body.externalId === "string" ? body.externalId.trim().slice(0, 100) : "";
  return ext ? serialized(ext, () => handle(body)) : handle(body);
}

const inFlight = new Map<string, Promise<unknown>>();
async function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = inFlight.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  inFlight.set(key, run);
  try {
    return await run;
  } finally {
    if (inFlight.get(key) === run) inFlight.delete(key);
  }
}

/** Гражданство: код страны ISO2 («IN»); прочее — не сохраняем */
const iso2 = (v: unknown) => (typeof v === "string" && /^[A-Za-z]{2}$/.test(v.trim()) ? v.trim().toUpperCase() : null);

async function handle(body: Record<string, unknown>): Promise<NextResponse> {
  const str = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const date = (k: string) => {
    const v = str(k, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+05:00`) : null;
  };
  const name = str("name", 120);
  // сайт регистрирует клиентов из любой страны: узбекский номер приводим к +998…, иностранный сохраняем как есть
  const phoneIn = str("phone", 40);
  const digits = phoneIn.replace(/\D/g, "");
  const phone = normalizePhone(phoneIn) ?? (digits.length >= 8 && digits.length <= 15 && /^\+?[\d\s().-]+$/.test(phoneIn) ? `+${digits}` : null);
  const country = str("country", 100);
  const email = str("email", 200) || null;
  const comment = str("comment", 2000) || null;
  const travelers = Number.isInteger(body.travelers) && (body.travelers as number) > 0 && (body.travelers as number) <= 50 ? (body.travelers as number) : null;
  const externalId = str("externalId", 100) || null;
  const visaUserIds = async () => (await prisma.user.findMany({ where: { role: "VISA", isActive: true }, select: { id: true } })).map((u) => u.id);
  if (externalId) {
    const existing = await prisma.leadService.findUnique({ where: { externalId }, select: { id: true, assigneeId: true, lead: { select: { name: true } } } });
    if (existing) {
      if (body.event === "corrections_submitted") {
        await prisma.$transaction([
          prisma.leadService.update({ where: { id: existing.id }, data: { status: "IN_PROGRESS", statusAt: new Date(), closed: false, siteFetchNeeded: true, siteFetchTries: 0 } }),
          prisma.visaEvent.create({ data: { serviceId: existing.id, status: "IN_PROGRESS", comment: "Клиент отправил исправления на сайте" } }),
        ]);
        const to = existing.assigneeId ? [existing.assigneeId] : await visaUserIds();
        await notify(to.map((userId) => ({ userId, type: "visaFix" as const, key: `visaFix:${existing.id}:${Date.now()}`, link: `/visa/${existing.id}`, data: { name: existing.lead.name } })));
        after(() => fetchSiteApplication(existing.id).then(() => undefined, (e) => console.error("orient-visa fetch:", e)));
      }
      return NextResponse.json({ ok: true, id: existing.id }, { status: 200 });
    }
  }
  const errors = [!name && "name", !phone && "phone", !country && "country"].filter(Boolean);
  if (errors.length) return NextResponse.json({ ok: false, error: `Required: ${errors.join(", ")}` }, { status: 422 });

  const makeLead = () =>
    createLead(
      {
        source: "WEBSITE",
        name,
        phone,
        email,
        serviceType: "VISA",
        destination: country,
        travelers,
        visaApplications: travelers,
        travelFrom: date("travelFrom"),
        travelTo: date("travelTo"),
        ...(comment ? { formAnswers: [{ key: "comment", label: "Комментарий с сайта", value: comment }] } : {}),
      },
      null,
    );
  // клиент с этим телефоном мог появиться в ту же секунду из другой заявки — тогда вторая попытка найдёт его
  const lead = await makeLead().catch((e: { code?: string }) => {
    if (e.code === "P2002") return makeLead();
    throw e;
  });
  if (!lead) return NextResponse.json({ ok: false, error: "Not created" }, { status: 500 });
  const paid = Number(body.paidAmount);
  const agency = body.agency && typeof body.agency === "object" ? (body.agency as Record<string, unknown>) : null;
  let service;
  try {
    service = await prisma.leadService.create({
      data: {
        leadId: lead.id,
        type: "VISA",
        country,
        source: "WEBSITE",
        handedAt: new Date(),
        note: comment,
        externalId,
        externalNumber: str("externalNumber", 50) || null,
        externalUrl: /^https?:\/\//.test(str("externalUrl", 500)) ? str("externalUrl", 500) : null,
        visaType: str("visaType", 200) || null,
        urgent: body.urgent === true,
        paidAmount: Number.isFinite(paid) && paid >= 0 ? paid : null,
        agencyName: typeof agency?.name === "string" ? agency.name.slice(0, 200) : null,
        agencyInn: typeof agency?.inn === "string" ? agency.inn.slice(0, 20) : null,
        nationality: iso2(body.nationality),
        siteFetchNeeded: !!externalId,
      },
    });
  } catch (e) {
    // одновременный повтор с тем же externalId: заявка уже создана параллельным запросом — лишний лид убираем
    if ((e as { code?: string }).code === "P2002" && externalId) {
      await prisma.lead.delete({ where: { id: lead.id } }).catch(() => undefined);
      const dup = await prisma.leadService.findUnique({ where: { externalId }, select: { id: true } });
      if (dup) return NextResponse.json({ ok: true, id: dup.id }, { status: 200 });
    }
    throw e;
  }
  if (externalId) after(() => fetchSiteApplication(service.id).then(() => undefined, (e) => console.error("orient-visa fetch:", e)));
  await prisma.visaEvent.create({ data: { serviceId: service.id, status: "NEW", comment: externalId ? `Заявка с сайта Orient Visa${service.externalNumber ? ` ${service.externalNumber}` : ""}, оплачена` : "Заявка с сайта" } });
  await notify((await visaUserIds()).map((userId) => ({ userId, type: "visaNew" as const, key: `visaNew:${service.id}`, link: `/visa/${service.id}`, data: { name, product: country } })));
  return NextResponse.json({ ok: true, id: service.id }, { status: 201 });
}

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createLead } from "@/lib/leads/service";
import { normalizePhone } from "@/lib/phone";
import { notify } from "@/lib/notify";
import { hashSiteKey } from "@/lib/visa";

export const dynamic = "force-dynamic";

/**
 * Заявка на визу с сайта агентства. Вызывается с сервера сайта (ключ в браузер не отдавать):
 *   POST /api/public/visa-application
 *   Authorization: Bearer <ключ из «Настройки → Визы и документы»>
 *   { "name": "…", "phone": "+998…", "country": "Таиланд", "email"?: "…", "travelers"?: 2,
 *     "travelFrom"?: "2026-12-01", "travelTo"?: "2026-12-10", "comment"?: "…" }
 * Создаётся лид (источник «Сайт») и визовая заявка, сразу переданная визовым специалистам.
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
  const date = (k: string) => {
    const v = str(k, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+05:00`) : null;
  };
  const name = str("name", 120);
  const phone = normalizePhone(str("phone", 40));
  const country = str("country", 100);
  const email = str("email", 200) || null;
  const comment = str("comment", 2000) || null;
  const travelers = Number.isInteger(body.travelers) && (body.travelers as number) > 0 && (body.travelers as number) <= 50 ? (body.travelers as number) : null;
  const errors = [!name && "name", !phone && "phone", !country && "country"].filter(Boolean);
  if (errors.length) return NextResponse.json({ ok: false, error: `Required: ${errors.join(", ")}` }, { status: 422 });

  const lead = await createLead(
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
  if (!lead) return NextResponse.json({ ok: false, error: "Not created" }, { status: 500 });
  const service = await prisma.leadService.create({ data: { leadId: lead.id, type: "VISA", country, source: "WEBSITE", handedAt: new Date(), note: comment } });
  await prisma.visaEvent.create({ data: { serviceId: service.id, status: "NEW", comment: "Заявка с сайта" } });
  const visaUsers = await prisma.user.findMany({ where: { role: "VISA", isActive: true }, select: { id: true } });
  await notify(visaUsers.map((u) => ({ userId: u.id, type: "visaNew" as const, key: `visaNew:${service.id}`, link: `/visa/${service.id}`, data: { name, product: country } })));
  return NextResponse.json({ ok: true, id: service.id }, { status: 201 });
}

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { verifySignature } from "@/lib/meta/signature";
import { getIntegration } from "@/lib/meta/integration";
import { importLeadById } from "@/lib/meta/sync";

export const dynamic = "force-dynamic";

/** Подтверждение подписки: Meta присылает hub.mode=subscribe, hub.verify_token и hub.challenge */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const integration = await getIntegration();
  if (p.get("hub.mode") === "subscribe" && integration.verifyToken && p.get("hub.verify_token") === integration.verifyToken) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface LeadgenPayload {
  object?: string;
  entry?: { id: string; time: number; changes?: { field: string; value: { leadgen_id?: string; form_id?: string; page_id?: string } }[] }[];
}

/** Событие leadgen: проверяем подпись, догружаем лид по leadgen_id и создаём его в CRM */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const integration = await getIntegration();
  const appSecret = decrypt(integration.appSecretEnc);
  if (!appSecret || !verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: LeadgenPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  if (payload.object !== "page") return NextResponse.json({ ok: true, ignored: true });

  const ids = (payload.entry ?? [])
    .filter((e) => !integration.pageId || e.id === integration.pageId)
    .flatMap((e) => e.changes ?? [])
    .filter((c) => c.field === "leadgen" && c.value.leadgen_id)
    .map((c) => c.value.leadgen_id!);

  const started = new Date();
  let created = 0;
  const errors: string[] = [];
  for (const id of ids) {
    try {
      if (await importLeadById(id)) created++;
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (ids.length) {
    await prisma.syncLog.create({
      data: { trigger: "WEBHOOK", startedAt: started, finishedAt: new Date(), fetched: ids.length, created, duplicates: ids.length - created - errors.length, ok: errors.length === 0, error: errors.join("\n") || null },
    });
  }
  // Meta ждёт 200, иначе будет повторять доставку; при ошибках лид подтянет плановый опрос
  return NextResponse.json({ ok: true, received: ids.length, created });
}

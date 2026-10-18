import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { DOC_MAX, guessMime, serviceScope } from "@/lib/visa";
import { getI18n } from "@/i18n/server";
import type { TKey } from "@/i18n/core";

export const dynamic = "force-dynamic";

/** Загрузка документа в заявку с компьютера (multipart: serviceId, docType, file) — из карточки лида и кабинета визового специалиста */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { t } = await getI18n();
  const fail = (key: TKey) => NextResponse.json({ ok: false, error: t(key) }, { status: 400 });
  if (Number(req.headers.get("content-length") ?? 0) > DOC_MAX + 1024 * 1024) return fail("err.chatFileTooBig");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("err.chatFileEmpty");
  }
  const file = form.get("file");
  const docType = String(form.get("docType") ?? "").trim().slice(0, 120);
  const service = await prisma.leadService.findFirst({ where: { id: String(form.get("serviceId") ?? ""), ...serviceScope(user) }, select: { id: true, leadId: true } });
  if (!service) return fail("err.serviceNotFound");
  if (!docType) return fail("err.docType");
  if (!(file instanceof File) || !file.size) return fail("err.chatFileEmpty");
  if (file.size > DOC_MAX) return fail("err.chatFileTooBig");
  const name = file.name.replace(/[\r\n"]/g, "").slice(0, 200) || "file";
  await prisma.leadDocument.create({
    data: { serviceId: service.id, leadId: service.leadId, docType, fileName: name, mime: guessMime(name, file.type), size: file.size, data: Buffer.from(await file.arrayBuffer()), uploadedById: user.id },
  });
  revalidatePath(`/leads/${service.leadId}`);
  revalidatePath("/visa");
  revalidatePath(`/visa/${service.id}`);
  return NextResponse.json({ ok: true });
}

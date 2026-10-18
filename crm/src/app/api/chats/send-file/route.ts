import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { conversationScope } from "@/lib/access";
import { takeLead, ValidationError } from "@/lib/leads/service";
import { CHAT_FILE_MAX, sendChatFile } from "@/lib/chats/send";
import { TelegramError } from "@/lib/chats/telegram";
import { GraphError } from "@/lib/meta/graph";
import { getI18n } from "@/i18n/server";
import type { TKey } from "@/i18n/core";

export const dynamic = "force-dynamic";

/** Отправка файла клиенту из CRM (multipart: conversationId, caption, file) */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { t } = await getI18n();
  const fail = (key: TKey, vars?: Record<string, string | number>) => NextResponse.json({ ok: false, error: t(key, vars) }, { status: 400 });
  if (Number(req.headers.get("content-length") ?? 0) > CHAT_FILE_MAX + 1024 * 1024) return fail("err.chatFileTooBig");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("err.chatFileEmpty");
  }
  const conversationId = String(form.get("conversationId") ?? "");
  const caption = String(form.get("caption") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return fail("err.chatFileEmpty");
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, ...conversationScope(user) },
    include: { lead: { select: { id: true, managerId: true, status: { select: { kind: true } } } } },
  });
  if (!conv) return fail("err.chatNotFound");

  try {
    await sendChatFile(conversationId, { name: file.name, mime: file.type, data: new Uint8Array(await file.arrayBuffer()) }, caption, user.id);
  } catch (e) {
    if (e instanceof ValidationError) return fail(e.message as TKey, e.vars);
    if (e instanceof GraphError || e instanceof TelegramError) return fail("err.chatSend", { error: e.message });
    console.error("send file:", e);
    return NextResponse.json({ ok: false, error: t("common.errorGeneric") }, { status: 500 });
  }
  // как и при текстовом ответе: менеджер, ответивший по нераспределённому или новому лиду, берёт его в работу
  const lead = conv.lead;
  if (lead && user.role === "MANAGER" && (!lead.managerId || (lead.managerId === user.id && lead.status.kind === "NEW"))) {
    await takeLead(lead.id, user).catch(() => undefined);
  }
  revalidatePath("/chats");
  if (lead) revalidatePath(`/leads/${lead.id}`);
  return NextResponse.json({ ok: true });
}

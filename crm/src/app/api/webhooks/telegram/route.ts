import crypto from "node:crypto";
import { NextResponse, after, type NextRequest } from "next/server";
import { getTelegram, type TgUpdate } from "@/lib/chats/telegram";
import { handleTelegramUpdate } from "@/lib/chats/incoming";
import { replyAfterPause } from "@/lib/chats/ai";

export const dynamic = "force-dynamic";

/** Обновления Telegram-бота. Принимаем только запросы с секретом, заданным при setWebhook. */
export async function POST(req: NextRequest) {
  const integration = await getTelegram();
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const want = integration.webhookSecret ?? "";
  if (!want || got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  try {
    // ИИ-ассистент отвечает после ответа Telegram, когда клиент допишет
    if (await handleTelegramUpdate(update)) after(replyAfterPause);
  } catch (e) {
    // Telegram повторяет доставку только при ошибке HTTP — пишем в журнал и отвечаем 200, чтобы не зациклить
    console.error("Telegram webhook:", e);
  }
  return NextResponse.json({ ok: true });
}

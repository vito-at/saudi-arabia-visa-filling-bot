import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { conversationScope } from "@/lib/access";
import { getTelegram, telegramBot } from "@/lib/chats/telegram";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", oga: "audio/ogg", ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "video/mp4", mov: "video/quicktime", pdf: "application/pdf" };

/** Вложение Telegram (фото, голосовое, документ) — только сотрудникам с доступом к этой переписке */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const messageId = req.nextUrl.searchParams.get("m") ?? "";
  const index = Number(req.nextUrl.searchParams.get("i") ?? 0);
  const msg = await prisma.chatMessage.findFirst({ where: { id: messageId, conversation: conversationScope(user) }, select: { attachments: true } });
  const att = Array.isArray(msg?.attachments) ? (msg.attachments as { fileId?: string; name?: string }[])[index] : undefined;
  if (!att?.fileId) return new NextResponse("Not found", { status: 404 });
  const bot = telegramBot(await getTelegram());
  if (!bot) return new NextResponse("Telegram off", { status: 404 });
  try {
    const { body, path } = await bot.download(att.fileId);
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(body, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=86400",
        ...(att.name && !MIME[ext]?.startsWith("image") ? { "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(att.name)}` } : {}),
      },
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 502 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Файл, отправленный клиенту из CRM. Без входа: Instagram скачивает вложение по этой ссылке.
 * Ссылка — случайный токен, перечислить файлы нельзя.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,40}$/.test(token)) return new NextResponse("Not found", { status: 404 });
  const f = await prisma.chatFile.findUnique({ where: { token } });
  if (!f) return new NextResponse("Not found", { status: 404 });
  const inline = /^(image|video|audio)\//.test(f.mime) || f.mime === "application/pdf";
  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(f.size),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      // HTML и прочее не открывается в браузере как страница CRM
      "Content-Security-Policy": "sandbox",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    },
  });
}

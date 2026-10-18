import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { documentScope } from "@/lib/visa";

export const dynamic = "force-dynamic";

/** Документ клиента — только сотрудникам с доступом к заявке. ?download=1 — скачать */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const d = await prisma.leadDocument.findFirst({ where: { id, ...documentScope(user) } });
  if (!d) return new NextResponse("Not found", { status: 404 });
  const inline = req.nextUrl.searchParams.get("download") !== "1" && (/^(image|video|audio)\//.test(d.mime) || d.mime === "application/pdf");
  return new NextResponse(new Uint8Array(d.data), {
    headers: {
      "Content-Type": d.mime,
      "Content-Length": String(d.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(d.fileName)}`,
    },
  });
}

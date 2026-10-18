import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Последние уведомления сотрудника и число непрочитанных */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return NextResponse.json({
    unread,
    items: items.map((n) => ({ id: n.id, type: n.type, data: n.data, link: n.link, read: !!n.readAt, at: n.createdAt.toISOString() })),
  });
}

/** Отметить прочитанными: { id } — одно, без id — все */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null, ...(body.id ? { id: body.id } : {}) }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}

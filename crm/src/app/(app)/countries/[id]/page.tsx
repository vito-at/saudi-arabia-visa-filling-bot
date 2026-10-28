import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

/** Старая ссылка на карточку — открываем её в «Странах и визах» */
export default async function CountryRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const c = await prisma.visaCountry.findUnique({ where: { id }, select: { citizenship: true, code: true } });
  if (!c) notFound();
  redirect(c.code ? `/countries?from=${c.citizenship}&to=${c.code}` : `/countries?from=${c.citizenship}&id=${id}`);
}

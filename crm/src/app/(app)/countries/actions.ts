"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { AccessError, requireAdmin, requireUser } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { canEditCountries, parseCountry, type CountryInput } from "@/lib/countries";

/** Сохранить карточку (id нет — новая). Возвращает, куда перейти: гражданство и страну поездки. */
export async function saveCountryAction(id: string | null, input: CountryInput) {
  return runAction(async () => {
    const user = await requireUser();
    if (!canEditCountries(user.role)) throw new AccessError();
    const parsed = parseCountry(input);
    if ("error" in parsed) throw new ValidationError(parsed.error);
    // любая правка снимает отметку «проверено» — администратор проверяет заново
    const data = { ...parsed.data, prices: parsed.data.prices as unknown as Prisma.InputJsonArray, updatedById: user.id, verifiedAt: null, verifiedById: null };
    try {
      const saved = id ? await prisma.visaCountry.update({ where: { id }, data }) : await prisma.visaCountry.create({ data });
      revalidatePath("/countries");
      return { from: saved.citizenship, to: saved.code, id: saved.id };
    } catch (e) {
      // такое название уже есть
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("err.countryExists");
      throw e;
    }
  });
}

/** Администратор проверил информацию (или снимает отметку): менеджеры видят «Информация проверена» */
export async function verifyCountryAction(id: string, verified: boolean) {
  return runAction(async () => {
    const admin = await requireAdmin();
    await prisma.visaCountry.update({ where: { id }, data: verified ? { verifiedAt: new Date(), verifiedById: admin.id } : { verifiedAt: null, verifiedById: null } });
    revalidatePath("/countries");
  });
}

/** Удалить карточку страны — только администратор */
export async function deleteCountryAction(id: string) {
  return runAction(async () => {
    await requireAdmin();
    await prisma.visaCountry.delete({ where: { id } }).catch(() => undefined);
    revalidatePath("/countries");
  });
}

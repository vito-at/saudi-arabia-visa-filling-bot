"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { AccessError, requireAdmin, requireUser } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { canEditCountries, parseCountry, type CountryInput } from "@/lib/countries";

/** Сохранить карточку страны (id нет — новая). Возвращает id. */
export async function saveCountryAction(id: string | null, input: CountryInput) {
  return runAction(async () => {
    const user = await requireUser();
    if (!canEditCountries(user.role)) throw new AccessError();
    const parsed = parseCountry(input);
    if ("error" in parsed) throw new ValidationError(parsed.error);
    const data = { ...parsed.data, updatedById: user.id };
    try {
      const saved = id ? await prisma.visaCountry.update({ where: { id }, data }) : await prisma.visaCountry.create({ data });
      revalidatePath("/countries");
      return saved.id;
    } catch (e) {
      // такое название уже есть
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("err.countryExists");
      throw e;
    }
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

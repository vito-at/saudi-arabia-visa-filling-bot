"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions";
import { setOnShift, touchActivity } from "@/lib/shift";
import { requireUser } from "@/lib/session";

/** Переключатель «В работе» менеджера: лиды из очереди и доля с авиабилетов — только тем, кто в работе */
export async function setShiftAction(on: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== "MANAGER") return;
    await setOnShift(user.id, on);
    revalidatePath("/", "layout");
  });
}

/** Менеджер что-то нажал в CRM (не чаще раза в минуту): продлевает «В работе» и копит время работы за день */
export async function touchActivityAction(): Promise<boolean | null> {
  const user = await requireUser();
  if (user.role !== "MANAGER") return null;
  return touchActivity(user.id);
}

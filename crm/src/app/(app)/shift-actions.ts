"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions";
import { setOnShift } from "@/lib/leads/distribution";
import { requireUser } from "@/lib/session";

/** Переключатель «В работе» менеджера: лиды из очереди выдаются только тем, кто в работе */
export async function setShiftAction(on: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== "MANAGER") return;
    await setOnShift(user.id, on);
    revalidatePath("/", "layout");
  });
}

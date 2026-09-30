"use server";

import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";

// Реализуется на этапе интеграции с Meta
export async function syncNowAction() {
  return runAction<string>(async () => {
    await requireAdmin();
    throw new ValidationError("Интеграция с Meta ещё не настроена");
  });
}

"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { encrypt } from "@/lib/crypto";
import { requireAdmin } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { AI_MODEL, aiClient, askClaude, getAiSettings, systemPrompt, workHoursText } from "@/lib/chats/ai";
import { getSettings } from "@/lib/refs";
import { scheduleOf } from "@/lib/work-hours";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export interface AiBotInput {
  enabled: boolean;
  apiKey: string;
  mode: string;
  telegram: boolean;
  instagram: boolean;
  instructions: string;
  maxReplies: string;
}

/** Проверка ключа: запрос сведений о модели — бесплатный, токены не расходуются */
async function checkKey(key: string) {
  try {
    await new Anthropic({ apiKey: key, maxRetries: 1, timeout: 20_000 }).models.retrieve(AI_MODEL);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ValidationError("err.aiKey");
    if (e instanceof Anthropic.APIError) throw new ValidationError("err.aiApi", { error: `${e.status ?? ""} ${e.message}`.slice(0, 200) });
    throw new ValidationError("err.aiApi", { error: e instanceof Error ? e.message : String(e) });
  }
}

export async function saveAiBotAction(i: AiBotInput) {
  return runAction(async () => {
    await requireAdmin();
    const current = await getAiSettings();
    const key = i.apiKey.trim();
    if (key) await checkKey(key);
    if (i.enabled && !key && !current.apiKeyEnc) throw new ValidationError("err.aiKey");
    const max = Number(i.maxReplies);
    if (!Number.isInteger(max) || max < 1 || max > 200) throw new ValidationError("err.aiMax");
    const channels = [...(i.telegram ? (["TELEGRAM"] as const) : []), ...(i.instagram ? (["INSTAGRAM"] as const) : [])];
    if (i.enabled && !channels.length) throw new ValidationError("err.aiChannels");
    await prisma.aiBotSettings.update({
      where: { id: 1 },
      data: {
        enabled: i.enabled,
        mode: i.mode === "ALWAYS" ? "ALWAYS" : "OFF_HOURS",
        channels: [...channels],
        instructions: i.instructions.slice(0, 8000),
        maxReplies: max,
        ...(key ? { apiKeyEnc: encrypt(key), lastError: null } : {}),
      },
    });
    revalidatePath("/settings");
    return (await getI18n()).t("common.saved");
  });
}

export async function clearAiKeyAction() {
  return runAction(async () => {
    await requireAdmin();
    await prisma.aiBotSettings.update({ where: { id: 1 }, data: { apiKeyEnc: null, enabled: false } });
    revalidatePath("/settings");
  });
}

/** Пробный ответ ассистента на сообщение, как будто его написал клиент (в мессенджер ничего не уходит) */
export async function testAiAction(message: string) {
  return runAction(async () => {
    await requireAdmin();
    const text = message.trim().slice(0, 1000);
    if (!text) throw new ValidationError("err.chatEmpty");
    const s = await getAiSettings();
    const client = aiClient(s);
    if (!client) throw new ValidationError("err.aiKey");
    try {
      const system = systemPrompt(s, { workHours: workHoursText(scheduleOf(await getSettings())), today: formatDate(new Date()), phoneKnown: false });
      const a = await askClaude(client, system, [{ role: "user", content: text }]);
      if (!a) throw new ValidationError("err.aiRefused");
      return a;
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      if (e instanceof Anthropic.APIError) throw new ValidationError("err.aiApi", { error: `${e.status ?? ""} ${e.message}`.slice(0, 200) });
      throw e;
    }
  });
}

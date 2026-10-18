import { describe, expect, it } from "vitest";
import { aiCanReply, toHistory } from "@/lib/chats/ai";

describe("ИИ-ассистент", () => {
  it("история: склейка подряд идущих, вложения словами, первым и последним — клиент", () => {
    const h = toHistory([
      { direction: "OUT", text: "Здравствуйте! Чем помочь?", attachments: null },
      { direction: "IN", text: "Salom", attachments: null },
      { direction: "IN", text: null, attachments: [{ type: "image" }] },
      { direction: "OUT", text: "Qayerga?", attachments: null },
      { direction: "IN", text: "Turkiya", attachments: null },
      { direction: "OUT", text: "Ответ без вопроса клиента", attachments: null },
    ]);
    expect(h).toEqual([
      { role: "user", content: "Salom\n[фото]" },
      { role: "assistant", content: "Qayerga?" },
      { role: "user", content: "Turkiya" },
    ]);
  });

  it("когда ассистент отвечает", () => {
    const s = { enabled: true, apiKeyEnc: "x", mode: "OFF_HOURS", channels: ["TELEGRAM" as const], maxReplies: 5 };
    const conv = { channel: "TELEGRAM" as const, aiPaused: false, aiReplies: 0, lastInboundAt: new Date() };
    expect(aiCanReply(s, conv, false)).toBe(true);
    // рабочее время — отвечают менеджеры
    expect(aiCanReply(s, conv, true)).toBe(false);
    expect(aiCanReply({ ...s, mode: "ALWAYS" }, conv, true)).toBe(true);
    expect(aiCanReply(s, { ...conv, aiPaused: true }, false)).toBe(false);
    expect(aiCanReply(s, { ...conv, aiReplies: 5 }, false)).toBe(false);
    expect(aiCanReply(s, { ...conv, channel: "INSTAGRAM" }, false)).toBe(false);
    expect(aiCanReply({ ...s, apiKeyEnc: null }, conv, false)).toBe(false);
    // Instagram: ответить можно только в течение 24 часов
    const ig = { ...s, channels: ["INSTAGRAM" as const] };
    expect(aiCanReply(ig, { ...conv, channel: "INSTAGRAM", lastInboundAt: new Date(Date.now() - 25 * 3_600_000) }, false)).toBe(false);
  });
});

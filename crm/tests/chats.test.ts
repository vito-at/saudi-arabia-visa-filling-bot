import { describe, expect, it } from "vitest";
import { igCanReply, parseIgWebhook } from "@/lib/chats/instagram";
import { tgAttachments, tgName, tgText, type TgMessage } from "@/lib/chats/telegram";
import { extractPhone, previewText } from "@/lib/chats/store";

describe("Instagram webhook", () => {
  const payload = {
    object: "instagram",
    entry: [
      {
        id: "IG_OWN",
        time: 1,
        messaging: [
          { sender: { id: "U1" }, recipient: { id: "IG_OWN" }, timestamp: 1_760_000_000_000, message: { mid: "m1", text: "Здравствуйте, сколько стоит тур в Турцию?" } },
          { sender: { id: "IG_OWN" }, recipient: { id: "U1" }, timestamp: 1_760_000_060_000, message: { mid: "m2", text: "Добрый день!", is_echo: true } },
          { sender: { id: "U1" }, recipient: { id: "IG_OWN" }, timestamp: 1_760_000_120_000, message: { mid: "m3", attachments: [{ type: "image", payload: { url: "https://cdn/x.jpg" } }] } },
          { sender: { id: "U1" }, recipient: { id: "IG_OWN" }, timestamp: 1_760_000_180_000, message: { mid: "m4", is_deleted: true } },
          { sender: { id: "U1" }, recipient: { id: "IG_OWN" }, timestamp: 1_760_000_240_000 },
        ],
      },
    ],
  };
  it("входящие, эхо, вложения; удалённые и служебные события пропускаются", () => {
    const r = parseIgWebhook(payload, ["IG_OWN"]);
    expect(r.map((m) => [m.mid, m.userId, m.outgoing])).toEqual([
      ["m1", "U1", false],
      ["m2", "U1", true],
      ["m3", "U1", false],
    ]);
    expect(r[2].attachments).toEqual([{ type: "image", url: "https://cdn/x.jpg", name: undefined }]);
    expect(parseIgWebhook({ object: "page", entry: [] }, [])).toEqual([]);
  });
  it("окно ответа 24 часа", () => {
    const now = Date.parse("2026-10-17T12:00:00Z");
    expect(igCanReply(new Date("2026-10-17T00:00:00Z"), now)).toBe(true);
    expect(igCanReply(new Date("2026-10-16T11:00:00Z"), now)).toBe(false);
    expect(igCanReply(null, now)).toBe(false);
  });
});

describe("Telegram", () => {
  const base: TgMessage = { message_id: 5, date: 1_760_000_000, chat: { id: 77, type: "private", first_name: "Алишер", last_name: "Каримов" } };
  it("текст, подпись, контакт", () => {
    expect(tgText({ ...base, text: "Салом" })).toBe("Салом");
    expect(tgText({ ...base, caption: "фото паспорта" })).toBe("фото паспорта");
    expect(tgText({ ...base, contact: { phone_number: "+998901234567" } })).toBe("📞 +998901234567");
    expect(tgName(base.chat)).toBe("Алишер Каримов");
    expect(tgName({ username: "ali" })).toBe("@ali");
  });
  it("вложения: самое большое фото, голосовое, документ", () => {
    const a = tgAttachments({
      ...base,
      photo: [
        { file_id: "small", width: 90, height: 90 },
        { file_id: "big", width: 1280, height: 1280 },
      ],
      voice: { file_id: "v1" },
      document: { file_id: "d1", file_name: "passport.pdf" },
    });
    expect(a).toEqual([
      { type: "image", fileId: "big" },
      { type: "audio", fileId: "v1", name: "voice.ogg" },
      { type: "file", fileId: "d1", name: "passport.pdf" },
    ]);
  });
});

describe("телефон из сообщения", () => {
  it("находит узбекский номер в разных записях", () => {
    expect(extractPhone("мой номер +998 90 123 45 67, звоните")).toBe("+998901234567");
    expect(extractPhone("90 123-45-67")).toBe("+998901234567");
    expect(extractPhone("998(93)444-00-04")).toBe("+998934440004");
    expect(extractPhone("тур на 7 ночей за 1200$")).toBeNull();
    expect(extractPhone(null)).toBeNull();
  });
  it("превью для списка переписок", () => {
    expect(previewText("  привет  ")).toBe("привет");
    expect(previewText(null, [{ type: "audio" }])).toBe("🎤 Голосовое");
    expect(previewText(null, [])).toBe("");
  });
});

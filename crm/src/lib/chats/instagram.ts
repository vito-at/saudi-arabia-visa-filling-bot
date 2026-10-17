/**
 * Instagram Direct через Messenger Platform (аккаунт Instagram привязан к странице Facebook, токен страницы).
 * Вебхук: object = "instagram", entry[].messaging[] — входящие и «эхо» сообщений, отправленных из приложения Instagram.
 * Ответить клиенту можно в течение 24 часов после его последнего сообщения.
 */
import type { ParsedAttachment } from "./telegram";

export interface IgMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    attachments?: { type: string; payload?: { url?: string; title?: string } }[];
    reply_to?: { story?: { url?: string } };
  };
}

export interface IgWebhookPayload {
  object?: string;
  entry?: { id: string; time: number; messaging?: IgMessagingEvent[] }[];
}

export interface IgParsedMessage {
  /** IGSID клиента */
  userId: string;
  /** сообщение отправлено нами (из приложения Instagram или из CRM) */
  outgoing: boolean;
  mid: string;
  text: string | null;
  attachments: ParsedAttachment[];
  at: Date;
}

const TYPE: Record<string, ParsedAttachment["type"]> = { image: "image", audio: "audio", video: "video", file: "file", ig_reel: "video", reel: "video", story_mention: "image", share: "file" };

/** Сообщения из вебхука; ownIds — id нашего аккаунта Instagram (и страницы), чтобы отличить эхо */
export function parseIgWebhook(payload: IgWebhookPayload, ownIds: string[]): IgParsedMessage[] {
  if (payload.object !== "instagram") return [];
  const out: IgParsedMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const m = ev.message;
      if (!m?.mid || m.is_deleted) continue;
      const outgoing = !!m.is_echo || ownIds.includes(ev.sender.id);
      const userId = outgoing ? ev.recipient.id : ev.sender.id;
      const attachments = (m.attachments ?? []).map((a) => ({ type: TYPE[a.type] ?? "file", url: a.payload?.url, name: a.payload?.title })) as ParsedAttachment[];
      if (m.reply_to?.story?.url) attachments.push({ type: "image", url: m.reply_to.story.url, name: "story" });
      const text = m.text ?? (m.is_unsupported ? "[сообщение, которое Instagram не передаёт в API]" : null);
      out.push({ userId, outgoing, mid: m.mid, text, attachments, at: new Date(ev.timestamp) });
    }
  }
  return out;
}

/** Окно ответа Instagram — 24 часа после последнего сообщения клиента */
export const IG_REPLY_WINDOW_MS = 24 * 3_600_000;

export function igCanReply(lastInboundAt: Date | null, now = Date.now()): boolean {
  return !!lastInboundAt && now - lastInboundAt.getTime() < IG_REPLY_WINDOW_MS;
}

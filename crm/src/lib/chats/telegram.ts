/**
 * Telegram Bot API для переписки с клиентами.
 * Клиент пишет боту — или, если к боту подключён личный аккаунт агентства через Telegram Business,
 * в личку аккаунта: тогда сообщения приходят как business_message, а ответ уходит от имени аккаунта.
 */
import type { TelegramIntegration } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

const API = process.env.TELEGRAM_API_URL || "https://api.telegram.org";

export type FetchFn = typeof fetch;

export class TelegramError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
  }
}

export class TelegramBot {
  constructor(
    private token: string,
    private fetchFn: FetchFn = fetch,
  ) {}

  async call<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
    const res = await this.fetchFn(`${API}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; error_code?: number };
    if (!data.ok) throw new TelegramError(data.description || `HTTP ${res.status}`, data.error_code ?? res.status);
    return data.result as T;
  }

  /** Метод с загрузкой файла (sendPhoto, sendDocument…): multipart/form-data */
  async upload<T>(method: string, fields: Record<string, string | undefined>, file: { field: string; name: string; mime: string; data: Uint8Array }): Promise<T> {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, v);
    form.append(file.field, new Blob([file.data as BlobPart], { type: file.mime }), file.name);
    const res = await this.fetchFn(`${API}/bot${this.token}/${method}`, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; error_code?: number };
    if (!data.ok) throw new TelegramError(data.description || `HTTP ${res.status}`, data.error_code ?? res.status);
    return data.result as T;
  }

  /** Скачать файл по file_id: путь получаем через getFile */
  async download(fileId: string): Promise<{ body: ArrayBuffer; path: string }> {
    const f = await this.call<{ file_path?: string }>("getFile", { file_id: fileId });
    if (!f.file_path) throw new TelegramError("Файл недоступен");
    const res = await this.fetchFn(`${API}/file/bot${this.token}/${f.file_path}`, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new TelegramError(`Файл недоступен (HTTP ${res.status})`);
    return { body: await res.arrayBuffer(), path: f.file_path };
  }
}

export async function getTelegram(): Promise<TelegramIntegration> {
  return (await prisma.telegramIntegration.findUnique({ where: { id: 1 } })) ?? (await prisma.telegramIntegration.create({ data: { id: 1 } }));
}

export function telegramBot(i: TelegramIntegration, fetchFn?: FetchFn): TelegramBot | null {
  const token = decrypt(i.botTokenEnc);
  return token ? new TelegramBot(token, fetchFn) : null;
}

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TgMessage {
  message_id: number;
  date: number;
  chat: { id: number; type: string; first_name?: string; last_name?: string; username?: string; title?: string };
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: { file_id: string; width: number; height: number }[];
  voice?: { file_id: string; duration?: number };
  audio?: { file_id: string; file_name?: string };
  video?: { file_id: string };
  video_note?: { file_id: string };
  document?: { file_id: string; file_name?: string };
  sticker?: { file_id: string; emoji?: string };
  contact?: { phone_number: string; first_name?: string };
  location?: { latitude: number; longitude: number };
  business_connection_id?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  business_message?: TgMessage;
  business_connection?: { id: string; user: TgUser; is_enabled: boolean; can_reply?: boolean; rights?: { can_reply?: boolean } };
}

export interface ParsedAttachment {
  type: "image" | "audio" | "video" | "file" | "sticker" | "location";
  fileId?: string;
  url?: string;
  name?: string;
}

/** Вложения сообщения: фото — самый большой размер, голосовые, видео, документы */
export function tgAttachments(m: TgMessage): ParsedAttachment[] {
  const out: ParsedAttachment[] = [];
  if (m.photo?.length) out.push({ type: "image", fileId: m.photo[m.photo.length - 1].file_id });
  if (m.voice) out.push({ type: "audio", fileId: m.voice.file_id, name: "voice.ogg" });
  if (m.audio) out.push({ type: "audio", fileId: m.audio.file_id, name: m.audio.file_name });
  if (m.video) out.push({ type: "video", fileId: m.video.file_id });
  if (m.video_note) out.push({ type: "video", fileId: m.video_note.file_id });
  if (m.document) out.push({ type: "file", fileId: m.document.file_id, name: m.document.file_name });
  if (m.sticker) out.push({ type: "sticker", fileId: m.sticker.file_id, name: m.sticker.emoji });
  if (m.location) out.push({ type: "location", url: `https://maps.google.com/?q=${m.location.latitude},${m.location.longitude}` });
  return out;
}

/** Текст сообщения: текст или подпись; контакт — номером */
export function tgText(m: TgMessage): string | null {
  if (m.contact) return `📞 ${m.contact.phone_number}`;
  return m.text ?? m.caption ?? null;
}

export function tgName(u: { first_name?: string; last_name?: string; username?: string; title?: string }): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.title || (u.username ? `@${u.username}` : "Telegram");
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileText, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { markChatReadAction, sendChatMessageAction } from "@/app/(app)/chats/actions";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export interface ChatAttachmentView {
  type: "image" | "audio" | "video" | "file" | "sticker" | "location";
  /** готовая ссылка: Instagram CDN или прокси вложений Telegram */
  src: string | null;
  name?: string | null;
}

export interface ChatMessageView {
  id: string;
  direction: "IN" | "OUT";
  text: string | null;
  attachments: ChatAttachmentView[];
  at: string;
  sender: string | null;
}

/** Новые сообщения подтягиваются сами: обновление страницы раз в несколько секунд, пока вкладка открыта */
export function ChatAutoRefresh({ ms = 5000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}

function Attachment({ a }: { a: ChatAttachmentView }) {
  const { t } = useI18n();
  if (!a.src) return <div className="text-xs italic opacity-70">{t("chats.attachmentUnavailable")}</div>;
  if (a.type === "image" || a.type === "sticker")
    return (
      <a href={a.src} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.src} alt={a.name ?? ""} className={cn("rounded-lg object-cover", a.type === "sticker" ? "size-28" : "max-h-72 max-w-full")} loading="lazy" />
      </a>
    );
  if (a.type === "audio") return <audio controls preload="none" src={a.src} className="h-10 max-w-full" />;
  if (a.type === "video") return <video controls preload="none" src={a.src} className="max-h-72 max-w-full rounded-lg" />;
  if (a.type === "location")
    return (
      <a href={a.src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
        <MapPin className="size-4" /> {t("chats.location")}
      </a>
    );
  return (
    <a href={a.src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
      <FileText className="size-4" /> {a.name || t("chats.file")}
    </a>
  );
}

export function ChatMessages({ conversationId, messages, unread, className }: { conversationId: string; messages: ChatMessageView[]; unread: number; className?: string }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.id;
  // прокрутка к последнему сообщению при открытии и при новых сообщениях
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [last, conversationId]);
  // открытый чат — прочитан
  useEffect(() => {
    if (unread > 0) void markChatReadAction(conversationId);
  }, [conversationId, unread, last]);

  let prevDay = "";
  return (
    <div ref={box} className={cn("flex-1 space-y-1.5 overflow-y-auto px-3 py-3 sm:px-4", className)}>
      {!messages.length && <div className="py-10 text-center text-sm text-muted-foreground">{t("chats.noMessages")}</div>}
      {messages.map((m) => {
        const day = formatDate(m.at);
        const showDay = day !== prevDay;
        prevDay = day;
        const out = m.direction === "OUT";
        return (
          <div key={m.id}>
            {showDay && <div className="my-3 text-center text-[11px] text-muted-foreground">{day}</div>}
            <div className={cn("flex", out ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]", out ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card")}>
                {m.attachments.map((a, i) => (
                  <div key={i} className="mb-1">
                    <Attachment a={a} />
                  </div>
                ))}
                {m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
                <div className={cn("mt-0.5 text-right text-[10px]", out ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {out && m.sender ? `${m.sender} · ` : ""}
                  {formatTime(m.at)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChatComposer({ conversationId, blockedReason }: { conversationId: string; blockedReason?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  function send() {
    const body = text.trim();
    if (!body || pending) return;
    start(async () => {
      const res = await sendChatMessageAction(conversationId, body);
      if (!res.ok) return void toast.error(res.error);
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="border-t bg-card p-2 sm:p-3">
      {blockedReason && (
        <p className="mb-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {blockedReason}
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter — отправить, Shift+Enter — новая строка
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={t("chats.placeholder")}
          aria-label={t("chats.placeholder")}
          className="max-h-40 min-h-10 flex-1 resize-none"
        />
        <Button onClick={send} disabled={pending || !text.trim()} size="icon" aria-label={t("chats.send")} title={t("chats.send")}>
          <Send />
        </Button>
      </div>
    </div>
  );
}

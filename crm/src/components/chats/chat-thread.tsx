"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Bot, FileText, FolderInput, MapPin, MessageSquareText, Paperclip, Send, X } from "lucide-react";
import { SaveDocDialog } from "./save-doc-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { markChatReadAction, sendChatMessageAction, setAiPausedAction } from "@/app/(app)/chats/actions";
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
  isAi?: boolean;
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

/** Вложения, которые можно сохранить в CRM как документ клиента */
const SAVABLE = new Set<ChatAttachmentView["type"]>(["image", "file", "video", "audio"]);

export function ChatMessages({
  conversationId,
  messages,
  unread,
  className,
  canSaveDocs = false,
}: {
  conversationId: string;
  messages: ChatMessageView[];
  unread: number;
  className?: string;
  /** есть лид — вложения клиента можно сохранить в его заявки (правая кнопка мыши) */
  canSaveDocs?: boolean;
}) {
  const { t } = useI18n();
  const [menu, setMenu] = useState<{ x: number; y: number; messageId: string; index: number; name: string | null } | null>(null);
  const [saving, setSaving] = useState<{ messageId: string; index: number; name: string | null } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);
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
                {m.attachments.map((a, i) => {
                  const savable = canSaveDocs && !out && SAVABLE.has(a.type) && !!a.src;
                  return (
                    <div
                      key={i}
                      className={cn("group/att relative mb-1", savable && "cursor-context-menu")}
                      onContextMenu={
                        savable
                          ? (e) => {
                              e.preventDefault();
                              setMenu({ x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 60), messageId: m.id, index: i, name: a.name ?? null });
                            }
                          : undefined
                      }
                    >
                      <Attachment a={a} />
                      {savable && (
                        // на телефоне правой кнопки нет — та же команда кнопкой
                        <button
                          type="button"
                          onClick={() => setSaving({ messageId: m.id, index: i, name: a.name ?? null })}
                          title={t("docs.saveToCrm")}
                          aria-label={t("docs.saveToCrm")}
                          className="absolute top-1 right-1 rounded-md bg-card/90 p-1 text-foreground shadow-sm sm:opacity-0 sm:group-hover/att:opacity-100"
                        >
                          <FolderInput className="size-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
                <div className={cn("mt-0.5 text-right text-[10px]", out ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {out && m.isAi ? `🤖 ${t("ai.badge")} · ` : out && m.sender ? `${m.sender} · ` : ""}
                  {formatTime(m.at)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {menu && (
        <div className="fixed z-50 min-w-48 rounded-md border bg-card p-1 text-sm shadow-lg" style={{ left: menu.x, top: menu.y }} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setSaving({ messageId: menu.messageId, index: menu.index, name: menu.name });
              setMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-accent"
          >
            <FolderInput className="size-4" /> {t("docs.saveToCrm")}
          </button>
        </div>
      )}
      {saving && <SaveDocDialog conversationId={conversationId} messageId={saving.messageId} index={saving.index} fileName={saving.name} onClose={() => setSaving(null)} />}
    </div>
  );
}

export interface ComposerTemplate {
  id: string;
  title: string;
  text: string;
}

/** Ответ клиенту: текст, быстрые ответы (шаблоны) и файлы — фото, документы, видео */
export function ChatComposer({
  conversationId,
  blockedReason,
  templates = [],
  clientName,
}: {
  conversationId: string;
  blockedReason?: string | null;
  templates?: ComposerTemplate[];
  clientName?: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showTpl, setShowTpl] = useState(false);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  function send() {
    const body = text.trim();
    if (pending || (!body && !file)) return;
    start(async () => {
      if (file) {
        const form = new FormData();
        form.append("conversationId", conversationId);
        form.append("caption", body);
        form.append("file", file);
        const r = await fetch("/api/chats/send-file", { method: "POST", body: form }).catch(() => null);
        const res = (await r?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res?.ok) return void toast.error(res?.error ?? t("common.errorGeneric"));
        setFile(null);
      } else {
        const res = await sendChatMessageAction(conversationId, body);
        if (!res.ok) return void toast.error(res.error);
      }
      setText("");
      router.refresh();
    });
  }

  function insertTemplate(tp: ComposerTemplate) {
    // {name} (или {имя}) — имя клиента (первое слово), если оно известно
    const first = clientName?.trim().split(/\s+/)[0] ?? "";
    const filled = tp.text.replace(/\{(name|имя)\}/gi, first).replace(/^,\s*/, "").replace(/\s+,/g, ",");
    setText((cur) => (cur.trim() ? `${cur.trimEnd()}\n${filled}` : filled));
    setShowTpl(false);
    area.current?.focus();
  }

  return (
    <div className="relative border-t bg-card p-2 sm:p-3">
      {blockedReason && (
        <p className="mb-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {blockedReason}
        </p>
      )}
      {showTpl && (
        <div className="absolute right-2 bottom-full left-2 z-20 mb-1 max-h-72 overflow-y-auto rounded-lg border bg-card p-1 shadow-lg sm:left-auto sm:w-96">
          {!templates.length && <p className="p-3 text-sm text-muted-foreground">{t("tpl.none")}</p>}
          {templates.map((tp) => (
            <button key={tp.id} type="button" onClick={() => insertTemplate(tp)} className="block w-full rounded-md px-3 py-2 text-left hover:bg-accent">
              <div className="text-sm font-medium">{tp.title}</div>
              <div className="line-clamp-2 text-xs text-muted-foreground">{tp.text}</div>
            </button>
          ))}
        </div>
      )}
      {file && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
          <Paperclip className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="shrink-0 text-muted-foreground">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</span>
          <button type="button" onClick={() => setFile(null)} title={t("tpl.removeFile")} aria-label={t("tpl.removeFile")} className="rounded p-0.5 hover:bg-accent">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1.5 sm:gap-2">
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="ghost" size="icon" onClick={() => fileInput.current?.click()} disabled={pending} title={t("tpl.attach")} aria-label={t("tpl.attach")}>
          <Paperclip />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => setShowTpl(!showTpl)} disabled={pending} title={t("tpl.pick")} aria-label={t("tpl.pick")} className={cn(showTpl && "bg-accent")}>
          <MessageSquareText />
        </Button>
        <Textarea
          ref={area}
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
          placeholder={file ? t("tpl.captionPh") : t("chats.placeholder")}
          aria-label={t("chats.placeholder")}
          className="max-h-40 min-h-10 flex-1 resize-none"
        />
        <Button onClick={send} disabled={pending || (!text.trim() && !file)} size="icon" aria-label={t("chats.send")} title={pending ? t("tpl.sending") : t("chats.send")}>
          <Send />
        </Button>
      </div>
    </div>
  );
}

/** Переключатель ИИ-ассистента в переписке: зелёный — отвечает, серый — молчит */
export function AiToggle({ conversationId, paused }: { conversationId: string; paused: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={`${paused ? t("ai.paused") : t("ai.active")}. ${paused ? t("ai.resume") : t("ai.pause")}`}
      onClick={() =>
        start(async () => {
          const r = await setAiPausedAction(conversationId, !paused);
          if (!r.ok) toast.error(r.error);
        })
      }
      className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs", paused ? "text-muted-foreground hover:bg-accent" : "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300")}
    >
      <Bot className="size-3.5" /> {t("ai.badge")}
    </button>
  );
}

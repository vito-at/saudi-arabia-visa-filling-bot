"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Bot, CheckCheck, Eye, FileText, FolderInput, MapPin, MessageSquareText, Paperclip, Send, X } from "lucide-react";
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

/** «Хвостик» пузыря у последнего сообщения группы — как в Telegram */
function BubbleTail({ out }: { out: boolean }) {
  return (
    <svg viewBox="0 0 11 20" width="11" height="20" aria-hidden className={cn("absolute bottom-0", out ? "-right-[9px]" : "-left-[9px] -scale-x-100")}>
      <path d="M0 0v20h11C6 20 2 16 0 9z" fill={out ? "var(--tg-out)" : "var(--tg-in)"} />
    </svg>
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
  const { t, locale } = useI18n();
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

  // подпись дня, как в Telegram: «Сегодня», «Вчера», «23 октября» (год — только у прошлых лет)
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const key = (x: Date) => formatDate(x);
    const now = new Date();
    if (key(d) === key(now)) return t("chats.today");
    if (key(d) === key(new Date(now.getTime() - 86_400_000))) return t("chats.yesterday");
    const sameYear = d.getFullYear() === now.getFullYear();
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale === "uz" ? "uz-Latn" : "ru-RU", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }), timeZone: "Asia/Tashkent" }).format(d);
  };

  return (
    <div ref={box} className={cn("tg-chat-bg flex-1 overflow-y-auto px-2 py-3 sm:px-6", className)}>
      {!messages.length && (
        <div className="py-10 text-center">
          <span className="rounded-full px-3 py-1 text-xs text-white" style={{ background: "var(--tg-day)" }}>
            {t("chats.noMessages")}
          </span>
        </div>
      )}
      <div className="mx-auto max-w-3xl">
      {messages.map((m, idx) => {
        const day = formatDate(m.at);
        const prev = messages[idx - 1];
        const next = messages[idx + 1];
        const showDay = !prev || formatDate(prev.at) !== day;
        const out = m.direction === "OUT";
        // сообщения одной стороны подряд — группа, как в Telegram: «хвостик» у последнего, промежуток меньше
        const lastInGroup = !next || next.direction !== m.direction || formatDate(next.at) !== day;
        const firstInGroup = showDay || !prev || prev.direction !== m.direction;
        // кто из сотрудников ответил — в начале группы (у клиента имя не нужно: собеседник один)
        const author = out && firstInGroup ? (m.isAi ? `🤖 ${t("ai.badge")}` : m.sender) : null;
        const onlyMedia = !m.text && m.attachments.length > 0 && m.attachments.every((a) => a.type === "image" || a.type === "sticker" || a.type === "video");
        return (
          <div key={m.id}>
            {showDay && (
              <div className="sticky top-1 z-10 my-2 flex justify-center">
                <span className="rounded-full px-2.5 py-0.5 text-[13px] font-medium text-white" style={{ background: "var(--tg-day)" }}>
                  {dayLabel(m.at)}
                </span>
              </div>
            )}
            <div className={cn("flex", out ? "justify-end" : "justify-start", lastInGroup ? "mb-2" : "mb-0.5")}>
              <div
                className={cn(
                  "relative max-w-[85%] text-[15px] leading-snug shadow-[0_1px_2px_rgb(0_0_0/0.15)] sm:max-w-[65%]",
                  onlyMedia ? "overflow-hidden rounded-2xl p-0.5" : "rounded-2xl px-2.5 pt-1.5 pb-1",
                  lastInGroup && (out ? "rounded-br-[6px]" : "rounded-bl-[6px]"),
                )}
                style={{ background: out ? "var(--tg-out)" : "var(--tg-in)", color: "var(--tg-text)" }}
              >
                {author && <div className="mb-0.5 text-[13px] font-semibold" style={{ color: "var(--tg-accent)" }}>{author}</div>}
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
                {m.text && (
                  <div className="whitespace-pre-wrap break-words">
                    {m.text}
                    {/* место под время, чтобы оно не наезжало на текст — как в Telegram */}
                    <span className="inline-block w-14" aria-hidden />
                  </div>
                )}
                <div
                  className={cn("flex items-center justify-end gap-0.5 text-[11px] leading-none", m.text ? "-mt-3.5 float-right" : onlyMedia ? "absolute right-2 bottom-2 rounded-full bg-black/40 px-1.5 py-0.5 text-white" : "mt-0.5")}
                  style={onlyMedia ? undefined : { color: out ? "var(--tg-out-meta)" : "var(--tg-meta)" }}
                >
                  {formatTime(m.at)}
                  {out && <CheckCheck className="size-3.5" aria-label={t("chats.sent")} />}
                </div>
                {lastInGroup && <BubbleTail out={out} />}
              </div>
            </div>
          </div>
        );
      })}
      </div>
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
  readOnly,
  templates = [],
  clientName,
}: {
  conversationId: string;
  blockedReason?: string | null;
  /** переписка сотрудника, открытая администратором для контроля: ответить нельзя */
  readOnly?: string | null;
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

  if (readOnly)
    return (
      <div className="tg-chat-bg px-2 pb-3 pt-1 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm text-muted-foreground shadow-sm" style={{ background: "var(--tg-composer)" }}>
          <Eye className="size-4 shrink-0" /> {readOnly}
        </div>
      </div>
    );

  return (
    <div className="tg-chat-bg px-2 pb-3 pt-1 sm:px-6">
      <div className="relative mx-auto max-w-3xl">
      {blockedReason && (
        <p className="mb-2 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm">
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
        <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs shadow-sm" style={{ background: "var(--tg-composer)" }}>
          <Paperclip className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="shrink-0 text-muted-foreground">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</span>
          <button type="button" onClick={() => setFile(null)} title={t("tpl.removeFile")} aria-label={t("tpl.removeFile")} className="rounded p-0.5 hover:bg-accent">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 items-end rounded-2xl pl-1 pr-1 shadow-[0_1px_2px_rgb(0_0_0/0.15)]" style={{ background: "var(--tg-composer)" }}>
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
        <Button type="button" variant="ghost" size="icon" onClick={() => setShowTpl(!showTpl)} disabled={pending} title={t("tpl.pick")} aria-label={t("tpl.pick")} className={cn("shrink-0 rounded-full text-muted-foreground hover:bg-transparent hover:text-[var(--tg-accent)]", showTpl && "text-[var(--tg-accent)]")}>
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
          className="max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-[15px] shadow-none focus-visible:ring-0"
        />
        <Button type="button" variant="ghost" size="icon" onClick={() => fileInput.current?.click()} disabled={pending} title={t("tpl.attach")} aria-label={t("tpl.attach")} className="shrink-0 rounded-full text-muted-foreground hover:bg-transparent hover:text-[var(--tg-accent)]">
          <Paperclip className="-rotate-45" />
        </Button>
        </div>
        <button
          type="button"
          onClick={send}
          disabled={pending || (!text.trim() && !file)}
          aria-label={t("chats.send")}
          title={pending ? t("tpl.sending") : t("chats.send")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-opacity disabled:opacity-60"
          style={{ background: "var(--tg-accent)" }}
        >
          <Send className="size-5 -translate-x-px translate-y-px" />
        </button>
      </div>
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

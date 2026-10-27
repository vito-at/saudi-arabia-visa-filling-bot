"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, Link2, Lock, Unlink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { telegramLinkAction, telegramOptionsAction, telegramUnlinkAction, telegramUnlinkUserAction } from "@/app/(app)/chats/telegram/actions";

export interface MyTelegramView {
  linked: boolean;
  tgName: string | null;
  tgUsername: string | null;
  connected: boolean;
  canReply: boolean;
  createLeads: boolean;
  aiEnabled: boolean;
}

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold", done ? "bg-emerald-500 text-white" : "text-white")} style={done ? undefined : { background: "var(--tg-accent)" }}>
        {done ? <Check className="size-4" /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <div className="font-medium">{title}</div>
        {children}
      </div>
    </li>
  );
}

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "" : "bg-muted-foreground/30")}
        style={checked ? { background: "var(--tg-accent)" } : undefined}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

/** Подключение своего Telegram: ссылка для привязки, инструкция Telegram Business, статус и настройки */
export function MyTelegram({ botReady, bot, account, aiAvailable, isAdmin }: { botReady: boolean; bot: string | null; account: MyTelegramView | null; aiAvailable: boolean; isAdmin: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  if (!botReady)
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        {t("tgacc.botOff")}
      </Card>
    );

  const linked = !!account?.linked;
  const connected = linked && !!account?.connected;
  const ready = connected && !!account?.canReply;

  return (
    <Card className="space-y-5 p-5">
      <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-[var(--tg-accent)]" />
        {isAdmin ? t("tgacc.privacyAdmin") : t("tgacc.privacyStaff")}
      </p>
      <ol className="space-y-5">
        <Step n={1} done={linked} title={t("tgacc.step1")}>
          {linked ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {account?.tgName}
                {account?.tgUsername ? ` · @${account.tgUsername}` : ""}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (!confirm(t("tgacc.unlinkConfirm"))) return;
                  start(async () => {
                    const r = await telegramUnlinkAction();
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(t("tgacc.unlinked"), { duration: 10_000 });
                  });
                }}
              >
                <Unlink /> {t("tgacc.unlink")}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("tgacc.step1Hint")}</p>
              {link ? (
                <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--tg-accent)" }}>
                  <ExternalLink className="size-4" /> {t("tgacc.openTelegram")}
                </a>
              ) : (
                <Button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await telegramLinkAction();
                      if (!r.ok) return void toast.error(r.error);
                      if (!r.data) return;
                      setLink(r.data.url);
                      window.open(r.data.url, "_blank");
                    })
                  }
                >
                  <Link2 /> {t("tgacc.getLink")}
                </Button>
              )}
            </>
          )}
        </Step>
        <Step n={2} done={ready} title={t("tgacc.step2")}>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("tgacc.step2a")}</li>
            <li>{t("tgacc.step2b", { bot: `@${bot}` })}</li>
            <li>{t("tgacc.step2c")}</li>
            <li>{t("tgacc.step2d")}</li>
          </ol>
          <p className="text-xs text-muted-foreground">{t("tgacc.premium")}</p>
          {linked && (
            <p className={cn("text-sm font-medium", ready ? "text-emerald-700" : "text-amber-700")}>
              {ready ? t("tgacc.state.ok") : connected ? t("tgacc.state.noReply") : t("tgacc.waiting")}
            </p>
          )}
        </Step>
      </ol>
      {linked && account && (
        <div className="space-y-4 border-t pt-4">
          <Toggle
            checked={account.createLeads}
            disabled={pending}
            onChange={(v) =>
              start(async () => {
                const r = await telegramOptionsAction({ createLeads: v });
                if (!r.ok) toast.error(r.error);
              })
            }
            label={t("tgacc.createLeads")}
            hint={t("tgacc.createLeadsHint")}
          />
          {aiAvailable && (
            <Toggle
              checked={account.aiEnabled}
              disabled={pending}
              onChange={(v) =>
                start(async () => {
                  const r = await telegramOptionsAction({ aiEnabled: v });
                  if (!r.ok) toast.error(r.error);
                })
              }
              label={t("tgacc.ai")}
              hint={t("tgacc.aiHint")}
            />
          )}
        </div>
      )}
    </Card>
  );
}

/** Администратор отвязывает Telegram сотрудника */
export function StaffUnlinkButton({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("tgacc.unlinkStaffConfirm"))) return;
        start(async () => {
          const r = await telegramUnlinkUserAction(userId);
          if (!r.ok) toast.error(r.error);
        });
      }}
    >
      <Unlink /> {t("tgacc.unlink")}
    </Button>
  );
}

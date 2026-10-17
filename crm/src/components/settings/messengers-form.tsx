"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { ChannelIcon } from "@/components/chats/channel-icon";
import { connectInstagramAction, disableInstagramAction, disableTelegramAction, saveTelegramAction } from "@/app/(app)/settings/chat-actions";
import { useI18n } from "@/i18n/client";

export interface MessengersView {
  tg: { enabled: boolean; botUsername: string | null; hasToken: boolean; lastEventAt: string | null; businessUser: string | null; lastError: string | null };
  ig: { enabled: boolean; username: string | null; lastEventAt: string | null; metaReady: boolean };
  webhookUrl: string;
  verifyToken: string | null;
  chats: { INSTAGRAM: number; TELEGRAM: number };
}

function State({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <span>{children}</span>
    </div>
  );
}

export function MessengersForm({ v }: { v: MessengersView }) {
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(typeof res.data === "string" ? res.data : t("common.saved"));
      setToken("");
    });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChannelIcon channel="TELEGRAM" className="size-5" /> Telegram
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <State ok={v.tg.enabled}>{v.tg.enabled ? t("chatset.tgOn", { bot: `@${v.tg.botUsername}` }) : t("chatset.tgOff")}</State>
            {v.tg.enabled && <State ok={!!v.tg.businessUser}>{v.tg.businessUser ? t("chatset.tgBusinessOn", { name: v.tg.businessUser }) : t("chatset.tgBusinessOff")}</State>}
            {v.tg.enabled && <p className="pl-6 text-xs text-muted-foreground">{t("chatset.stats", { n: v.chats.TELEGRAM, at: v.tg.lastEventAt ?? "—" })}</p>}
            {v.tg.lastError && <p className="pl-6 text-xs text-red-600">{v.tg.lastError}</p>}
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("chatset.tgStep1")}</li>
            <li>{t("chatset.tgStep2")}</li>
            <li>{t("chatset.tgStep3")}</li>
          </ol>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("chatset.tgToken")} className="min-w-0 flex-1 basis-72">
              <Input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={v.tg.hasToken ? t("chatset.tgTokenSaved") : "123456789:AA…"} />
            </Field>
            <Button disabled={pending || (!token.trim() && !v.tg.hasToken)} onClick={() => run(() => saveTelegramAction(token))}>
              {v.tg.enabled ? t("chatset.reconnect") : t("chatset.connect")}
            </Button>
            {v.tg.enabled && (
              <Button variant="outline" disabled={pending} onClick={() => run(() => disableTelegramAction())}>
                {t("chatset.disable")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChannelIcon channel="INSTAGRAM" className="size-5" /> Instagram Direct
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <State ok={v.ig.enabled}>{v.ig.enabled ? t("chatset.igOn", { name: v.ig.username ? `@${v.ig.username}` : "Instagram" }) : t("chatset.igOff")}</State>
            {v.ig.enabled && <p className="pl-6 text-xs text-muted-foreground">{t("chatset.stats", { n: v.chats.INSTAGRAM, at: v.ig.lastEventAt ?? "—" })}</p>}
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>{t("chatset.igStep1")}</li>
            <li>
              {t("chatset.igStep2")}{" "}
              <code className="break-all rounded bg-muted px-1 text-xs text-foreground">{v.webhookUrl}</code>
              {v.verifyToken && (
                <>
                  {" "}
                  · Verify token: <code className="rounded bg-muted px-1 text-xs text-foreground">{v.verifyToken}</code>
                </>
              )}
            </li>
            <li>{t("chatset.igStep3")}</li>
            <li>{t("chatset.igStep4")}</li>
          </ol>
          {!v.ig.metaReady && <p className="text-sm text-amber-700">{t("chatset.igNeedMeta")}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending || !v.ig.metaReady} onClick={() => run(() => connectInstagramAction())}>
              {v.ig.enabled ? t("chatset.reconnect") : t("chatset.connect")}
            </Button>
            {v.ig.enabled && (
              <Button variant="outline" disabled={pending} onClick={() => run(() => disableInstagramAction())}>
                {t("chatset.disable")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

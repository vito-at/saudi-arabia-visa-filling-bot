"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import { changeStatusAction } from "@/app/(app)/leads/actions";
import { LossDialog } from "./loss-dialog";
import { DealDialog, type DealDialogProps } from "@/components/deals/deal-dialog";
import type { LeadPrefill } from "@/lib/deals";
import { CallbackDialog } from "@/components/callbacks/callback-dialog";
import { CallbackBadge } from "@/components/callbacks/callback-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = { id: string; name: string; color: string; kind: string };

/**
 * Хук смены статуса: сам открывает диалог причины отказа или сделки, если это нужно.
 * Используется и в карточке, и на канбане.
 */
export function useStatusChanger({ reasons, rate, lead }: { reasons: { id: string; name: string }[]; rate: number; lead?: LeadPrefill | null }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [loss, setLoss] = useState<{ leadId: string; statusId: string; onDone?: (ok: boolean) => void } | null>(null);
  const [deal, setDeal] = useState<{ leadId: string; statusId: string; onDone?: (ok: boolean) => void } | null>(null);
  const [callback, setCallback] = useState<{ leadId: string; statusId: string; initial?: string | null; onDone?: (ok: boolean) => void } | null>(null);

  function change(leadId: string, status: Status, onDone?: (ok: boolean) => void, initialCallback?: string | null) {
    if (status.kind === "LOST") return setLoss({ leadId, statusId: status.id, onDone });
    if (status.kind === "CALLBACK") return setCallback({ leadId, statusId: status.id, initial: initialCallback, onDone });
    if (status.kind === "WON") return setDeal({ leadId, statusId: status.id, onDone });
    start(async () => {
      const res = await changeStatusAction(leadId, status.id);
      if (!res.ok) toast.error(res.error);
      else toast.success(t("status.changed", { name: status.name }));
      onDone?.(res.ok);
    });
  }

  const dialogs = (
    <>
      <LossDialog
        key={loss?.leadId ?? "none"}
        open={!!loss}
        reasons={reasons}
        pending={pending}
        onOpenChange={(v) => {
          if (!v) {
            loss?.onDone?.(false);
            setLoss(null);
          }
        }}
        onConfirm={(reasonId, comment) =>
          start(async () => {
            if (!loss) return;
            const res = await changeStatusAction(loss.leadId, loss.statusId, { lossReasonId: reasonId, lossComment: comment });
            if (!res.ok) return void toast.error(res.error);
            toast.success(t("status.lostDone"));
            loss.onDone?.(true);
            setLoss(null);
          })
        }
      />
      {callback && (
        <CallbackDialog
          open
          initial={callback.initial}
          pending={pending}
          onOpenChange={(v) => {
            if (!v) {
              callback.onDone?.(false);
              setCallback(null);
            }
          }}
          onConfirm={(at) =>
            start(async () => {
              const res = await changeStatusAction(callback.leadId, callback.statusId, { callbackAt: at });
              if (!res.ok) return void toast.error(res.error);
              toast.success(t("status.callbackSet"));
              callback.onDone?.(true);
              setCallback(null);
            })
          }
        />
      )}
      {deal && (
        <DealDialog
          open
          leadId={deal.leadId}
          wonStatusId={deal.statusId}
          rate={rate}
          lead={lead}
          onOpenChange={(v: boolean) => {
            if (!v) {
              deal.onDone?.(false);
              setDeal(null);
            }
          }}
          onSaved={() => {
            deal.onDone?.(true);
            setDeal(null);
          }}
        />
      )}
    </>
  );

  return { change, pending, dialogs };
}

export function StatusControl({
  leadId,
  current,
  statuses,
  reasons,
  rate,
  callbackAt,
  lead,
  since,
}: {
  leadId: string;
  current: Status;
  statuses: Status[];
  reasons: { id: string; name: string }[];
  rate: number;
  callbackAt?: string | null;
  /** данные лида для окна сделки */
  lead?: LeadPrefill | null;
  /** когда лид перешёл в текущий статус — сколько он на этом этапе */
  since?: string | null;
}) {
  const { change, pending, dialogs } = useStatusChanger({ reasons, rate, lead });
  const { t, f } = useI18n();
  // порядок этапов: «Отказ» всегда в конце
  statuses = [...statuses.filter((s) => s.kind !== "LOST"), ...statuses.filter((s) => s.kind === "LOST")];
  const currentIndex = statuses.findIndex((s) => s.id === current.id);
  // на узком экране полоса этапов прокручивается к текущему (без прокрутки всей страницы)
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>("[data-active]");
    if (strip.current && el) strip.current.scrollLeft = el.offsetLeft - (strip.current.clientWidth - el.offsetWidth) / 2;
  }, [current.id]);
  return (
    <>
      {/* этапы стрелками: пройденные — светлым цветом этапа, текущий — ярким, «Отказ» — отдельно в конце */}
      <div ref={strip} className="no-scrollbar -mx-1 flex overflow-x-auto px-1 pb-1">
        {statuses.map((s, i) => {
          const active = s.id === current.id;
          const passed = !active && current.kind !== "LOST" && i < currentIndex && s.kind !== "LOST";
          const lost = s.kind === "LOST";
          return (
            <button
              key={s.id}
              type="button"
              data-active={active || undefined}
              disabled={pending || (active && s.kind !== "LOST" && s.kind !== "CALLBACK")}
              onClick={() => change(leadId, s, undefined, s.kind === "CALLBACK" ? callbackAt : undefined)}
              className={cn(
                "relative h-9 shrink-0 cursor-pointer whitespace-nowrap pl-5 pr-4 text-xs font-medium transition-[filter] hover:brightness-95 disabled:cursor-default",
                i > 0 && "-ml-2",
                lost && "ml-2",
              )}
              style={{
                clipPath: i === 0 || lost ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)" : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)",
                ...(active ? { backgroundColor: s.color, color: "#fff" } : passed ? { backgroundColor: `${s.color}2e`, color: s.color } : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }),
              }}
              title={active ? t("status.current") : t("status.moveTo", { name: s.name })}
            >
              {s.name}
            </button>
          );
        })}
      </div>
      {since && <p suppressHydrationWarning className="mt-1.5 text-xs text-muted-foreground">{t("status.onStage", { name: current.name, time: f.duration(Math.max(1, Math.round((Date.now() - new Date(since).getTime()) / 60000))) })}</p>}
      {current.kind === "CALLBACK" && callbackAt && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-sm">
          <span>
            {t("status.callbackAt")} <b>{formatDateTime(callbackAt)}</b>
          </span>
          <CallbackBadge at={callbackAt} />
          <Button size="sm" variant="outline" className="ml-auto" disabled={pending} onClick={() => change(leadId, current, undefined, callbackAt)}>
            {t("status.reschedule")}
          </Button>
        </div>
      )}
      {dialogs}
    </>
  );
}

export type { DealDialogProps };

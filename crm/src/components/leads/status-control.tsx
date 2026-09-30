"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { changeStatusAction } from "@/app/(app)/leads/actions";
import { LossDialog } from "./loss-dialog";
import { DealDialog, type DealDialogProps } from "@/components/deals/deal-dialog";
import { CallbackDialog } from "@/components/callbacks/callback-dialog";
import { CallbackBadge } from "@/components/callbacks/callback-badge";
import { Button } from "@/components/ui/button";

type Status = { id: string; name: string; color: string; kind: string };

/**
 * Хук смены статуса: сам открывает диалог причины отказа или сделки, если это нужно.
 * Используется и в карточке, и на канбане.
 */
export function useStatusChanger({ reasons, rate }: { reasons: { id: string; name: string }[]; rate: number }) {
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
      else toast.success(`Статус: ${status.name}`);
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
            toast.success("Лид переведён в «Отказ»");
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
              toast.success("Звонок запланирован, менеджер получит напоминание");
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
}: {
  leadId: string;
  current: Status;
  statuses: Status[];
  reasons: { id: string; name: string }[];
  rate: number;
  callbackAt?: string | null;
}) {
  const { change, pending, dialogs } = useStatusChanger({ reasons, rate });
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {statuses.map((s) => {
          const active = s.id === current.id;
          return (
            <button
              key={s.id}
              type="button"
              disabled={pending || (active && s.kind !== "LOST" && s.kind !== "CALLBACK")}
              onClick={() => change(leadId, s, undefined, s.kind === "CALLBACK" ? callbackAt : undefined)}
              className="rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer disabled:cursor-default"
              style={active ? { backgroundColor: s.color, borderColor: s.color, color: "#fff" } : { color: s.color, borderColor: `${s.color}55` }}
              title={active ? "Текущий статус" : `Перевести в «${s.name}»`}
            >
              {s.name}
            </button>
          );
        })}
      </div>
      {current.kind === "CALLBACK" && callbackAt && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-sm">
          <span>
            Перезвонить: <b>{formatDateTime(callbackAt)}</b>
          </span>
          <CallbackBadge at={callbackAt} />
          <Button size="sm" variant="outline" className="ml-auto" disabled={pending} onClick={() => change(leadId, current, undefined, callbackAt)}>
            Перенести звонок
          </Button>
        </div>
      )}
      {dialogs}
    </>
  );
}

export type { DealDialogProps };

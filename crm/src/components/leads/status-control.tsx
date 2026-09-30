"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeStatusAction } from "@/app/(app)/leads/actions";
import { LossDialog } from "./loss-dialog";
import { DealDialog, type DealDialogProps } from "@/components/deals/deal-dialog";

type Status = { id: string; name: string; color: string; kind: string };

/**
 * Хук смены статуса: сам открывает диалог причины отказа или сделки, если это нужно.
 * Используется и в карточке, и на канбане.
 */
export function useStatusChanger({ reasons, rate }: { reasons: { id: string; name: string }[]; rate: number }) {
  const [pending, start] = useTransition();
  const [loss, setLoss] = useState<{ leadId: string; statusId: string; onDone?: (ok: boolean) => void } | null>(null);
  const [deal, setDeal] = useState<{ leadId: string; statusId: string; onDone?: (ok: boolean) => void } | null>(null);

  function change(leadId: string, status: Status, onDone?: (ok: boolean) => void) {
    if (status.kind === "LOST") return setLoss({ leadId, statusId: status.id, onDone });
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
            const res = await changeStatusAction(loss.leadId, loss.statusId, reasonId, comment);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Лид переведён в «Отказ»");
            loss.onDone?.(true);
            setLoss(null);
          })
        }
      />
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
}: {
  leadId: string;
  current: Status;
  statuses: Status[];
  reasons: { id: string; name: string }[];
  rate: number;
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
              disabled={pending || (active && s.kind !== "LOST")}
              onClick={() => change(leadId, s)}
              className="rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer disabled:cursor-default"
              style={active ? { backgroundColor: s.color, borderColor: s.color, color: "#fff" } : { color: s.color, borderColor: `${s.color}55` }}
              title={active ? "Текущий статус" : `Перевести в «${s.name}»`}
            >
              {s.name}
            </button>
          );
        })}
      </div>
      {dialogs}
    </>
  );
}

export type { DealDialogProps };

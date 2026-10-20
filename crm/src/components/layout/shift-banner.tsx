"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setShiftAction } from "@/app/(app)/shift-actions";

/** Менеджер «не в работе»: напоминание сверху, что лиды не приходят, и кнопка начать работу */
export function ShiftBanner({ text, action }: { text: string; action: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 lg:px-8 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
      <PauseCircle className="size-4 shrink-0" />
      <span className="flex-1">{text}</span>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setShiftAction(true);
            if (!res.ok) toast.error(res.error);
          })
        }
      >
        {action}
      </Button>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions";

/** Запуск server action с тостом об успехе/ошибке */
export function useRun() {
  const [pending, start] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, success?: string, onOk?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        const msg = typeof res.data === "string" ? res.data : success;
        if (msg) toast.success(msg);
        onOk?.();
      } else toast.error(res.error, { duration: 8000 });
    });
  return { pending, run };
}

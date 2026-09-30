"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncNowAction } from "@/app/(app)/settings/integration-actions";

export function SyncNowButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await syncNowAction();
          if (!res.ok) toast.error(res.error);
          else toast.success(res.data ?? "Готово");
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : ""} /> {pending ? "Загрузка…" : "Загрузить сейчас"}
    </Button>
  );
}

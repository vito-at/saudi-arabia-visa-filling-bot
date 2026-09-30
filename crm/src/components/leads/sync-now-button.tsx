"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncNowAction } from "@/app/(app)/settings/integration-actions";
import { useI18n } from "@/i18n/client";

export function SyncNowButton() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await syncNowAction();
          if (!res.ok) toast.error(res.error);
          else toast.success(res.data ?? t("common.done"));
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : ""} /> {pending ? t("leads.syncing") : t("leads.syncNow")}
    </Button>
  );
}

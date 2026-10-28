"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyCountryAction } from "@/app/(app)/countries/actions";
import { useI18n } from "@/i18n/client";

/** Администратор подтверждает, что проверил информацию (или снимает отметку) */
export function VerifyButton({ id, verified }: { id: string; verified: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={verified ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (verified && !confirm(t("countries.unverifyConfirm"))) return;
          const res = await verifyCountryAction(id, !verified);
          if (!res.ok) return void toast.error(res.error);
          toast.success(verified ? t("countries.unverified") : t("countries.verifiedOk"));
        })
      }
    >
      {verified ? <ShieldOff /> : <ShieldCheck />} {verified ? t("countries.unverify") : t("countries.verify")}
    </Button>
  );
}

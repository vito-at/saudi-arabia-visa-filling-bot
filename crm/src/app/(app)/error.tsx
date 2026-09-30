"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-semibold">{t("errorPage.title")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("errorPage.text")}</p>
      {error.digest && <p className="text-xs text-muted-foreground">{t("errorPage.code", { code: error.digest })}</p>}
      <Button onClick={reset}>{t("common.retry")}</Button>
    </div>
  );
}

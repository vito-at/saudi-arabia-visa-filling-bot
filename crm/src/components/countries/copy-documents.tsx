"use client";

import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

/** Скопировать список документов — чтобы отправить клиенту в мессенджер */
export function CopyDocuments({ name, lines }: { name: string; lines: string[] }) {
  const { t } = useI18n();
  const text = `${t("countries.copyTitle", { name })}\n${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => void navigator.clipboard?.writeText(text).then(() => toast.success(t("countries.copied")))}
    >
      <Copy /> {t("countries.copy")}
    </Button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

/** Свой период: даты применяются только по кнопке «Показать» (или Enter), а не на каждое изменение поля. */
export function PeriodRange({ from, to, onApply }: { from: string; to: string; onApply: (from: string, to: string) => void }) {
  const { t } = useI18n();
  const [f, setF] = useState(from);
  const [tt, setT] = useState(to);
  useEffect(() => {
    setF(from);
    setT(to);
  }, [from, to]);

  const valid = !!f && !!tt && f <= tt;
  const changed = f !== from || tt !== to;

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onApply(f, tt);
      }}
    >
      <Input type="date" className="w-40" value={f} max={tt || undefined} onChange={(e) => setF(e.target.value)} aria-label={t("period.from")} />
      <span className="text-muted-foreground">—</span>
      <Input type="date" className="w-40" value={tt} min={f || undefined} onChange={(e) => setT(e.target.value)} aria-label={t("period.to")} />
      <Button type="submit" size="sm" variant={changed ? "default" : "outline"} disabled={!valid}>
        <Search /> {t("period.show")}
      </Button>
    </form>
  );
}

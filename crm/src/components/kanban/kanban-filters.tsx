"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, NativeSelect } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";

export function KanbanFilters({ managers }: { managers: { id: string; name: string }[] | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const push = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    router.push(`${pathname}?${next.toString()}`);
  };
  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
      <form
        className="w-full sm:w-auto"
        onSubmit={(e) => {
          e.preventDefault();
          push("q", q);
        }}
      >
        <Input className="w-full sm:w-64" placeholder={t("leads.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {managers && (
        <NativeSelect className="w-full sm:w-52" value={params.get("manager") ?? ""} onChange={(e) => push("manager", e.target.value)}>
          <option value="">{t("common.allManagers")}</option>
          <option value="none">{t("common.notAssignedOption")}</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}

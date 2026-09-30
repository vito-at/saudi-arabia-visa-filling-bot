"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PERIOD_LABELS } from "@/lib/period";

type Opt = { id: string; name: string };

export function LeadsFilters({
  statuses,
  managers,
  sources,
  campaigns,
  forms,
  showManager,
}: {
  statuses: Opt[];
  managers: Opt[];
  sources: Opt[];
  campaigns: Opt[];
  forms: Opt[];
  showManager: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  // поиск с задержкой, чтобы не дёргать сервер на каждый символ
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => update({ q: q || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const period = params.get("period") ?? "";
  const hasFilters = ["q", "status", "manager", "source", "campaign", "form", "period", "repeat"].some((k) => params.get(k));

  const sel = (key: string, label: string, options: Opt[], extra?: Opt[]) => (
    <NativeSelect className="w-auto min-w-36 max-w-52" value={params.get(key) ?? ""} onChange={(e) => update({ [key]: e.target.value || null })}>
      <option value="">{label}</option>
      {extra?.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Поиск по имени или телефону" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {sel("status", "Все статусы", statuses)}
      {showManager && sel("manager", "Все менеджеры", managers, [{ id: "none", name: "— Не назначен —" }])}
      {sel("source", "Все источники", sources)}
      {campaigns.length > 0 && sel("campaign", "Все кампании", campaigns)}
      {forms.length > 0 && sel("form", "Все формы", forms)}
      <NativeSelect className="w-auto" value={period} onChange={(e) => update({ period: e.target.value || null, from: null, to: null })}>
        <option value="">За всё время</option>
        {(["today", "yesterday", "7d", "30d", "month", "prev_month", "custom"] as const).map((k) => (
          <option key={k} value={k}>
            {PERIOD_LABELS[k]}
          </option>
        ))}
      </NativeSelect>
      {period === "custom" && (
        <>
          <Input type="date" className="w-40" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value || null, period: "custom" })} />
          <span className="text-muted-foreground">—</span>
          <Input type="date" className="w-40" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value || null, period: "custom" })} />
        </>
      )}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.push(pathname);
          }}
        >
          <X /> Сбросить
        </Button>
      )}
    </div>
  );
}

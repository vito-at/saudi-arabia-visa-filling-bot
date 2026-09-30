"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, NativeSelect } from "@/components/ui/input";

export function KanbanFilters({ managers }: { managers: { id: string; name: string }[] | null }) {
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
    <div className="flex gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          push("q", q);
        }}
      >
        <Input className="w-64" placeholder="Поиск по имени или телефону" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {managers && (
        <NativeSelect className="w-52" value={params.get("manager") ?? ""} onChange={(e) => push("manager", e.target.value)}>
          <option value="">Все менеджеры</option>
          <option value="none">— Не назначен —</option>
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

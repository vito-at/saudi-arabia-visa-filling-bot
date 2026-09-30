"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function CurrencySwitch({ value }: { value: "UZS" | "USD" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div className="flex rounded-lg bg-slate-200/60 p-1 text-sm">
      {(["USD", "UZS"] as const).map((c) => (
        <button
          key={c}
          className={cn("rounded-md px-3 py-1 cursor-pointer", value === c ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set("cur", c);
            router.push(`${pathname}?${next.toString()}`);
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

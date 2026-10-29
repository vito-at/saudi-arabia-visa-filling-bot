"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Flag } from "@/components/countries/flag";
import { cn } from "@/lib/utils";
import { searchText, type Region } from "@/lib/world";

export interface ComboOption {
  code: string;
  label: string;
  region?: Region;
  /** все названия и написания для поиска */
  search: string;
  /** есть информация (галочка в списке) */
  mark?: boolean;
}

/** Выбор страны с поиском: печатаете название (на любом языке) — список сужается; стрелки и Enter */
export function CountryCombo({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  regionLabel,
  extra,
}: {
  value: string | null;
  onChange: (code: string) => void;
  options: ComboOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  /** подпись части света — список группируется */
  regionLabel?: (r: Region) => string;
  /** дополнительный пункт в начале списка (например, «своё направление») */
  extra?: { code: string; label: string };
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.code === value) ?? (extra && extra.code === value ? { ...extra, search: "" } : null);

  const filtered = useMemo(() => {
    const s = searchText(q);
    const found = s ? options.filter((o) => o.search.includes(s)) : options;
    // при поиске — сначала те, у кого название начинается с запроса
    return s ? [...found].sort((a, b) => Number(!searchText(a.label).startsWith(s)) - Number(!searchText(b.label).startsWith(s))) : found;
  }, [q, options]);
  const items = useMemo(() => (extra && !q ? [{ ...extra, search: "" } as ComboOption, ...filtered] : filtered), [extra, q, filtered]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQ("");
  };
  const grouped = !!regionLabel && !q;
  let lastRegion: Region | undefined;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center gap-2.5 rounded-md border bg-card px-3 text-left text-base shadow-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected && selected.code.length === 2 && <Flag code={selected.code} className="text-lg" />}
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-card shadow-lg">
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, items.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (items[active]) pick(items[active].code);
                } else if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div ref={list} role="listbox" className="max-h-80 overflow-y-auto py-1 thin-scrollbar">
            {!items.length && <div className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</div>}
            {items.map((o, i) => {
              const header = grouped && o.region && o.region !== lastRegion ? o.region : null;
              if (o.region) lastRegion = o.region;
              return (
                <div key={o.code}>
                  {header && regionLabel && <div className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{regionLabel(header)}</div>}
                  <button
                    type="button"
                    data-i={i}
                    role="option"
                    aria-selected={o.code === value}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o.code)}
                    className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm", i === active && "bg-accent", o.code === value && "font-medium")}
                  >
                    {o.code.length === 2 ? <Flag code={o.code} /> : <span className="w-[1.333em]" />}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.mark && <Check className="size-3.5 shrink-0 text-emerald-600" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Flame, Repeat } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDuration } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { assignManagerAction, takeLeadAction } from "@/app/(app)/leads/actions";

export interface LeadRow {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  source: string;
  status: { name: string; color: string; kind: string };
  manager: string | null;
  managerId: string | null;
  campaign: string | null;
  destination: string | null;
  isRepeat: boolean;
  overdueMin: number | null; // сколько минут лид ждёт сверх порога
  isNew: boolean;
}

export function LeadsTable({
  rows,
  managers,
  isAdmin,
  currentUserId,
}: {
  rows: LeadRow[];
  managers: { id: string; name: string }[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  function sortLink(key: string) {
    const next = new URLSearchParams(params.toString());
    const cur = params.get("sort") ?? "createdAt";
    const dir = params.get("dir") ?? "desc";
    next.set("sort", key);
    next.set("dir", cur === key && dir === "desc" ? "asc" : "desc");
    return `${pathname}?${next.toString()}`;
  }
  function SortTH({ k, children }: { k: string; children: React.ReactNode }) {
    const active = (params.get("sort") ?? "createdAt") === k;
    const dir = params.get("dir") ?? "desc";
    return (
      <TH>
        <Link href={sortLink(k)} className="inline-flex items-center gap-1 hover:text-foreground">
          {children}
          {active && (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </Link>
      </TH>
    );
  }

  function bulkAssign() {
    start(async () => {
      const res = await assignManagerAction([...selected], assignTo === "none" ? null : assignTo);
      if (res.ok) {
        toast.success(`Назначено лидов: ${res.data ?? 0}`);
        setSelected(new Set());
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function take(id: string) {
    start(async () => {
      const res = await takeLeadAction(id);
      if (res.ok) toast.success("Лид взят в работу");
      else toast.error(res.error);
    });
  }

  return (
    <div>
      {isAdmin && selected.size > 0 && (
        <div className="flex items-center gap-3 border-b bg-sky-50 px-4 py-2 text-sm">
          <span>
            Выбрано: <b>{selected.size}</b>
          </span>
          <NativeSelect className="w-56" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Назначить менеджера…</option>
            <option value="none">— Снять назначение —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
          <Button size="sm" disabled={!assignTo || pending} onClick={bulkAssign}>
            Применить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Отменить выбор
          </Button>
        </div>
      )}
      <Table>
        <THead>
          <tr>
            {isAdmin && (
              <TH className="w-10">
                <input
                  type="checkbox"
                  aria-label="Выбрать все"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </TH>
            )}
            <SortTH k="createdAt">Создан</SortTH>
            <SortTH k="name">Клиент</SortTH>
            <TH>Телефон</TH>
            <SortTH k="status">Статус</SortTH>
            <SortTH k="manager">Менеджер</SortTH>
            <TH>Источник</TH>
            <SortTH k="campaign">Кампания</SortTH>
            <TH>Направление</TH>
            <TH className="w-28" />
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR
              key={r.id}
              className={cn(
                "cursor-pointer",
                r.overdueMin !== null ? "bg-red-50 hover:bg-red-100/70" : r.isNew && "bg-sky-50/70 hover:bg-sky-100/60",
                selected.has(r.id) && "bg-amber-50",
              )}
              onClick={() => router.push(`/leads/${r.id}`)}
            >
              {isAdmin && (
                <TD onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label="Выбрать" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                </TD>
              )}
              <TD className="whitespace-nowrap text-muted-foreground">
                <div className={cn(r.overdueMin !== null && "font-medium text-red-700")}>{formatDateTime(r.createdAt)}</div>
                {r.overdueMin !== null && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <Flame className="size-3" /> ждёт {formatDuration(r.overdueMin)}
                  </div>
                )}
              </TD>
              <TD>
                <div className={cn("flex items-center gap-1.5", r.isNew && "font-semibold")}>
                  {r.name}
                  {r.isRepeat && (
                    <span title="Повторное обращение" className="text-amber-600">
                      <Repeat className="size-3.5" />
                    </span>
                  )}
                </div>
              </TD>
              <TD className="whitespace-nowrap">{prettyPhone(r.phone)}</TD>
              <TD>
                <StatusBadge name={r.status.name} color={r.status.color} />
              </TD>
              <TD className="whitespace-nowrap">{r.manager ?? <span className="text-muted-foreground">не назначен</span>}</TD>
              <TD className="whitespace-nowrap text-muted-foreground">{r.source}</TD>
              <TD className="max-w-52 truncate text-muted-foreground" title={r.campaign ?? ""}>
                {r.campaign ?? "—"}
              </TD>
              <TD className="text-muted-foreground">{r.destination ?? "—"}</TD>
              <TD onClick={(e) => e.stopPropagation()} className="text-right">
                {r.isNew && (!r.managerId || r.managerId === currentUserId) && (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => take(r.id)}>
                    Взять
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {rows.length === 0 && <Empty>Лидов не найдено</Empty>}
    </div>
  );
}

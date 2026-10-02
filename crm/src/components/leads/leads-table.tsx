"use client";

import { REGULAR_CLIENT_MIN_DEALS } from "@/lib/constants";
import { RegularBadge } from "@/components/leads/regular-badge";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Flame, Phone, Repeat } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { assignManagerAction, takeLeadAction } from "@/app/(app)/leads/actions";
import { CallbackBadge } from "@/components/callbacks/callback-badge";
import { useI18n } from "@/i18n/client";

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
  /** постоянный клиент — от 3 покупок */
  isRegular: boolean;
  overdueMin: number | null; // сколько минут лид ждёт сверх порога
  isNew: boolean;
  callbackAt: string | null;
}

export function LeadsTable({ rows, managers, isAdmin }: { rows: LeadRow[]; managers: { id: string; name: string }[]; isAdmin: boolean }) {
  const { t, f } = useI18n();
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
        toast.success(t("leads.assigned", { n: res.data ?? 0 }));
        setSelected(new Set());
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function take(id: string) {
    start(async () => {
      const res = await takeLeadAction(id);
      if (res.ok) toast.success(t("leads.taken"));
      else toast.error(res.error);
    });
  }

  return (
    <div>
      {/* телефон: карточки вместо таблицы */}
      <ul className="divide-y md:hidden">
        {rows.map((r) => (
          <li key={r.id} className={cn("px-3 py-3", r.overdueMin !== null ? "bg-red-50" : r.isNew && "bg-sky-50/70")} onClick={() => router.push(`/leads/${r.id}`)}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className={cn("flex items-center gap-1.5 truncate", r.isNew && "font-semibold")}>
                  <span className="truncate">{r.name}</span>
                  {r.isRegular ? <RegularBadge compact label={t("leads.regular")} hint={t("leads.regularHint", { n: REGULAR_CLIENT_MIN_DEALS })} /> : r.isRepeat && <Repeat className="size-3.5 shrink-0 text-amber-600" aria-label={t("leads.repeat")} />}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {r.overdueMin !== null ? (
                    <span className="inline-flex items-center gap-1 font-medium text-red-600">
                      <Flame className="size-3" /> {formatDateTime(r.createdAt)} · {t("leads.waiting", { time: f.duration(r.overdueMin) })}
                    </span>
                  ) : (
                    formatDateTime(r.createdAt)
                  )}
                </div>
              </div>
              {r.phone && (
                <a
                  href={`tel:${r.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white"
                  aria-label={prettyPhone(r.phone)}
                >
                  <Phone className="size-4" />
                </a>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <StatusBadge name={r.status.name} color={r.status.color} />
              {r.callbackAt && <CallbackBadge at={r.callbackAt} />}
              <span className="text-muted-foreground">{r.manager ?? t("common.notAssigned")}</span>
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{[prettyPhone(r.phone), r.source, r.campaign, r.destination].filter(Boolean).join(" · ")}</div>
            {r.isNew && !r.managerId && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  take(r.id);
                }}
              >
                {t("leads.take")}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        {isAdmin && selected.size > 0 && (
          <div className="flex items-center gap-3 border-b bg-sky-50 px-4 py-2 text-sm">
            <span>
              {t("leads.selected")} <b>{selected.size}</b>
            </span>
            <NativeSelect className="w-56" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="">{t("leads.assignTo")}</option>
              <option value="none">{t("leads.unassign")}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
            <Button size="sm" disabled={!assignTo || pending} onClick={bulkAssign}>
              {t("common.apply")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {t("leads.clearSelection")}
            </Button>
          </div>
        )}
        <Table>
          <THead>
            <tr>
              {isAdmin && (
                <TH className="w-10">
                  <input type="checkbox" aria-label={t("leads.selectAll")} checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} />
                </TH>
              )}
              <SortTH k="createdAt">{t("leads.col.created")}</SortTH>
              <SortTH k="name">{t("leads.col.client")}</SortTH>
              <SortTH k="status">{t("leads.col.status")}</SortTH>
              <SortTH k="manager">{t("leads.col.manager")}</SortTH>
              <SortTH k="campaign">{t("leads.col.source")}</SortTH>
              <TH className="hidden min-[1440px]:table-cell">{t("leads.col.destination")}</TH>
              <TH className="w-24" />
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR
                key={r.id}
                className={cn("cursor-pointer", r.overdueMin !== null ? "bg-red-50 hover:bg-red-100/70" : r.isNew && "bg-sky-50/70 hover:bg-sky-100/60", selected.has(r.id) && "bg-amber-50")}
                onClick={() => router.push(`/leads/${r.id}`)}
              >
                {isAdmin && (
                  <TD onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={t("leads.select")} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  </TD>
                )}
                <TD className="whitespace-nowrap text-muted-foreground">
                  <div className={cn(r.overdueMin !== null && "font-medium text-red-700")}>{formatDateTime(r.createdAt)}</div>
                  {r.overdueMin !== null && (
                    <div className="flex items-center gap-1 text-xs text-red-600">
                      <Flame className="size-3" /> {t("leads.waiting", { time: f.duration(r.overdueMin) })}
                    </div>
                  )}
                </TD>
                <TD>
                  <div className={cn("flex items-center gap-1.5", r.isNew && "font-semibold")}>
                    {r.name}
                    {r.isRegular ? (
                      <RegularBadge label={t("leads.regular")} hint={t("leads.regularHint", { n: REGULAR_CLIENT_MIN_DEALS })} className="font-normal" />
                    ) : (
                      r.isRepeat && (
                        <span title={t("leads.repeat")} className="text-amber-600">
                          <Repeat className="size-3.5" />
                        </span>
                      )
                    )}
                  </div>
                  {r.phone && <div className="whitespace-nowrap text-xs text-muted-foreground">{prettyPhone(r.phone)}</div>}
                </TD>
                <TD>
                  <StatusBadge name={r.status.name} color={r.status.color} />
                  {r.callbackAt && <CallbackBadge at={r.callbackAt} className="mt-1 flex w-fit" />}
                </TD>
                <TD className="whitespace-nowrap">{r.manager ?? <span className="text-muted-foreground">{t("common.notAssigned")}</span>}</TD>
                <TD className="max-w-60 text-muted-foreground">
                  <div className="whitespace-nowrap">{r.source}</div>
                  {r.campaign && (
                    <div className="truncate text-xs" title={r.campaign}>
                      {r.campaign}
                    </div>
                  )}
                </TD>
                <TD className="hidden max-w-40 truncate text-muted-foreground min-[1440px]:table-cell" title={r.destination ?? ""}>
                  {r.destination ?? "—"}
                </TD>
                <TD onClick={(e) => e.stopPropagation()} className="text-right">
                  {r.isNew && !r.managerId && (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => take(r.id)}>
                      {t("leads.take")}
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      {rows.length === 0 && <Empty>{t("leads.empty")}</Empty>}
    </div>
  );
}

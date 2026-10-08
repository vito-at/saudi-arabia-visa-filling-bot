"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table as T, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { listCellDealsAction, setDealQuantityAction, type CellDeal } from "@/app/(app)/reports/actions";
import type { Table } from "@/lib/reports/tables";
import { PRODUCT_KEYS } from "@/lib/reports/products-keys";

type Cell = { mid: string; name: string; service: string; product: string };

/**
 * «Продажи по продуктам». Администратор нажимает на число — открываются сделки этого менеджера по этому продукту
 * за период, и в каждой можно поправить количество продаж (виза на 6 человек — 6).
 */
export function ProductSalesTable({ table, currency, editable, period }: { table: Table; currency: "UZS" | "USD"; editable: boolean; period: { from: string; to: string } }) {
  const { t, f } = useI18n();
  const [cell, setCell] = useState<Cell | null>(null);
  if (!table.rows.length) return <Empty>{t("reports.noData")}</Empty>;
  const num = (type: string) => type !== "text";
  const show = (v: unknown, type: string) => (v === null || v === undefined ? "—" : type === "money" ? f.money(Number(v), currency) : type === "int" ? formatNumber(Number(v)) : String(v));
  const productKey = (k: string) => (PRODUCT_KEYS as readonly string[]).includes(k);

  return (
    <>
      <T>
        <THead>
          <tr>
            {table.columns.map((c) => (
              <TH key={c.key} className={cn("whitespace-normal leading-tight", num(c.type) && "text-right")}>
                {c.label}
              </TH>
            ))}
          </tr>
        </THead>
        <TBody>
          {table.rows.map((r, i) => (
            <TR key={i}>
              {table.columns.map((c, j) => {
                const v = r[c.key];
                const clickable = editable && productKey(c.key) && Number(v) > 0;
                return (
                  <TD key={c.key} className={cn("whitespace-nowrap", num(c.type) && "text-right tabular-nums", j === 0 && "min-w-52 font-medium whitespace-normal", c.key === "profit" && Number(v) < 0 && "text-red-600")}>
                    {clickable ? (
                      <button
                        type="button"
                        className="cursor-pointer rounded px-1.5 py-0.5 font-medium text-primary underline decoration-dotted underline-offset-4 hover:bg-primary/10"
                        onClick={() => setCell({ mid: String(r.mid), name: String(r.name), service: c.key, product: c.label })}
                      >
                        {show(v, c.type)}
                      </button>
                    ) : (
                      show(v, c.type)
                    )}
                  </TD>
                );
              })}
            </TR>
          ))}
          {table.totals && (
            <tr className="border-t-2 bg-slate-50 font-semibold">
              {table.columns.map((c) => (
                <TD key={c.key} className={cn("whitespace-nowrap", num(c.type) && "text-right tabular-nums")}>
                  {table.totals![c.key] !== undefined ? show(table.totals![c.key], c.type) : ""}
                </TD>
              ))}
            </tr>
          )}
        </TBody>
      </T>
      {editable && <p className="px-5 pt-3 text-xs text-muted-foreground">{t("rt.products.editHint")}</p>}
      {cell && <CellDealsDialog cell={cell} period={period} onClose={() => setCell(null)} />}
    </>
  );
}

function CellDealsDialog({ cell, period, onClose }: { cell: Cell; period: { from: string; to: string }; onClose: () => void }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [deals, setDeals] = useState<CellDeal[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  // сделки ячейки загружаем один раз при открытии окна
  useEffect(() => {
    let alive = true;
    void listCellDealsAction({ managerId: cell.mid, service: cell.service, ...period }).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        toast.error(res.error);
        return onClose();
      }
      setDeals(res.data ?? []);
      setValues(Object.fromEntries((res.data ?? []).map((d) => [d.id, String(d.quantity)])));
    });
    return () => {
      alive = false;
    };
  }, [cell, period, onClose]);

  function save(d: CellDeal) {
    const q = Number(values[d.id]);
    start(async () => {
      const res = await setDealQuantityAction(d.id, q);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("rt.products.cellSaved"));
      setDeals((list) => list?.map((x) => (x.id === d.id ? { ...x, quantity: q } : x)) ?? null);
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={t("rt.products.cellTitle", { name: cell.name, product: cell.product })}>
        {!deals ? (
          <div className="py-6 text-center text-sm text-muted-foreground">…</div>
        ) : !deals.length ? (
          <Empty>{t("rt.products.cellEmpty")}</Empty>
        ) : (
          <ul className="divide-y text-sm">
            {deals.map((d) => {
              const changed = values[d.id] !== String(d.quantity);
              return (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${d.leadId}`} className="font-medium hover:underline">
                      {d.leadName}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatDate(d.paidAt)} · {d.product} · {f.money(d.amount, d.currency)}
                    </div>
                  </div>
                  <Input
                    aria-label={t("rt.products.cellQuantity")}
                    name="quantity"
                    type="number"
                    min={1}
                    max={500}
                    className="w-20"
                    value={values[d.id] ?? ""}
                    onChange={(e) => setValues({ ...values, [d.id]: e.target.value })}
                  />
                  <Button size="sm" disabled={pending || !changed} onClick={() => save(d)}>
                    {t("common.save")}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

import Link from "next/link";
import { Table as T, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";
import { formatDuration, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Cell, Column, Table } from "@/lib/reports/tables";

export function fmtCell(v: Cell, type: Column["type"], currency: "UZS" | "USD") {
  if (v === null || v === undefined || v === "") return "—";
  switch (type) {
    case "int":
      return formatNumber(Number(v));
    case "money":
      return formatMoney(Number(v), currency);
    case "pct":
      return formatPercent(Number(v));
    case "minutes":
      return formatDuration(Number(v));
    default:
      return String(v);
  }
}

export function ReportTable({ table, currency, linkPrefix, compact }: { table: Table; currency: "UZS" | "USD"; linkPrefix?: string; compact?: boolean }) {
  if (!table.rows.length) return <Empty>Нет данных за выбранный период</Empty>;
  const num = (c: Column) => c.type !== "text" && c.type !== "date";
  return (
    <T className={compact ? "text-xs" : undefined}>
      <THead>
        <tr>
          {table.columns.map((c) => (
            <TH key={c.key} className={cn(num(c) && "text-right")}>
              {c.label}
            </TH>
          ))}
        </tr>
      </THead>
      <TBody>
        {table.rows.map((r, i) => (
          <TR key={i}>
            {table.columns.map((c, j) => {
              const v = fmtCell(r[c.key], c.type, currency);
              const negative = (c.key === "profit" || c.key === "roi") && Number(r[c.key]) < 0;
              return (
                <TD key={c.key} className={cn("whitespace-nowrap", num(c) && "text-right tabular-nums", j === 0 && "min-w-52 font-medium whitespace-normal", negative && "text-red-600")}>
                  {j === 0 && linkPrefix && r.id ? (
                    <Link href={`${linkPrefix}${r.id}`} className="hover:underline">
                      {v}
                    </Link>
                  ) : (
                    v
                  )}
                </TD>
              );
            })}
          </TR>
        ))}
        {table.totals && (
          <tr className="border-t-2 bg-slate-50 font-semibold">
            {table.columns.map((c) => (
              <TD key={c.key} className={cn("whitespace-nowrap", num(c) && "text-right tabular-nums")}>
                {table.totals![c.key] !== undefined ? fmtCell(table.totals![c.key], c.type, currency) : ""}
              </TD>
            ))}
          </tr>
        )}
      </TBody>
    </T>
  );
}

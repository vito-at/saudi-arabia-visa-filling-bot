import Link from "next/link";
import { Table as T, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";
import { formatDuration, formatMoney, formatNumber, formatPercent, type Lang } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import type { Cell, Column, Table } from "@/lib/reports/tables";

export function fmtCell(v: Cell, type: Column["type"], currency: "UZS" | "USD", lang: Lang = "ru") {
  if (v === null || v === undefined || v === "") return "—";
  switch (type) {
    case "int":
      return formatNumber(Number(v));
    case "money":
      return formatMoney(Number(v), currency, lang);
    case "pct":
      return formatPercent(Number(v));
    case "minutes":
      return formatDuration(Number(v), lang);
    default:
      return String(v);
  }
}

export async function ReportTable({ table, currency, linkPrefix, compact }: { table: Table; currency: "UZS" | "USD"; linkPrefix?: string; compact?: boolean }) {
  const { t, locale } = await getI18n();
  if (!table.rows.length) return <Empty>{t("reports.noData")}</Empty>;
  const num = (c: Column) => c.type !== "text" && c.type !== "date";
  // широкие таблицы (реклама со статистикой) — плотнее, чтобы помещались без прокрутки
  const dense = table.columns.length > 10;
  return (
    <T className={compact || dense ? "text-xs" : undefined}>
      <THead>
        <tr>
          {table.columns.map((c) => (
            <TH key={c.key} className={cn("whitespace-normal leading-tight", num(c) && "text-right", dense && "px-2")}>
              {c.label}
            </TH>
          ))}
        </tr>
      </THead>
      <TBody>
        {table.rows.map((r, i) => (
          <TR key={i}>
            {table.columns.map((c, j) => {
              const v = fmtCell(r[c.key], c.type, currency, locale);
              const negative = (c.key === "profit" || c.key === "roi") && Number(r[c.key]) < 0;
              return (
                <TD key={c.key} className={cn("whitespace-nowrap", num(c) && "text-right tabular-nums", j === 0 && (dense ? "min-w-36" : "min-w-52"), j === 0 && "font-medium whitespace-normal", dense && "px-2", negative && "text-red-600")}>
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
              <TD key={c.key} className={cn("whitespace-nowrap", num(c) && "text-right tabular-nums", dense && "px-2")}>
                {table.totals![c.key] !== undefined ? fmtCell(table.totals![c.key], c.type, currency, locale) : ""}
              </TD>
            ))}
          </tr>
        )}
      </TBody>
    </T>
  );
}

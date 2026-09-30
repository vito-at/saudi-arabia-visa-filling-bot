import ExcelJS from "exceljs";
import type { Table } from "./tables";

const FORMATS = { int: "# ##0", pct: "0.0%", date: "@", text: "@", minutes: "0", money: "# ##0" } as const;

/** Книга Excel: по листу на каждую таблицу отчёта */
export async function buildWorkbook(tables: Table[], meta: { title: string; subtitle: string; currency: "UZS" | "USD" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Orient Travel CRM";
  wb.created = new Date();
  const usedNames = new Set<string>();
  for (const t of tables) {
    let name = t.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
    while (usedNames.has(name)) name = `${name.slice(0, 28)} ${usedNames.size}`;
    usedNames.add(name);
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }] });
    ws.getCell("A1").value = `${meta.title} — ${t.title}`;
    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A2").value = meta.subtitle + (t.note ? ` · ${t.note}` : "");
    ws.getCell("A2").font = { color: { argb: "FF64748B" }, size: 10 };
    const header = ws.getRow(4);
    t.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.type === "money" ? `${c.label}, ${meta.currency}` : c.type === "minutes" ? `${c.label}, мин` : c.label;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E7490" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      const col = ws.getColumn(i + 1);
      col.width = c.type === "text" ? 34 : 16;
      col.numFmt = c.type === "money" && meta.currency === "USD" ? "# ##0.00" : FORMATS[c.type];
    });
    header.height = 30;
    const rows = t.totals ? [...t.rows, t.totals] : t.rows;
    rows.forEach((r, ri) => {
      const row = ws.getRow(5 + ri);
      t.columns.forEach((c, i) => {
        const v = r[c.key];
        row.getCell(i + 1).value = v === null || v === undefined ? null : c.type === "text" || c.type === "date" ? String(v) : c.type === "minutes" ? Math.round(Number(v)) : Number(v);
      });
      if (t.totals && ri === rows.length - 1) row.font = { bold: true };
    });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: t.columns.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

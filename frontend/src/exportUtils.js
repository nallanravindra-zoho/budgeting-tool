/**
 * Shared CSV/Excel export helpers — used by the small "⋮" ExportMenu
 * component in App.jsx, wired into every tab's table(s).
 *
 * Every export goes through the same shape: `sheets = [{ name, columns, rows }]`.
 * A single-table page passes a 1-element array; a page with several distinct
 * tables (e.g. Operational Stats) passes several — those become separate
 * tabs in the Excel workbook, and separate "== SheetName ==" sections in
 * one CSV file (CSV has no native multi-sheet concept).
 *
 * `columns` is `[{ key, label, value? }]` — `value(row)` is an optional
 * formatter for cells that aren't a plain `row[key]` (e.g. flattening a
 * monthly array into "Jan: 1234").
 */
import * as XLSX from "xlsx";

function cellValue(column, row) {
  const v = typeof column.value === "function" ? column.value(row) : row[column.key];
  return v === null || v === undefined ? "" : v;
}

function csvEscape(v) {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sheetsToCsv(sheets) {
  const blocks = sheets.map(({ name, columns, rows }) => {
    const header = columns.map(c => csvEscape(c.label)).join(",");
    const lines = rows.map(r => columns.map(c => csvEscape(cellValue(c, r))).join(","));
    const body = [header, ...lines].join("\r\n");
    // Only prefix a section header when there's more than one sheet —
    // a single-table page's CSV should just be the plain table.
    return sheets.length > 1 ? `== ${name} ==\r\n${body}` : body;
  });
  return blocks.join("\r\n\r\n");
}

function sheetsToWorkbook(sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, columns, rows }, i) => {
    const data = rows.map(r => {
      const obj = {};
      columns.forEach(c => { obj[c.label] = cellValue(c, r); });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    // Excel sheet names: 31-char limit, no special chars — keep it simple.
    const safeName = (name || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || `Sheet${i + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });
  return wb;
}

function downloadText(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function exportSheetsAsCsv(sheets, filename) {
  downloadText(sheetsToCsv(sheets), `${filename}-${dateStamp()}.csv`, "text/csv;charset=utf-8;");
}

export function exportSheetsAsExcel(sheets, filename) {
  XLSX.writeFile(sheetsToWorkbook(sheets), `${filename}-${dateStamp()}.xlsx`);
}

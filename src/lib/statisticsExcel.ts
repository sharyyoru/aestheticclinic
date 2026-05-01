import * as XLSX from "xlsx";

export type ExcelCell = string | number | boolean | Date | null | undefined;

export type ExcelSheet = {
  /** Sheet/tab name (max 31 chars). */
  name: string;
  /** Optional metadata block printed before data (label / value rows). */
  metadata?: Array<[string, string | number | null]>;
  /** Header row labels. */
  headers: string[];
  /** Data rows (each row must align with `headers`). */
  rows: ExcelCell[][];
  /** Optional totals row appended at end. */
  totals?: ExcelCell[];
  /** Optional column widths in characters. */
  columnWidths?: number[];
};

export type ExcelWorkbookOptions = {
  /** File name shown in download (no extension needed). */
  filename: string;
  /** Workbook title (used in metadata block of every sheet). */
  reportTitle: string;
  /** Filters applied (key/value pairs printed in metadata block). */
  filters?: Record<string, string | number | null | undefined>;
  /** Author printed in metadata block. */
  author?: string;
  /** Sheets to include. */
  sheets: ExcelSheet[];
};

const DEFAULT_AUTHOR = "Aesthetics Clinic";

function formatFiltersBlock(
  filters: Record<string, string | number | null | undefined> | undefined,
): Array<[string, string | number | null]> {
  if (!filters) return [];
  return Object.entries(filters)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => [k, (v ?? "") as string | number]);
}

/**
 * Build a multi-sheet xlsx Buffer matching the legacy Axenita layout:
 *   row 0: report title
 *   row 1: blank
 *   rows 2..n: metadata + filters (label, value)
 *   blank row
 *   header row (bold, frozen)
 *   data rows
 *   totals row (if provided)
 */
export function buildStatisticsWorkbook(opts: ExcelWorkbookOptions): Buffer {
  const wb = XLSX.utils.book_new();
  const createdAt = new Date().toLocaleString("fr-CH", {
    timeZone: "Europe/Zurich",
  });

  for (const sheet of opts.sheets) {
    const aoa: ExcelCell[][] = [];

    // Title block
    aoa.push([opts.reportTitle]);
    aoa.push([]);
    aoa.push(["Nom du rapport", opts.reportTitle]);
    aoa.push(["Auteur", opts.author ?? DEFAULT_AUTHOR]);
    aoa.push(["Date de création", createdAt]);
    aoa.push(["Nom du fichier", `${opts.filename}.xlsx`]);

    const filterRows = formatFiltersBlock(opts.filters);
    if (sheet.metadata) filterRows.push(...sheet.metadata);
    for (const [k, v] of filterRows) {
      aoa.push([k, v]);
    }

    aoa.push([]); // blank row before headers
    aoa.push(sheet.headers);

    for (const row of sheet.rows) aoa.push(row);

    if (sheet.totals) {
      aoa.push([]);
      aoa.push(sheet.totals);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    if (sheet.columnWidths) {
      ws["!cols"] = sheet.columnWidths.map((wch) => ({ wch }));
    } else {
      ws["!cols"] = sheet.headers.map((h) => ({
        wch: Math.min(Math.max(h.length + 2, 12), 30),
      }));
    }

    // Freeze header row (row index = aoa.length minus rows minus totals row count)
    const headerRowIdx = aoa.length - sheet.rows.length - (sheet.totals ? 2 : 0);
    ws["!freeze"] = { xSplit: 0, ySplit: headerRowIdx };

    // Truncate sheet name to Excel's 31 char limit
    const safeName = sheet.name.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buf as Buffer;
}

/** Format a CHF amount with 2 decimals using fr-CH locale (used in row helpers). */
export function fmtChf(v: number | null | undefined): number {
  if (v === null || v === undefined || Number.isNaN(v)) return 0;
  return Math.round(Number(v) * 100) / 100;
}

/** Format a date as YYYY-MM-DD (or empty if null). */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Slug-safe filename helper. */
export function makeFilename(report: string, from?: string, to?: string): string {
  const slug = report.replace(/[^\w-]+/g, "_");
  const range = [from, to].filter(Boolean).join("_to_");
  const stamp = new Date().toISOString().slice(0, 10);
  return [slug, range || stamp].filter(Boolean).join("_");
}

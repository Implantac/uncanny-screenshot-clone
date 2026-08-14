// CSV export helper — client-side, no deps.
function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s =
    typeof v === "string"
      ? v
      : Array.isArray(v)
        ? v.join("|")
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type CsvColumn<T> = { key: keyof T; label?: string };

export function exportToCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: CsvColumn<T>[],
) {
  if (!rows.length) return;
  const cols: CsvColumn<T>[] =
    columns ?? (Object.keys(rows[0]) as (keyof T)[]).map((k) => ({ key: k }));
  const header = cols.map((c) => escape(c.label ?? String(c.key))).join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c.key])).join(",")).join("\n");
  const csv = "\uFEFF" + header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse a CSV string into rows of string cells.
 * Handles quoted fields, escaped quotes (""), CRLF, BOM.
 * Auto-detects delimiter between comma and semicolon.
 */
export function parseCsv(text: string): string[][] {
  if (!text) return [];
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  // detect delimiter from first non-quoted line
  const head = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === delim) {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        // skip fully-empty lines
        if (!(row.length === 1 && row[0] === "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }
  return rows;
}

/** Convert parsed rows (header + body) into records keyed by header. */
export function csvToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const [header, ...body] = rows;
  return body.map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => {
      rec[h.trim()] = (r[i] ?? "").trim();
    });
    return rec;
  });
}

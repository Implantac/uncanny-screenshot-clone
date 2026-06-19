import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type PdfColumn<T> = { key: keyof T; label: string };

export function exportToPdf<T extends Record<string, unknown>>(
  filename: string,
  title: string,
  rows: T[],
  columns: PdfColumn<T>[],
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
  doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · USE MODA OS`, 40, 56);

  autoTable(doc, {
    startY: 72,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) =>
      columns.map((c) => {
        const v = r[c.key];
        if (v === null || v === undefined) return "";
        if (Array.isArray(v)) return v.join(", ");
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      }),
    ),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [120, 70, 200], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 243, 250] },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

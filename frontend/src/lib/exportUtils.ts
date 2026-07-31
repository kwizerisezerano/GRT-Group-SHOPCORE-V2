import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

/**
 * Convert array of objects into a CSV string and trigger download.
 */
export function exportToCSV<T extends Record<string, any>>(
  rows: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[],
) {
  if (!rows.length) {
    alert("No data to export");
    return;
  }

  const cols = columns ?? (Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k })));
  const header = cols.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((row) =>
      cols
        .map((c) => {
          const v = row[c.key];
          const s = v === null || v === undefined ? "" : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Render array of objects as a PDF table and trigger download.
 */
export function exportToPDF<T extends Record<string, any>>(
  rows: T[],
  filename: string,
  title: string,
  columns?: { key: keyof T; label: string }[],
  meta?: { subtitle?: string; summary?: { label: string; value: string }[] },
) {
  if (!rows.length) {
    alert("No data to export");
    return;
  }

  const cols = columns ?? (Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k })));
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 40, 40);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Generated: ${format(new Date(), "PPpp")}`, 40, 56);
  if (meta?.subtitle) doc.text(meta.subtitle, 40, 70);

  let startY = meta?.subtitle ? 90 : 76;

  if (meta?.summary?.length) {
    doc.setTextColor(40);
    doc.setFontSize(10);
    meta.summary.forEach((s, i) => {
      const x = 40 + (i % 4) * 180;
      const y = startY + Math.floor(i / 4) * 18;
      doc.setFont("helvetica", "bold");
      doc.text(s.value, x, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text(s.label, x + doc.getTextWidth(s.value) + 6, y);
      doc.setTextColor(40);
    });
    startY += Math.ceil(meta.summary.length / 4) * 18 + 10;
  }

  autoTable(doc, {
    head: [cols.map((c) => c.label)],
    body: rows.map((r) =>
      cols.map((c) => {
        const v = r[c.key];
        return v === null || v === undefined ? "" : String(v);
      }),
    ),
    startY,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [13, 51, 82], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${filename}_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`);
}

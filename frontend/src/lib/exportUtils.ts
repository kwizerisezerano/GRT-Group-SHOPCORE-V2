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

/** Branding for the printed document header. */
export type PrintBrand = {
  /** The workspace the report belongs to. */
  name?: string | null;
  /** Website, support address, department — whatever should sit top-right. */
  contact?: string[];
};

export type PrintMeta = {
  /** The period the report covers, printed under the title. */
  subtitle?: string;
  /** Figures printed across the top, above the table. */
  summary?: { label: string; value: string }[];
  brand?: PrintBrand;
};

/**
 * Renders a report as a printable document and opens the print dialogue.
 *
 * Deliberately not `window.print()` on the page itself, which prints the
 * sidebar, header and filter controls across a dozen wasted pages. This is a
 * document: a branded header, the title and period, the headline figures,
 * then the table — the shape a person expects to hand to an accountant or
 * file. The browser dialogue also offers "Save as PDF", so it covers both
 * printing and producing a shareable file.
 *
 * Everything interpolated is escaped. Report rows carry customer names,
 * product names and free-text notes, all of which are user input.
 */
export function printRows<T extends Record<string, any>>(
  rows: T[],
  title: string,
  columns?: { key: keyof T; label: string }[],
  meta?: PrintMeta,
) {
  if (!rows.length) {
    alert("No data to print");
    return;
  }

  const escape = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k }));

  /** A column reads as a figure when most of its values parse as one. */
  const numericColumns = new Set(
    cols
      .filter((c) => {
        const sample = rows.slice(0, 24).map((r) => String(r[c.key] ?? "").trim());
        const numeric = sample.filter(
          (v) => v !== "" && /^-?[A-Za-z]{0,3}\s?[\d,]+(\.\d+)?%?$/.test(v),
        );
        return numeric.length > sample.length / 2;
      })
      .map((c) => String(c.key)),
  );

  /*
   * Money columns get a colour so a statement can be read at a glance: what
   * came in reads positive, what is still owed reads as owed. Keyed off the
   * column name rather than the value, so a zero in the unpaid column is
   * still unambiguously the unpaid column.
   */
  const positiveColumns = /paid|profit|received|revenue|credit|in\b/i;
  const negativeColumns = /unpaid|due|outstanding|loss|owed|debit|refund/i;

  const cellClass = (key: string) => {
    const classes: string[] = [];
    if (numericColumns.has(key)) classes.push("num");
    if (positiveColumns.test(key) && !negativeColumns.test(key)) classes.push("pos");
    else if (negativeColumns.test(key)) classes.push("neg");
    return classes.length ? ` class="${classes.join(" ")}"` : "";
  };

  const brandName = meta?.brand?.name?.trim() || "ShopCore";
  const contact = (meta?.brand?.contact ?? []).filter(Boolean);

  const contactBlock = contact.length
    ? `<div class="contact">
         <p class="contact-title">Contact Us</p>
         ${contact.map((line) => `<p>${escape(line)}</p>`).join("")}
       </div>`
    : "";

  const summary = meta?.summary?.length
    ? `<div class="summary">${meta.summary
        .map(
          (item) =>
            `<div><p class="s-label">${escape(item.label)}</p><p class="s-value">${escape(item.value)}</p></div>`,
        )
        .join("")}</div>`
    : "";

  const generated = format(new Date(), "d/M/yyyy, h:mm:ss a");

  const chips = [
    ["Report", title],
    ["Period", meta?.subtitle ?? "All time"],
    ["Generated", generated],
  ]
    .map(
      ([label, value]) =>
        `<div class="chip"><span class="chip-label">${escape(label)}:</span> ${escape(value)}</div>`,
    )
    .join("");

  const head = cols
    .map((c) => `<th${numericColumns.has(String(c.key)) ? ' class="num"' : ""}>${escape(c.label)}</th>`)
    .join("");

  const body = rows
    .map(
      (row, index) =>
        `<tr><td class="num idx">${index + 1}</td>${cols
          .map((c) => `<td${cellClass(String(c.key))}>${escape(row[c.key])}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escape(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: "Segoe UI", Arial, Helvetica, sans-serif;
        color: #0f172a;
        margin: 0;
        padding: 32px 36px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .masthead { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
      .brand { display: flex; align-items: center; gap: 16px; }
      .mark {
        width: 78px; height: 78px; flex: none;
        display: flex; align-items: center; justify-content: center;
        background: #0f172a; color: #fff;
        font-size: 34px; font-weight: 800; letter-spacing: 1px;
      }
      .brand h1 { margin: 0; font-size: 30px; font-weight: 800; letter-spacing: 0.5px; }
      .brand p { margin: 4px 0 0; font-size: 13px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: #ea8a1e; }

      .contact { text-align: right; font-size: 12px; color: #475569; }
      .contact p { margin: 0 0 4px; }
      .contact-title { font-weight: 800; color: #0f172a; font-size: 13px; }

      .rule { height: 3px; background: #0f172a; margin: 18px 0 26px; }

      .doc-title { margin: 0; text-align: center; font-size: 26px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
      .doc-period { margin: 8px 0 0; text-align: center; font-size: 13px; color: #475569; }

      .chips { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 24px 0 26px; }
      .chip { border: 1px solid #cbd5e1; border-radius: 8px; padding: 11px 14px; font-size: 12.5px; color: #334155; }
      .chip-label { font-weight: 800; color: #0f172a; }

      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-bottom: 30px; }
      .s-label { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #94a3b8; }
      .s-value { margin: 6px 0 0; font-size: 24px; font-weight: 800; color: #0f172a; }

      .section { margin: 0 0 12px; font-size: 15px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; }

      table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
      th { background: #f1f5f9; font-weight: 800; font-size: 10.5px; letter-spacing: 0.6px; text-transform: uppercase; color: #334155; text-align: center; }
      td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
      td.idx { text-align: center; color: #64748b; }
      td.pos { color: #15803d; font-weight: 600; }
      td.neg { color: #b91c1c; font-weight: 600; }

      /* Repeat the header on every printed page of a long table. */
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      @page { margin: 12mm; }
    </style>
  </head>
  <body>
    <div class="masthead">
      <div class="brand">
        <div class="mark">${escape(brandName.trim().charAt(0).toUpperCase() || "S")}</div>
        <div>
          <h1>${escape(brandName.toUpperCase())}</h1>
          <p>${escape(title)}</p>
        </div>
      </div>
      ${contactBlock}
    </div>

    <div class="rule"></div>

    <h2 class="doc-title">${escape(title)}</h2>
    ${meta?.subtitle ? `<p class="doc-period">${escape(meta.subtitle)}</p>` : ""}

    <div class="chips">${chips}</div>
    ${summary}

    <p class="section">${escape(title)} details</p>
    <table>
      <thead><tr><th class="num">#</th>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </body>
</html>`;

  const win = window.open("", "_blank", "width=1180,height=860");
  if (!win) {
    alert("Allow pop-ups for this site to print the report.");
    return;
  }

  win.document.write(html);
  win.document.close();
  win.focus();
  // Let the document lay out before the dialogue opens, or the preview is blank.
  win.onload = () => win.print();
}


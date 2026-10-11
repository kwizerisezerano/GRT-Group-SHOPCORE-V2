import PDFDocument from "pdfkit";

import type { InvoiceForRender } from "./service";

/**
 * The invoice as a PDF, drawn to match the ShopCore workspace.
 *
 * ## Why pdfkit and not a headless browser
 *
 * Rendering HTML to PDF means shipping Chromium — a few hundred megabytes, a
 * process to supervise, and a cold start measured in seconds — to lay out one
 * page of a table. This draws directly, starts instantly, and cannot be broken
 * by a browser upgrade.
 *
 * ## The palette
 *
 * The same values as the app's light theme (`--primary: 230 80% 38%`), written
 * here as hex because a PDF has no CSS variables. A customer who has just paid
 * inside ShopCore should recognise the receipt as coming from it.
 */

const BRAND = "#132DAE";
const INK = "#171B2E";
const MUTED = "#6B7280";
const RULE = "#E5E7EB";
const SUCCESS = "#047857";

const money = (value: unknown, currency: string) =>
  `${currency} ${Math.round(Number(value ?? 0)).toLocaleString("en-US")}`;

const longDate = (value: Date) =>
  value.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  six_months: "Every 6 months",
  annual: "Annual",
};

/** Renders the invoice and resolves the finished PDF bytes. */
export async function renderInvoicePdf(data: InvoiceForRender): Promise<Buffer> {
  const { invoice } = data;

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // ------------------------------------------------------------ header ---
  doc.rect(left, 44, width, 4).fill(BRAND);

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text("ShopCore", left, 68);
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text("RETAIL OPERATING SYSTEM", left, 92, { characterSpacing: 1.6 });

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("Payment receipt", left, 68, { width, align: "right" });
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(10)
    .text(invoice.invoiceNo, left, 90, { width, align: "right" });

  // A receipt only exists once money has arrived, so this is never anything
  // else — but saying it plainly is the first thing the reader looks for.
  doc
    .fillColor(SUCCESS)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("PAID", left, 106, { width, align: "right" });

  doc.moveTo(left, 130).lineTo(right, 130).lineWidth(1).stroke(RULE);

  // ------------------------------------------------------------- who -----
  let y = 148;

  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("BILLED TO", left, y);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(data.tenantName, left, y + 14);

  const contact = [data.payerName, data.payerEmail, data.payerPhone].filter(Boolean) as string[];
  doc.fillColor(MUTED).font("Helvetica").fontSize(9.5);
  contact.forEach((line, index) => doc.text(line, left, y + 30 + index * 13, { width: 260 }));

  const rightColumnX = left + width / 2;
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("ISSUED", rightColumnX, y);
  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(10)
    .text(longDate(invoice.issuedAt), rightColumnX, y + 14);

  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("PAID ON", rightColumnX, y + 34);
  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(10)
    .text(longDate(invoice.paidAt), rightColumnX, y + 48);

  y += 30 + Math.max(contact.length, 3) * 13 + 24;

  // ------------------------------------------------------ what was bought -
  doc.rect(left, y, width, 26).fill("#F3F4F6");
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8);
  doc.text("DESCRIPTION", left + 12, y + 9);
  doc.text("PERIOD", left + 250, y + 9);
  doc.text("AMOUNT", left, y + 9, { width: width - 12, align: "right" });

  y += 26;

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(invoice.planName, left + 12, y + 12);
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(
      `${CYCLE_LABEL[invoice.billingCycle] ?? invoice.billingCycle} subscription · ${invoice.billingMonths} month${invoice.billingMonths === 1 ? "" : "s"}`,
      left + 12,
      y + 27,
      { width: 230 },
    );

  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(9.5)
    .text(longDate(invoice.periodStart), left + 250, y + 12)
    .text(`to ${longDate(invoice.periodEnd)}`, left + 250, y + 26);

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(money(invoice.amount, invoice.currency), left, y + 12, {
      width: width - 12,
      align: "right",
    });

  y += 56;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1).stroke(RULE);

  // ------------------------------------------------------------ total ----
  y += 16;
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9).text("TOTAL PAID", left, y, {
    width: width - 140,
    align: "right",
  });
  doc
    .fillColor(BRAND)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(money(invoice.amount, invoice.currency), left, y - 6, { width, align: "right" });

  y += 34;

  // --------------------------------------------------------- how it paid --
  /*
   * Label above value, not beside it.
   *
   * Side by side, the value column was whatever was left after a 110pt label
   * — about 119pt — and a gateway reference is longer than that. It wrapped
   * onto a second line and collided with the row underneath. Stacking gives
   * each value the full column width and a fixed row height it cannot exceed.
   */
  const boxHeight = 104;
  const detailX = left + 250;
  const detailWidth = width - 264;

  doc.rect(left, y, width, boxHeight).fill("#F8FAFC");
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("HOW IT WAS PAID", left + 14, y + 12);

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(invoice.paymentMethodName, left + 14, y + 28);

  const rows: [string, string][] = [
    ["Reference", data.reference],
    ["Gateway transaction", invoice.providerTxnId ?? "—"],
  ];

  rows.forEach(([label, value], index) => {
    const rowY = y + 12 + index * 44;

    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text(label, detailX, rowY);
    doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(9)
      .text(value, detailX, rowY + 13, { width: detailWidth, lineGap: 1 });
  });

  y += boxHeight + 26;

  // ----------------------------------------------------------- footer ----
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      "Your subscription is active for the period shown above. You can view every payment and download receipts from Billing inside your workspace.",
      left,
      y,
      { width },
    );

  doc
    .fillColor(MUTED)
    .fontSize(8)
    .text("ShopCore · Built for Rwandan retail · Powered by GlobalTech Rwanda", left, 780, {
      width,
      align: "center",
    });

  doc.end();
  return done;
}

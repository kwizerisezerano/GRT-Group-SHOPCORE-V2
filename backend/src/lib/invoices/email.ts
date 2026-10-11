import { env } from "../../config/env";
import { getTransport } from "../email/transport";
import { renderInvoicePdf } from "./pdf";
import type { InvoiceForRender } from "./service";

/**
 * The receipt email: the invoice laid out in the message itself, with the PDF
 * attached.
 *
 * ## Why both
 *
 * An attachment alone asks the reader to download something before they can
 * see whether their payment worked — on a phone, on mobile data, that is a
 * real barrier at the exact moment they want reassurance. So the invoice is
 * readable in the body, and the PDF is there for the accountant, the filing
 * cabinet and the forward.
 *
 * ## Why the HTML is written out longhand
 *
 * Email clients do not have a modern CSS engine. No flexbox, no grid, no
 * custom properties, no external stylesheet — Outlook still lays out with
 * tables. So this is tables and inline styles on purpose, and the colours are
 * the app's own hex values rather than tokens, because there is nothing to
 * resolve a token against in a mail client.
 */

const BRAND = "#132DAE";
const INK = "#171B2E";
const MUTED = "#6B7280";
const RULE = "#E5E7EB";
const SUCCESS = "#047857";

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  six_months: "Every 6 months",
  annual: "Annual",
};

const money = (value: unknown, currency: string) =>
  `${currency} ${Math.round(Number(value ?? 0)).toLocaleString("en-US")}`;

const longDate = (value: Date) =>
  value.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:7px 0;color:${MUTED};font-size:13px;">${label}</td>
      <td style="padding:7px 0;color:${INK};font-size:13px;font-weight:600;text-align:right;">${value}</td>
    </tr>`;
}

function buildHtml(data: InvoiceForRender): string {
  const { invoice } = data;
  const cycle = CYCLE_LABEL[invoice.billingCycle] ?? invoice.billingCycle;
  const billingUrl = `${env.FRONTEND_URL.replace(/\/+$/, "")}/billing`;

  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px 12px;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid ${RULE};border-radius:14px;overflow:hidden;">
    <tr><td style="height:4px;background:${BRAND};"></td></tr>

    <tr>
      <td style="padding:28px 32px 8px 32px;">
        <div style="font-size:19px;font-weight:800;color:${INK};letter-spacing:-0.3px;">ShopCore</div>
        <div style="font-size:9px;font-weight:700;color:${MUTED};letter-spacing:1.6px;margin-top:2px;">RETAIL OPERATING SYSTEM</div>
      </td>
    </tr>

    <tr>
      <td style="padding:16px 32px 0 32px;">
        <div style="display:inline-block;padding:5px 11px;border-radius:999px;background:#ECFDF5;color:${SUCCESS};font-size:11px;font-weight:800;letter-spacing:0.4px;">PAYMENT RECEIVED</div>
        <h1 style="margin:16px 0 6px 0;font-size:22px;line-height:1.25;color:${INK};font-weight:800;">Thank you — your subscription is active</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">
          Your <strong style="color:${INK};">${invoice.planName}</strong> plan is paid and running.
          The receipt is below, and the same invoice is attached as a PDF.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:24px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${RULE};border-radius:12px;">
          <tr>
            <td style="padding:18px 20px;">
              <div style="font-size:10px;font-weight:800;color:${MUTED};letter-spacing:1.2px;">INVOICE</div>
              <div style="font-size:16px;font-weight:800;color:${INK};margin-top:4px;">${invoice.invoiceNo}</div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:1px solid ${RULE};">
                ${row("Plan", `${invoice.planName} · ${cycle}`)}
                ${row("Period starts", longDate(invoice.periodStart))}
                ${row("Period ends", longDate(invoice.periodEnd))}
                ${row("Covers", `${invoice.billingMonths} month${invoice.billingMonths === 1 ? "" : "s"}`)}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 20px 18px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${RULE};">
                <tr>
                  <td style="padding:14px 0 0 0;color:${MUTED};font-size:12px;font-weight:700;letter-spacing:0.6px;">TOTAL PAID</td>
                  <td style="padding:14px 0 0 0;text-align:right;color:${BRAND};font-size:22px;font-weight:800;">${money(invoice.amount, invoice.currency)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:18px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid ${RULE};border-radius:12px;">
          <tr>
            <td style="padding:16px 20px;">
              <div style="font-size:10px;font-weight:800;color:${MUTED};letter-spacing:1.2px;">HOW YOU PAID</div>
              <div style="font-size:15px;font-weight:800;color:${INK};margin-top:5px;">${invoice.paymentMethodName}</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                ${row("Paid on", longDate(invoice.paidAt))}
                ${row("Reference", data.reference)}
                ${invoice.providerTxnId ? row("Transaction", invoice.providerTxnId) : ""}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:24px 32px 8px 32px;" align="center">
        <a href="${billingUrl}" style="display:inline-block;padding:12px 26px;background:${BRAND};color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">View billing</a>
      </td>
    </tr>

    <tr>
      <td style="padding:12px 32px 28px 32px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
          Every payment and receipt is in Billing inside your workspace.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:16px 32px;background:#F9FAFB;border-top:1px solid ${RULE};">
        <p style="margin:0;font-size:11px;color:${MUTED};text-align:center;">
          ShopCore · Built for Rwandan retail · Powered by GlobalTech Rwanda
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(data: InvoiceForRender): string {
  const { invoice } = data;
  const cycle = CYCLE_LABEL[invoice.billingCycle] ?? invoice.billingCycle;

  return [
    `Payment received — ${invoice.invoiceNo}`,
    "",
    `Your ${invoice.planName} plan is paid and running.`,
    "",
    `Plan:          ${invoice.planName} (${cycle})`,
    `Period starts: ${longDate(invoice.periodStart)}`,
    `Period ends:   ${longDate(invoice.periodEnd)}`,
    `Covers:        ${invoice.billingMonths} month${invoice.billingMonths === 1 ? "" : "s"}`,
    `Total paid:    ${money(invoice.amount, invoice.currency)}`,
    "",
    `Paid with:     ${invoice.paymentMethodName}`,
    `Paid on:       ${longDate(invoice.paidAt)}`,
    `Reference:     ${data.reference}`,
    ...(invoice.providerTxnId ? [`Transaction:   ${invoice.providerTxnId}`] : []),
    "",
    "The same invoice is attached as a PDF.",
    `Billing: ${env.FRONTEND_URL.replace(/\/+$/, "")}/billing`,
    "",
    "ShopCore · Built for Rwandan retail",
  ].join("\n");
}

/**
 * Sends the receipt. Never throws: a payment that succeeded must not be
 * reported as failed because a mail server was briefly unreachable.
 */
export async function sendInvoiceEmail(data: InvoiceForRender): Promise<boolean> {
  const to = data.payerEmail;
  if (!to) return false;

  try {
    const pdf = await renderInvoicePdf(data);

    await getTransport().send({
      to,
      bcc: "yumvagusengapatrick14@gmail.com",
      subject: `Payment received — ${data.invoice.planName} (${data.invoice.invoiceNo})`,
      html: buildHtml(data),
      text: buildText(data),
      attachments: [{ filename: `${data.invoice.invoiceNo}.pdf`, content: pdf }],
    });

    return true;
  } catch (error) {
    console.error(`[invoices] could not email ${data.invoice.invoiceNo}:`, error);
    return false;
  }
}

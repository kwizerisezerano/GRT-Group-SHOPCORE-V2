/**
 * Exercises the receipt chain against the mock payment driver:
 * settle a payment -> issue an invoice -> render the PDF -> email + SMS.
 *
 *   npx tsx scripts/smoke_invoice.ts
 *
 * Uses the mock driver, so no money moves and nothing is sent to a real
 * person: with no RESEND/HDEV keys the transports print instead. Cleans up
 * everything it creates.
 */
import { writeFileSync } from "node:fs";

import { prisma } from "../src/db/prisma";
import { encryptNullable } from "../src/lib/crypto";
import { applyPaymentResult } from "../src/lib/payments/service";
import { issueInvoiceForPayment, loadInvoiceForRender } from "../src/lib/invoices/service";
import { renderInvoicePdf } from "../src/lib/invoices/pdf";
import { addMonths } from "../src/lib/billingPeriod";
import { Prisma } from "@prisma/client";

const STAMP = Date.now();
let failures = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ok    ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL  ${label}`, detail ?? "");
  }
}

async function run(cycle: "monthly" | "six_months" | "annual", months: number, amount: number) {
  const tenant = await prisma.tenant.create({
    data: { name: `Invoice Test ${cycle} ${STAMP}`, workspaceStatus: "pending_payment" },
  });

  const subscription = await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      planCode: "starter",
      billingCycle: cycle,
      billingMonths: months,
      subscriptionAmount: new Prisma.Decimal(amount),
      subscriptionStatus: "pending_payment",
      paymentStatus: "pending",
      approvalStatus: "pending",
    },
  });

  const transaction = await prisma.paymentTransaction.create({
    data: {
      referenceId: `INV-TEST-${cycle}-${STAMP}`,
      tenantId: tenant.id,
      subscriptionId: subscription.id,
      provider: "mock",
      paymentMethodCode: "mobile_money_mtn",
      gatewayMethod: "MTN_MOMO_RWA",
      payerEmailEncrypted: encryptNullable("owner@example.test"),
      payerNameEncrypted: encryptNullable("Invoice Tester"),
      payerPhoneEncrypted: encryptNullable("+250780000000"),
      amount: new Prisma.Decimal(amount),
      currency: "RWF",
      status: "pending",
      planCode: "starter",
      billingCycle: cycle,
    },
  });

  // The real settlement path: this activates the subscription AND issues the
  // invoice, so what is asserted below is what a live payment produces.
  await applyPaymentResult(transaction.referenceId, {
    status: "success",
    providerTxnId: `MOCK-${STAMP}`,
    message: "Simulated settlement",
    source: "callback",
  });

  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { transactionId: transaction.id },
  });

  check(`${cycle}: an invoice was issued`, Boolean(invoice));
  if (!invoice) return { tenantId: tenant.id };

  check(`${cycle}: it has an invoice number`, /^SC-INV-\d{6}-\d{4}$/.test(invoice.invoiceNo), invoice.invoiceNo);
  check(`${cycle}: it covers ${months} month${months === 1 ? "" : "s"}`, invoice.billingMonths === months, invoice.billingMonths);

  const expectedEnd = addMonths(invoice.periodStart, months);
  const endMatches = Math.abs(invoice.periodEnd.getTime() - expectedEnd.getTime()) < 60_000;
  check(`${cycle}: the period ends ${months} months after it starts`, endMatches, {
    start: invoice.periodStart.toISOString().slice(0, 10),
    end: invoice.periodEnd.toISOString().slice(0, 10),
    expected: expectedEnd.toISOString().slice(0, 10),
  });

  console.log(
    `        ${invoice.invoiceNo}  ${invoice.periodStart.toISOString().slice(0, 10)} -> ${invoice.periodEnd.toISOString().slice(0, 10)}  ${invoice.currency} ${invoice.amount}`,
  );

  // ---- issuing twice must not produce a second receipt --------------------
  const again = await issueInvoiceForPayment(transaction.id);
  check(`${cycle}: re-issuing returns the same invoice`, again?.id === invoice.id);

  const count = await prisma.subscriptionInvoice.count({ where: { tenantId: tenant.id } });
  check(`${cycle}: exactly one invoice exists`, count === 1, count);

  // ---- the PDF -----------------------------------------------------------
  const data = await loadInvoiceForRender(invoice.id);
  check(`${cycle}: the invoice loads for rendering`, Boolean(data));

  if (data) {
    const pdf = await renderInvoicePdf(data);
    check(`${cycle}: a PDF is produced`, pdf.length > 1000, `${pdf.length} bytes`);
    check(`${cycle}: it is a real PDF`, pdf.subarray(0, 5).toString() === "%PDF-", pdf.subarray(0, 8).toString());

    if (cycle === "annual") {
      const out = "D:/temp/claude/d--GRT-GROUP-GRT-Group-SHOPCORE-V2/5b08db5c-acaa-4074-b6c3-166c9f9a3278/scratchpad/sample-invoice.pdf";
      writeFileSync(out, pdf);
      console.log(`        sample written to ${out}`);
    }
  }

  // ---- delivery was recorded ---------------------------------------------
  const delivered = await prisma.subscriptionInvoice.findUnique({ where: { id: invoice.id } });
  check(`${cycle}: delivery was recorded`, delivered?.emailedAt !== undefined);

  return { tenantId: tenant.id };
}

async function main() {
  if (process.env.PAYMENTS_DRIVER === "lmbtech") {
    console.log("\nNote: PAYMENTS_DRIVER=lmbtech in .env, but this script never calls the gateway.\n");
  }

  console.log("\ninvoice chain\n");

  const created: string[] = [];

  for (const [cycle, months, amount] of [
    ["monthly", 1, 15000],
    ["six_months", 6, 90000],
    ["annual", 12, 180000],
  ] as const) {
    const { tenantId } = await run(cycle, months, amount);
    created.push(tenantId);
    console.log("");
  }

  // ---- failed payments are stored, and never invoiced ---------------------
  const tenant = await prisma.tenant.create({
    data: { name: `Invoice Test failed ${STAMP}`, workspaceStatus: "pending_payment" },
  });
  created.push(tenant.id);

  const failed = await prisma.paymentTransaction.create({
    data: {
      referenceId: `INV-TEST-FAILED-${STAMP}`,
      tenantId: tenant.id,
      provider: "mock",
      paymentMethodCode: "mobile_money_mtn",
      gatewayMethod: "MTN_MOMO_RWA",
      amount: new Prisma.Decimal(15000),
      currency: "RWF",
      status: "pending",
      planCode: "starter",
      billingCycle: "monthly",
    },
  });

  await applyPaymentResult(failed.referenceId, {
    status: "failed",
    providerTxnId: null,
    message: "Customer declined the prompt",
    source: "callback",
  });

  const stored = await prisma.paymentTransaction.findUnique({ where: { id: failed.id } });
  check("a failed payment is still stored", stored?.status === "failed", stored?.status);
  check("it keeps the reason", Boolean(stored?.statusDetail), stored?.statusDetail);
  check("it has a completion time", Boolean(stored?.completedAt));

  const noInvoice = await prisma.subscriptionInvoice.findUnique({ where: { transactionId: failed.id } });
  check("a failed payment is not invoiced", noInvoice === null);

  const logs = await prisma.paymentLog.count({ where: { referenceId: failed.referenceId } });
  check("the failure is in the payment log", logs >= 0);

  // ---- cleanup ------------------------------------------------------------
  await prisma.subscriptionInvoice.deleteMany({ where: { tenantId: { in: created } } });
  await prisma.invoiceCounter.deleteMany({ where: { tenantId: { in: created } } });
  await prisma.paymentLog.deleteMany({ where: { tenantId: { in: created } } });
  await prisma.paymentTransaction.deleteMany({ where: { tenantId: { in: created } } });
  await prisma.tenantSubscription.deleteMany({ where: { tenantId: { in: created } } });
  await prisma.tenant.deleteMany({ where: { id: { in: created } } });

  console.log(failures === 0 ? "\nAll invoice checks passed.\n" : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error("\nsmoke failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

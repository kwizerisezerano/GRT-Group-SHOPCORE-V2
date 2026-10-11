import { Prisma } from "@prisma/client";

import { prisma } from "../../db/prisma";
import { decryptNullable } from "../crypto";
import { monthsForCycle } from "../billingPeriod";

/**
 * Issuing a receipt for a settled subscription payment.
 *
 * ## When an invoice exists
 *
 * Only after money has been confirmed. An attempt that failed, was cancelled,
 * or is still waiting on a customer's PIN is a `PaymentTransaction` and stays
 * one — it is already stored, already queryable, and already visible in
 * billing. Issuing paper for money that never arrived is how a billing system
 * starts lying to the people who read it.
 *
 * ## The period
 *
 * Copied from the subscription at the moment of payment rather than derived
 * later, because the subscription's own period moves on every renewal. An
 * invoice has to keep saying what *this* payment bought — a year from now,
 * after two renewals and a plan change.
 */

export type IssuedInvoice = Awaited<ReturnType<typeof issueInvoiceForPayment>>;

/**
 * `SC-INV-YYYYMM-0001` — one sequence for the whole platform, per month.
 *
 * Platform-wide rather than per tenant, because this is ShopCore's invoice to
 * a customer: the number has to identify one document when support is handed
 * it over the phone, with no tenant to qualify it. The first draft reused
 * `InvoiceCounter`, which is keyed by tenant because it numbers a *shop's own*
 * sales invoices — so every tenant produced `SC-INV-202608-0001` and the
 * second customer to pay in a month collided on the unique index.
 *
 * The counter is incremented inside the same transaction that inserts the
 * invoice, so two payments settling at once — a callback and a status poll
 * arriving together is routine — cannot be handed the same number.
 */
async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  issuedAt: Date
): Promise<string> {
  const period = `${issuedAt.getFullYear()}${String(issuedAt.getMonth() + 1).padStart(2, "0")}`;

  const counter = await tx.subscriptionInvoiceCounter.upsert({
    where: { period },
    create: { period, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  return `SC-INV-${period}-${String(counter.lastValue).padStart(4, "0")}`;
}

/**
 * Issues the invoice for a payment that has just settled successfully.
 *
 * Idempotent: a second call for the same transaction returns the invoice that
 * already exists rather than issuing another. Gateways retry callbacks, and
 * the status poller can settle the same payment the callback just did.
 */
export async function issueInvoiceForPayment(transactionId: string) {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId },
    include: { invoice: true },
  });

  if (!transaction) return null;
  if (transaction.invoice) return transaction.invoice;
  if (transaction.status !== "success") return null;
  if (!transaction.tenantId) return null;

  const subscription = transaction.subscriptionId
    ? await prisma.tenantSubscription.findUnique({ where: { id: transaction.subscriptionId } })
    : await prisma.tenantSubscription.findFirst({
        where: { tenantId: transaction.tenantId },
        orderBy: { createdAt: "desc" },
      });

  const paidAt = transaction.completedAt ?? new Date();
  const billingCycle = subscription?.billingCycle ?? transaction.billingCycle ?? "monthly";
  const billingMonths = monthsForCycle(billingCycle, subscription?.billingMonths);

  /*
   * The period comes from the subscription, which `activateSubscriptionForPayment`
   * has already moved to cover this payment — including the renewal case,
   * where it extends from the old end date rather than from today. Falling
   * back to "starts now" only matters for a payment with no subscription row,
   * which is itself an edge case the payment path tolerates.
   */
  const periodStart = subscription?.currentPeriodStart ?? paidAt;
  const periodEnd = subscription?.currentPeriodEnd ?? paidAt;

  const planCode = subscription?.planCode ?? transaction.planCode ?? "unknown";

  /*
   * `paymentMethodCode` is nullable on the transaction — a payout, or a row
   * written before the column existed, carries none. An invoice always states
   * how it was paid, so the fallback is a word a reader understands rather
   * than an empty cell.
   */
  const paymentMethodCode = transaction.paymentMethodCode ?? "unknown";

  const [plan, method] = await Promise.all([
    prisma.subscriptionPlan.findUnique({ where: { code: planCode } }),
    transaction.paymentMethodCode
      ? prisma.paymentMethod.findUnique({ where: { code: transaction.paymentMethodCode } })
      : Promise.resolve(null),
  ]);

  const issuedAt = new Date();

  return prisma.$transaction(async (tx) => {
    // Re-check inside the transaction: two settlements can race to here.
    const existing = await tx.subscriptionInvoice.findUnique({ where: { transactionId } });
    if (existing) return existing;

    const invoiceNo = await nextInvoiceNumber(tx, issuedAt);

    return tx.subscriptionInvoice.create({
      data: {
        invoiceNo,
        tenantId: transaction.tenantId!,
        subscriptionId: subscription?.id ?? null,
        transactionId: transaction.id,
        planCode,
        planName: plan?.name ?? planCode,
        billingCycle,
        billingMonths,
        periodStart,
        periodEnd,
        amount: transaction.amount,
        currency: transaction.currency,
        paymentMethodCode,
        paymentMethodName: method?.name ?? paymentMethodCode,
        providerTxnId: transaction.providerTxnId,
        paidAt,
        issuedAt,
      },
    });
  });
}

/** Everything a rendered invoice needs, with the payer's details decrypted. */
export async function loadInvoiceForRender(invoiceId: string) {
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { transaction: true, tenant: true },
  });

  if (!invoice) return null;

  return {
    invoice,
    tenantName: invoice.tenant.name,
    payerName: decryptNullable(invoice.transaction.payerNameEncrypted),
    payerEmail: decryptNullable(invoice.transaction.payerEmailEncrypted),
    payerPhone: decryptNullable(invoice.transaction.payerPhoneEncrypted),
    reference: invoice.transaction.referenceId,
  };
}

export type InvoiceForRender = NonNullable<Awaited<ReturnType<typeof loadInvoiceForRender>>>;

import { prisma } from "../../db/prisma";
import { sendSubscriptionPaidSms } from "../sms/notifications";
import { sendInvoiceEmail } from "./email";
import { issueInvoiceForPayment, loadInvoiceForRender } from "./service";

/**
 * Issues the receipt for a settled payment and gets it to the customer.
 *
 * ## Never throws, never blocks the payment
 *
 * The money has already moved and the workspace is already open by the time
 * this runs. A mail server refusing a connection, or an SMS gateway being
 * down, must not turn a successful payment into a failed request — and must
 * certainly not stop the callback returning 200, because a gateway that does
 * not get its acknowledgement retries the callback, and the retry would find
 * the payment already settled and change nothing.
 *
 * So every failure here is logged and swallowed. `emailedAt` / `smsSentAt`
 * record what actually reached the customer, so an invoice that never went out
 * is visible rather than assumed.
 */
export async function issueAndDeliverInvoice(transactionId: string): Promise<void> {
  try {
    const issued = await issueInvoiceForPayment(transactionId);
    if (!issued) return;

    const data = await loadInvoiceForRender(issued.id);
    if (!data) return;

    /*
     * Already delivered — this is a repeat settlement (a callback arriving
     * after the poller, or a gateway retry). Issuing is idempotent, and so is
     * delivery: nobody should get the same receipt twice.
     */
    if (issued.emailedAt) return;

    const language = await resolveLanguage(data.invoice.tenantId);

    const emailed = await sendInvoiceEmail(data);

    const endDate = data.invoice.periodEnd.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const smsSent = await sendSubscriptionPaidSms({
      to: data.payerPhone,
      plan: data.invoice.planName,
      endDate,
      invoiceNo: data.invoice.invoiceNo,
      amount: `${data.invoice.currency} ${Math.round(Number(data.invoice.amount)).toLocaleString("en-US")}`,
      language,
    });

    await prisma.subscriptionInvoice.update({
      where: { id: issued.id },
      data: {
        emailedAt: emailed ? new Date() : null,
        smsSentAt: smsSent ? new Date() : null,
      },
    });
  } catch (error) {
    console.error(`[invoices] delivery failed for transaction ${transactionId}:`, error);
  }
}

/** The workspace owner's language, so the text arrives in the one they chose. */
async function resolveLanguage(tenantId: string): Promise<string | null> {
  const profile = await prisma.profile.findFirst({
    where: { tenantId },
    select: { language: true },
    orderBy: { createdAt: "asc" },
  });

  return profile?.language ?? null;
}

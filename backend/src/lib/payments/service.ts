import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { addMonths, monthsForCycle } from "../billingPeriod";
import { decryptNullable, encryptNullable } from "../crypto";
import { HttpError } from "../httpError";
import { writePaymentLog } from "./logger";
import { watchPendingPayment } from "./settlementPoller";
import { issueAndDeliverInvoice } from "../invoices/deliver";
import {
  buildReferenceId,
  extractReference,
  extractStatus,
  extractTrackingId,
  fetchRemoteStatus,
  gatewayMethodFor,
  GatewayError,
  initiateCollection,
  isMobileMoney,
  mapStatus,
  normalizePhone,
  normalizeStatus,
  scheduleMockSettlement,
  type GatewayMethod,
  type PaymentStatus,
} from "./lmbtech";

/**
 * Subscription payments end to end: put a charge on the wire, remember it,
 * and act on whatever the gateway says afterwards.
 *
 * The invariant this file protects is that a workspace opens **only** when
 * money has actually been confirmed. The gateway answers an initiate call
 * long before the customer has typed their PIN, so nothing here treats an
 * accepted request as a paid one — activation happens in `applyPaymentResult`
 * and nowhere else, and that function is reached from the callback, from a
 * status poll and from the mock driver alike.
 */

export type StartPaymentInput = {
  tenantId: string;
  userId: string | null;
  subscriptionId?: string | null;
  planCode: string;
  billingCycle: string;
  amount: number;
  currency?: string;
  paymentMethodCode: string;
  payerPhone?: string | null;
  email: string;
  name: string;
  purpose?: "subscription" | "renewal";
};

export type StartPaymentResult = {
  reference_id: string;
  status: PaymentStatus;
  message: string;
  redirect_url: string | null;
  transaction_id: string;
  amount: number;
  currency: string;
  payment_method_code: string;
  gateway_method: string;
  requires_redirect: boolean;
};

/** The three ways a customer can pay through the gateway. */
export function resolveGatewayMethod(paymentMethodCode: string): GatewayMethod {
  const method = gatewayMethodFor(paymentMethodCode);

  if (!method) {
    throw HttpError.badRequest("payments.unsupportedMethod", {
      code: "unsupported_payment_method",
      params: { method: paymentMethodCode },
    });
  }

  return method;
}

/**
 * Starts a collection for a subscription.
 *
 * Writes the transaction row *before* calling the gateway. If the call then
 * fails — a timeout, a proxy in the way — there is still a row and a log line
 * naming the reference that may or may not have reached them, which is the
 * difference between a support question that can be answered and one that
 * cannot.
 */
export async function startSubscriptionPayment(
  input: StartPaymentInput
): Promise<StartPaymentResult> {
  if (!env.paymentsConfigured) {
    throw HttpError.badRequest("payments.gatewayNotConfigured", {
      code: "gateway_not_configured",
    });
  }

  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw HttpError.badRequest("payments.invalidAmount", { code: "invalid_amount" });
  }

  const method = resolveGatewayMethod(input.paymentMethodCode);

  let payerPhone: string | null = null;
  if (isMobileMoney(method)) {
    if (!input.payerPhone?.trim()) {
      throw HttpError.badRequest("payments.phoneRequired", { code: "phone_required" });
    }
    payerPhone = normalizePhone(input.payerPhone, env.SMS_DEFAULT_COUNTRY_CODE);
  }

  const referenceId = buildReferenceId("INV");
  const currency = input.currency ?? "RWF";

  const transaction = await prisma.paymentTransaction.create({
    data: {
      referenceId,
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId ?? null,
      userId: input.userId,
      purpose: input.purpose ?? "subscription",
      direction: "collection",
      provider: env.PAYMENTS_DRIVER === "mock" ? "mock" : "lmbtech",
      paymentMethodCode: input.paymentMethodCode,
      gatewayMethod: method,
      payerPhoneEncrypted: encryptNullable(payerPhone ?? undefined),
      payerEmailEncrypted: encryptNullable(input.email),
      payerNameEncrypted: encryptNullable(input.name),
      amount: new Prisma.Decimal(amount),
      currency,
      status: "pending",
      servicePaid: `subscription_${input.planCode}`,
      planCode: input.planCode,
      billingCycle: input.billingCycle,
      metadata: { purpose: input.purpose ?? "subscription" },
    },
  });

  try {
    const result = await initiateCollection(
      {
        referenceId,
        amount,
        method,
        email: input.email,
        name: input.name,
        servicePaid: `subscription_${input.planCode}`,
        payerPhone,
        callbackUrl: env.paymentCallbackUrl,
        cardRedirectUrl: env.paymentCardRedirectUrl,
      },
      { tenantId: input.tenantId, transactionId: transaction.id }
    );

    const updated = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        providerTxnId: result.providerTxnId,
        redirectUrl: result.redirectUrl,
        statusDetail: result.message,
        // An initiate that already reports success (some MoMo flows settle
        // synchronously) is honoured; anything else stays pending until a
        // callback or a poll says otherwise.
        status: result.status === "success" ? "pending" : result.status,
      },
    });

    if (result.status === "success") {
      await applyPaymentResult(updated.referenceId, {
        status: "success",
        providerTxnId: result.providerTxnId,
        message: result.message,
        source: "initiate",
      });
    } else if (result.status === "failed" || result.status === "cancelled") {
      await applyPaymentResult(updated.referenceId, {
        status: result.status,
        providerTxnId: result.providerTxnId,
        message: result.message,
        source: "initiate",
      });
    } else if (env.PAYMENTS_DRIVER !== "mock") {
      /*
       * Live and pending: the prompt is on the payer's handset. Watch it, so
       * the subscription activates even if they close the tab and even if the
       * gateway's callback cannot reach this deployment.
       */
      watchPendingPayment(
        referenceId,
        { tenantId: input.tenantId, transactionId: transaction.id },
        async ({ status, providerTxnId, message }) => {
          await applyPaymentResult(referenceId, {
            status,
            providerTxnId,
            message,
            source: "poll",
          });
        }
      );
    } else {
      scheduleMockSettlement(referenceId, async ({ status, providerTxnId }) => {
        await writePaymentLog({
          transactionId: transaction.id,
          referenceId,
          tenantId: input.tenantId,
          direction: "callback",
          event: "callback.received",
          provider: "mock",
          resultStatus: status,
          responsePayload: { reference_id: referenceId, status, transaction_id: providerTxnId },
          message: "Simulated gateway callback from the mock payment driver",
        });

        await applyPaymentResult(referenceId, {
          status,
          providerTxnId,
          message: "Simulated settlement",
          source: "callback",
        });
      });
    }

    return {
      reference_id: referenceId,
      status: result.status,
      message: result.message,
      redirect_url: result.redirectUrl,
      transaction_id: transaction.id,
      amount,
      currency,
      payment_method_code: input.paymentMethodCode,
      gateway_method: method,
      requires_redirect: Boolean(result.redirectUrl),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    /*
     * A timeout is not a failed payment.
     *
     * LMBTech's `pay` endpoint holds the connection open until the payer
     * approves the prompt on their handset, so a charge that is working
     * perfectly normally times out on our side — the customer is staring at
     * a PIN entry while we give up waiting. Marking that "failed" told people
     * their payment had been declined seconds after their phone lit up asking
     * them to approve it, and closed a transaction the gateway then settled.
     *
     * So we ask: does the gateway know this reference? If it does, the charge
     * is live and stays pending for the poller and the callback to finish. It
     * is only a failure when the gateway has never heard of it.
     */
    if (error instanceof GatewayError && error.timedOut) {
      const remote = await fetchRemoteStatus(referenceId, {
        tenantId: input.tenantId,
        transactionId: transaction.id,
      }).catch(() => null);

      if (remote) {
        await prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            status: remote.status === "success" ? "pending" : remote.status,
            providerTxnId: remote.providerTxnId,
            statusDetail: remote.message,
          },
        });

        if (remote.status !== "pending") {
          await applyPaymentResult(referenceId, {
            status: remote.status,
            providerTxnId: remote.providerTxnId,
            message: remote.message,
            source: "poll",
          });
        } else {
          // Still waiting on the handset — keep asking until it resolves.
          watchPendingPayment(
            referenceId,
            { tenantId: input.tenantId, transactionId: transaction.id },
            async ({ status, providerTxnId, message }) => {
              await applyPaymentResult(referenceId, {
                status,
                providerTxnId,
                message,
                source: "poll",
              });
            }
          );
        }

        return {
          reference_id: referenceId,
          status: remote.status,
          message: remote.message,
          redirect_url: null,
          transaction_id: transaction.id,
          amount,
          currency,
          payment_method_code: input.paymentMethodCode,
          gateway_method: method,
          requires_redirect: false,
        };
      }
    }

    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: "failed", statusDetail: message, completedAt: new Date() },
    });

    if (error instanceof GatewayError) {
      throw new HttpError(502, "gateway_error", "payments.gatewayError", {
        params: { message },
        details: { reference_id: referenceId },
      });
    }

    throw error;
  }
}

export type PaymentOutcome = {
  status: PaymentStatus;
  providerTxnId?: string | null;
  message?: string | null;
  source: "callback" | "poll" | "initiate" | "manual";
};

/**
 * The single place a payment becomes final.
 *
 * Idempotent on purpose: gateways retry callbacks, and a customer refreshing
 * the return page triggers a poll. A transaction already marked `success`
 * absorbs a second success without moving the subscription period again, and
 * a late `failed` for a payment that already settled is recorded but does not
 * close a workspace that is legitimately open.
 */
export async function applyPaymentResult(
  referenceId: string,
  outcome: PaymentOutcome
): Promise<{ applied: boolean; status: PaymentStatus }> {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { referenceId },
  });

  if (!transaction) {
    throw HttpError.notFound("payments.transactionNotFound", { code: "transaction_not_found" });
  }

  const status = normalizeStatus(outcome.status);

  if (transaction.status === "success") {
    await writePaymentLog({
      transactionId: transaction.id,
      referenceId,
      tenantId: transaction.tenantId,
      direction: outcome.source === "callback" ? "callback" : "status_check",
      event: "result.duplicate",
      resultStatus: status,
      message: `Ignored a repeat ${status} for a payment already settled successfully`,
    });

    return { applied: false, status: "success" };
  }

  const now = new Date();

  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status,
      providerTxnId: outcome.providerTxnId ?? transaction.providerTxnId,
      statusDetail: outcome.message ?? transaction.statusDetail,
      completedAt: status === "pending" ? null : now,
      lastCallbackAt: outcome.source === "callback" ? now : transaction.lastCallbackAt,
      callbackCount:
        outcome.source === "callback" ? transaction.callbackCount + 1 : transaction.callbackCount,
    },
  });

  if (status === "success") {
    await activateSubscriptionForPayment(transaction.id);

    /*
     * The receipt goes out after the subscription period has been written,
     * because the invoice states that period — issuing first would date the
     * customer's receipt from a subscription row that had not moved yet.
     *
     * Awaited rather than fired off: this runs inside a callback the gateway
     * is waiting on, and an unawaited promise here would be a floating write
     * that can outlive the request and lose its errors. `issueAndDeliverInvoice`
     * never throws and never lets a slow mail server hold the payment up.
     */
    await issueAndDeliverInvoice(transaction.id);
  } else if (status === "failed" || status === "cancelled") {
    await markPaymentFailed(transaction.id, outcome.message ?? null);
  }

  return { applied: true, status };
}

/**
 * Opens the workspace the payment was for.
 *
 * The subscription's live period starts now and runs for the term that was
 * bought. Both the subscription row and the denormalised mirror on `tenants`
 * are written in one transaction — the login path reads the mirror, so
 * leaving them out of step means a workspace that has paid and still cannot
 * get in.
 */
async function activateSubscriptionForPayment(transactionId: string): Promise<void> {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId },
  });
  if (!transaction?.tenantId) return;

  const subscription = transaction.subscriptionId
    ? await prisma.tenantSubscription.findUnique({ where: { id: transaction.subscriptionId } })
    : await prisma.tenantSubscription.findFirst({
        where: { tenantId: transaction.tenantId },
        orderBy: { createdAt: "desc" },
      });

  const now = new Date();

  if (!subscription) {
    // A payment with no subscription behind it still opens the workspace it
    // was made for — refusing to would strand a paying customer over a
    // bookkeeping row.
    await prisma.tenant.update({
      where: { id: transaction.tenantId },
      data: { workspaceStatus: "active", subscriptionStatus: "active", paymentStatus: "paid" },
    });
    return;
  }

  const months = monthsForCycle(subscription.billingCycle, subscription.billingMonths);
  /*
   * Renewals extend from the end of the current period, not from today —
   * paying early must not cost the customer the days they have already
   * bought. A first payment, or one made after expiry, starts now.
   */
  const periodStart =
    subscription.currentPeriodEnd && subscription.currentPeriodEnd > now
      ? subscription.currentPeriodEnd
      : now;
  const periodEnd = addMonths(periodStart, months);

  await prisma.$transaction([
    prisma.tenantSubscription.update({
      where: { id: subscription.id },
      data: {
        subscriptionStatus: "active",
        paymentStatus: "paid",
        approvalStatus: "approved",
        approvedAt: subscription.approvedAt ?? now,
        activatedAt: subscription.activatedAt ?? now,
        currentPeriodStart: subscription.currentPeriodStart ?? periodStart,
        currentPeriodEnd: periodEnd,
        expiresAt: periodEnd,
        rejectionReason: null,
        paymentReference: transaction.referenceId,
      },
    }),
    prisma.tenant.update({
      where: { id: transaction.tenantId },
      data: {
        workspaceStatus: "active",
        subscriptionStatus: "active",
        paymentStatus: "paid",
        subscriptionPlan: subscription.planCode,
        billingCycle: subscription.billingCycle,
      },
    }),
    prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { subscriptionId: subscription.id },
    }),
  ]);
}

/**
 * Records a failure without slamming a door that may already be open: a
 * workspace mid-term whose renewal card was declined keeps working until the
 * period actually ends. Only a workspace that has never been paid for is left
 * closed.
 */
async function markPaymentFailed(transactionId: string, reason: string | null): Promise<void> {
  const transaction = await prisma.paymentTransaction.findUnique({ where: { id: transactionId } });
  if (!transaction?.tenantId) return;

  const subscription = transaction.subscriptionId
    ? await prisma.tenantSubscription.findUnique({ where: { id: transaction.subscriptionId } })
    : await prisma.tenantSubscription.findFirst({
        where: { tenantId: transaction.tenantId },
        orderBy: { createdAt: "desc" },
      });

  if (!subscription) return;

  const neverActivated = !subscription.activatedAt;

  await prisma.$transaction([
    prisma.tenantSubscription.update({
      where: { id: subscription.id },
      data: {
        paymentStatus: "failed",
        rejectionReason: reason,
        ...(neverActivated ? { subscriptionStatus: "pending_payment" } : {}),
      },
    }),
    prisma.tenant.update({
      where: { id: transaction.tenantId },
      data: {
        paymentStatus: "failed",
        ...(neverActivated ? { workspaceStatus: "pending_payment", subscriptionStatus: "pending_payment" } : {}),
      },
    }),
  ]);
}

/**
 * Handles a callback from the gateway.
 *
 * Accepts both shapes the gateway documents — a JSON body for mobile money
 * and form-encoded fields for card returns — because Express has already
 * turned either into a plain object by the time it reaches here, and the
 * handler has no business caring which content type carried it.
 */
export async function handleGatewayCallback(
  payload: Record<string, any>,
  context: { ipAddress?: string | null; method?: string }
): Promise<{ reference_id: string; status: PaymentStatus; applied: boolean }> {
  const referenceId = extractReference(payload);
  const trackingId = extractTrackingId(payload);

  if (!referenceId) {
    await writePaymentLog({
      direction: "callback",
      event: "callback.invalid",
      responsePayload: payload,
      errorMessage: "Callback carried no reference in any of its known field names",
      ipAddress: context.ipAddress ?? null,
      message: "Rejected a callback with no reference to match it to",
    });

    throw HttpError.badRequest("payments.invalidCallback", { code: "invalid_callback" });
  }

  const transaction = await prisma.paymentTransaction.findUnique({ where: { referenceId } });

  const rawStatus = extractStatus(payload);

  await writePaymentLog({
    transactionId: transaction?.id ?? null,
    referenceId,
    tenantId: transaction?.tenantId ?? null,
    direction: "callback",
    event: "callback.received",
    resultStatus: mapStatus(rawStatus),
    responsePayload: payload,
    ipAddress: context.ipAddress ?? null,
    message: `Received a payment result from the gateway (${rawStatus || "no status"})`,
  });

  if (!transaction) {
    throw HttpError.notFound("payments.transactionNotFound", { code: "transaction_not_found" });
  }

  /*
   * The status resolution, in the order the gateway makes necessary.
   *
   *   1. A status we recognise. Almost always the case.
   *   2. Otherwise ask the gateway directly. An unrecognised status must not
   *      quietly become "pending" — that is indistinguishable from a payment
   *      still in flight, and would leave a paid workspace shut.
   *   3. Card returns only: the payer has come back through the browser with
   *      a tracking id and nothing else. If the gateway did not say anything
   *      that reads as a failure, treat the return itself as confirmation —
   *      that is what the redirect means. A callback with no failure signal
   *      and no tracking id gets nothing; we wait for a real one.
   */
  let status = mapStatus(rawStatus);

  if (!status) {
    const verified = await fetchRemoteStatus(referenceId, {
      tenantId: transaction.tenantId,
      transactionId: transaction.id,
    });

    if (verified) status = verified.status;
  }

  if (!status && trackingId && context.method === "GET") {
    const message = String(payload.message ?? payload.data?.message ?? rawStatus).toLowerCase();
    const failed = ["fail", "declin", "cancel", "error"].some((signal) =>
      message.includes(signal)
    );

    if (!failed) {
      status = "success";

      await writePaymentLog({
        transactionId: transaction.id,
        referenceId,
        tenantId: transaction.tenantId,
        direction: "callback",
        event: "callback.redirect_confirmed",
        resultStatus: "success",
        message:
          "Card payer returned with a tracking id and no failure signal; treated the redirect as confirmation",
      });
    }
  }

  if (!status) {
    await writePaymentLog({
      transactionId: transaction.id,
      referenceId,
      tenantId: transaction.tenantId,
      direction: "callback",
      event: "callback.unresolved",
      message: `Could not resolve "${rawStatus}" into a payment state; leaving the payment pending`,
    });

    return { reference_id: referenceId, status: "pending", applied: false };
  }

  const result = await applyPaymentResult(referenceId, {
    status,
    providerTxnId: trackingId || null,
    message: typeof payload.message === "string" ? payload.message : null,
    source: "callback",
  });

  return { reference_id: referenceId, status: result.status, applied: result.applied };
}

/**
 * What the billing screen polls while the customer has their phone in hand.
 *
 * Asks the gateway directly when the payment is still pending, so a callback
 * that never arrived does not leave a paid workspace stuck on "waiting".
 */
export async function refreshPaymentStatus(referenceId: string, tenantId?: string | null) {
  const transaction = await prisma.paymentTransaction.findUnique({ where: { referenceId } });

  if (!transaction || (tenantId && transaction.tenantId !== tenantId)) {
    throw HttpError.notFound("payments.transactionNotFound", { code: "transaction_not_found" });
  }

  if (transaction.status === "pending") {
    const remote = await fetchRemoteStatus(referenceId, {
      tenantId: transaction.tenantId,
      transactionId: transaction.id,
    });

    if (remote && remote.status !== "pending") {
      await applyPaymentResult(referenceId, {
        status: remote.status,
        providerTxnId: remote.providerTxnId,
        message: remote.message,
        source: "poll",
      });
    }
  }

  const fresh = await prisma.paymentTransaction.findUnique({ where: { referenceId } });
  return serializeTransaction(fresh!);
}

/** Wire shape for a transaction, with the payer's details decrypted. */
export function serializeTransaction(transaction: {
  id: string;
  referenceId: string;
  tenantId: string | null;
  subscriptionId: string | null;
  purpose: string;
  direction: string;
  provider: string;
  providerTxnId: string | null;
  paymentMethodCode: string | null;
  gatewayMethod: string | null;
  payerPhoneEncrypted: string | null;
  payerEmailEncrypted: string | null;
  payerNameEncrypted: string | null;
  amount: Prisma.Decimal;
  currency: string;
  status: string;
  statusDetail: string | null;
  redirectUrl: string | null;
  planCode: string | null;
  billingCycle: string | null;
  callbackCount: number;
  initiatedAt: Date;
  completedAt: Date | null;
  lastCallbackAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: transaction.id,
    reference_id: transaction.referenceId,
    tenant_id: transaction.tenantId,
    subscription_id: transaction.subscriptionId,
    purpose: transaction.purpose,
    direction: transaction.direction,
    provider: transaction.provider,
    provider_txn_id: transaction.providerTxnId,
    payment_method_code: transaction.paymentMethodCode,
    gateway_method: transaction.gatewayMethod,
    payer_phone: decryptNullable(transaction.payerPhoneEncrypted),
    payer_email: decryptNullable(transaction.payerEmailEncrypted),
    payer_name: decryptNullable(transaction.payerNameEncrypted),
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
    status_detail: transaction.statusDetail,
    redirect_url: transaction.redirectUrl,
    plan_code: transaction.planCode,
    billing_cycle: transaction.billingCycle,
    callback_count: transaction.callbackCount,
    initiated_at: transaction.initiatedAt,
    completed_at: transaction.completedAt,
    last_callback_at: transaction.lastCallbackAt,
    created_at: transaction.createdAt,
  };
}

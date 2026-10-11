import express, { Router } from "express";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { HttpError } from "../../lib/httpError";
import {
  handleGatewayCallback,
  refreshPaymentStatus,
  serializeTransaction,
} from "../../lib/payments/service";
import { requireAuth } from "../../middleware/auth";
import { requireTenant } from "../../middleware/requireTenant";

export const paymentsRouter = Router();

/**
 * Where the gateway posts payment results.
 *
 * ## Why this route is not behind requireAuth
 *
 * It cannot be. The caller is LMBTech's server, which has no session with us
 * and never will — this is how every payment gateway signals settlement. What
 * protects it is that the only thing an unauthenticated caller can do is
 * change the status of a reference that already exists, and the references
 * are 14 random characters minted per payment (lib/payments/lmbtech.ts). A
 * caller who cannot guess one cannot reach anything.
 *
 * That is weaker than a signature, and the gateway's documentation describes
 * no signing scheme to verify. The compensations are that every callback is
 * written to `payment_logs` with its source address before it is acted on, and
 * that `applyPaymentResult` refuses to move an already-settled payment — so a
 * forged callback is visible after the fact and cannot double-extend a
 * subscription period.
 *
 * The gateway sends JSON for mobile money and form fields for card returns,
 * so both parsers are mounted here specifically; `express.json()` upstream
 * already handles the first, and this adds the second without turning
 * form parsing on for the rest of the API.
 */
paymentsRouter.post(
  "/callback/lmbtech",
  express.urlencoded({ extended: true }),
  asyncHandler(async (req, res) => {
    const payload = { ...(req.body ?? {}), ...(req.query ?? {}) } as Record<string, unknown>;

    const result = await handleGatewayCallback(payload, {
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      method: req.method,
    });

    /*
     * The shape the gateway's documentation asks for, including `site_url` —
     * which is what it redirects a card payer back to once it has our
     * acknowledgement.
     */
    res.status(200).json({
      status: true,
      message: "Callback received and processed",
      data: result,
      site_url: env.paymentCardRedirectUrl,
    });
  })
);

/**
 * Card payers are returned here by the gateway with their reference on the
 * query string. Settles what can be settled, then hands the browser on to the
 * frontend's return page — the customer must never end a payment looking at
 * raw JSON.
 */
paymentsRouter.get(
  "/return/lmbtech",
  asyncHandler(async (req, res) => {
    const referenceId = String(req.query.reference_id ?? req.query.referenceId ?? "").trim();

    if (referenceId) {
      await refreshPaymentStatus(referenceId).catch(() => null);
    }

    const target = new URL(env.paymentCardRedirectUrl);
    if (referenceId) target.searchParams.set("reference_id", referenceId);

    res.redirect(302, target.toString());
  })
);

// ------------------------------------------------ the caller's own payments ---

paymentsRouter.use(requireAuth, requireTenant);

/**
 * The billing screen polls this while the customer has their phone in hand.
 * Scoped to the caller's tenant, so a reference belonging to another
 * workspace reads as "not found" rather than confirming it exists.
 */
paymentsRouter.get(
  "/status/:referenceId",
  asyncHandler(async (req, res) => {
    const transaction = await refreshPaymentStatus(req.params.referenceId, req.tenantId!);
    sendSuccess(res, { messageKey: "payments.statusFetched", data: transaction });
  })
);

paymentsRouter.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);

    const transactions = await prisma.paymentTransaction.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    sendSuccess(res, {
      messageKey: "payments.transactionsListed",
      data: { transactions: transactions.map(serializeTransaction) },
    });
  })
);

/**
 * The workspace's own view of the gateway conversation for one of its
 * payments. Payloads were masked on the way in (lib/payments/redact.ts), so
 * this is safe to show to the customer who made the payment — and being able
 * to show it is usually what ends the argument about whether they paid.
 */
paymentsRouter.get(
  "/transactions/:referenceId/logs",
  asyncHandler(async (req, res) => {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { referenceId: req.params.referenceId },
    });

    if (!transaction || transaction.tenantId !== req.tenantId!) {
      throw HttpError.notFound("payments.transactionNotFound", { code: "transaction_not_found" });
    }

    const logs = await prisma.paymentLog.findMany({
      where: { transactionId: transaction.id },
      orderBy: { createdAt: "asc" },
    });

    sendSuccess(res, {
      messageKey: "payments.logsListed",
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          reference_id: log.referenceId,
          direction: log.direction,
          event: log.event,
          provider: log.provider,
          http_status: log.httpStatus,
          result_status: log.resultStatus,
          message: log.message,
          request_payload: log.requestPayload,
          response_payload: log.responsePayload,
          error_message: log.errorMessage,
          duration_ms: log.durationMs,
          created_at: log.createdAt,
        })),
      },
    });
  })
);

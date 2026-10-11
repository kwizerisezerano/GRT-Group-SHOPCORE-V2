import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { HttpError } from "../../lib/httpError";
import { applyPaymentResult, refreshPaymentStatus, serializeTransaction } from "../../lib/payments/service";

/**
 * The payment trail, from the platform's side.
 *
 * Two views, and the difference between them matters. `/payments` is the
 * ledger — one row per attempt to move money, with its final state. `/payment-logs`
 * is the conversation — every request sent, every answer received, every
 * callback posted back, in order. Support needs the first to answer "did they
 * pay" and the second to answer "then why didn't it work".
 */
export const platformPaymentsRouter = Router();

const statusFilter = z.enum(["pending", "success", "failed", "cancelled", "all"]).default("all");

platformPaymentsRouter.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const status = statusFilter.parse(req.query.status ?? "all");
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);

    const transactions = await prisma.paymentTransaction.findMany({
      where: status === "all" ? undefined : { status },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { tenant: { select: { id: true, name: true } } },
    });

    const rows = transactions.map((transaction) => ({
      ...serializeTransaction(transaction),
      tenant_name: transaction.tenant?.name ?? null,
    }));

    /*
     * Filtered after decryption rather than in SQL: the payer's email and
     * name are encrypted at rest, so there is nothing for a LIKE to match
     * against. The reference and the workspace name are the searches that
     * actually get used, and both survive the round trip.
     */
    const filtered = search
      ? rows.filter((row) =>
          [row.reference_id, row.tenant_name, row.payer_email, row.payer_phone, row.provider_txn_id]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search))
        )
      : rows;

    const totals = await prisma.paymentTransaction.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amount: true },
    });

    sendSuccess(res, {
      messageKey: "platform.paymentsListed",
      data: {
        payments: filtered,
        totals: totals.map((total) => ({
          status: total.status,
          count: total._count._all,
          amount: total._sum.amount,
        })),
        gateway: {
          driver: env.PAYMENTS_DRIVER,
          configured: env.paymentsConfigured,
          callback_url: env.paymentCallbackUrl,
          card_redirect_url: env.paymentCardRedirectUrl,
        },
      },
    });
  })
);

platformPaymentsRouter.get(
  "/payments/:referenceId",
  asyncHandler(async (req, res) => {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { referenceId: req.params.referenceId },
      include: { tenant: { select: { id: true, name: true } } },
    });

    if (!transaction) {
      throw HttpError.notFound("payments.transactionNotFound", { code: "transaction_not_found" });
    }

    const logs = await prisma.paymentLog.findMany({
      where: { transactionId: transaction.id },
      orderBy: { createdAt: "asc" },
    });

    sendSuccess(res, {
      messageKey: "payments.statusFetched",
      data: {
        payment: { ...serializeTransaction(transaction), tenant_name: transaction.tenant?.name ?? null },
        logs: logs.map(serializeLog),
      },
    });
  })
);

/** Re-asks the gateway about a payment that is stuck pending. */
platformPaymentsRouter.post(
  "/payments/:referenceId/refresh",
  asyncHandler(async (req, res) => {
    const transaction = await refreshPaymentStatus(req.params.referenceId);
    sendSuccess(res, { messageKey: "payments.statusFetched", data: transaction });
  })
);

const reconcileSchema = z.object({
  status: z.enum(["success", "failed", "cancelled"]),
  note: z.string().trim().max(500).optional(),
});

/**
 * Settling a payment by hand.
 *
 * For the case the gateway cannot resolve itself: a transfer that arrived in
 * the bank, a callback that never came and a reference the gateway has since
 * forgotten. Goes through the same `applyPaymentResult` path as a real
 * callback — so it activates the subscription identically — and is written to
 * the log with the admin's note, because a payment marked paid by a person
 * rather than by a gateway is exactly the kind of entry an audit asks about.
 */
platformPaymentsRouter.post(
  "/payments/:referenceId/reconcile",
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input = reconcileSchema.parse({ status: body.status, note: body.note });

    const result = await applyPaymentResult(req.params.referenceId, {
      status: input.status,
      message: `Reconciled manually by a platform admin${input.note ? `: ${input.note}` : ""}`,
      source: "manual",
    });

    sendSuccess(res, { messageKey: "payments.statusFetched", data: result });
  })
);

platformPaymentsRouter.get(
  "/payment-logs",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 200) || 200, 1000);
    const direction = String(req.query.direction ?? "all");
    const reference = String(req.query.reference_id ?? req.query.referenceId ?? "").trim();
    const tenantId = String(req.query.tenant_id ?? req.query.tenantId ?? "").trim();

    const logs = await prisma.paymentLog.findMany({
      where: {
        ...(direction !== "all" ? { direction } : {}),
        ...(reference ? { referenceId: reference } : {}),
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { tenant: { select: { name: true } } },
    });

    sendSuccess(res, {
      messageKey: "platform.paymentLogsListed",
      data: {
        logs: logs.map((log) => ({ ...serializeLog(log), tenant_name: log.tenant?.name ?? null })),
      },
    });
  })
);

/**
 * The subscription dashboard's headline numbers, computed server-side.
 *
 * Doing this in the browser would mean shipping every workspace, every
 * subscription and every payment to it first — which is both slow and a lot
 * of commercial data to hand to a page that only wants six totals.
 */
platformPaymentsRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const in7Days = new Date(now.getTime() + 7 * 86_400_000);

    const [
      tenantCount,
      activeWorkspaces,
      pendingPayment,
      subscriptionsByPlan,
      revenueThisMonth,
      pendingApprovals,
      expiringSoon,
      failedPayments,
      planNames,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { workspaceStatus: "active" } }),
      prisma.tenant.count({ where: { workspaceStatus: "pending_payment" } }),
      prisma.tenantSubscription.groupBy({
        by: ["planCode"],
        _count: { _all: true },
        _sum: { subscriptionAmount: true },
      }),
      prisma.paymentTransaction.aggregate({
        where: { status: "success", completedAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.tenantSubscription.count({ where: { approvalStatus: "pending" } }),
      prisma.tenantSubscription.count({
        where: { subscriptionStatus: "active", currentPeriodEnd: { gte: now, lte: in7Days } },
      }),
      prisma.paymentTransaction.count({ where: { status: "failed" } }),
      prisma.subscriptionPlan.findMany({ select: { code: true, name: true } }),
    ]);

    const nameByCode = new Map(planNames.map((plan) => [plan.code, plan.name]));

    sendSuccess(res, {
      messageKey: "platform.overviewLoaded",
      data: {
        workspaces: {
          total: tenantCount,
          active: activeWorkspaces,
          pending_payment: pendingPayment,
        },
        subscriptions_by_plan: subscriptionsByPlan.map((row) => ({
          plan_code: row.planCode,
          plan_name: nameByCode.get(row.planCode) ?? row.planCode,
          count: row._count._all,
          contracted_amount: row._sum.subscriptionAmount,
        })),
        revenue_this_month: {
          amount: revenueThisMonth._sum.amount ?? 0,
          payment_count: revenueThisMonth._count._all,
        },
        pending_approvals: pendingApprovals,
        expiring_within_7_days: expiringSoon,
        failed_payments: failedPayments,
        gateway: {
          driver: env.PAYMENTS_DRIVER,
          configured: env.paymentsConfigured,
        },
      },
    });
  })
);

function serializeLog(log: {
  id: string;
  transactionId: string | null;
  referenceId: string | null;
  tenantId: string | null;
  direction: string;
  event: string;
  provider: string;
  httpStatus: number | null;
  resultStatus: string | null;
  message: string | null;
  requestPayload: unknown;
  responsePayload: unknown;
  errorMessage: string | null;
  durationMs: number | null;
  ipAddress: string | null;
  createdAt: Date;
}) {
  return {
    id: log.id,
    transaction_id: log.transactionId,
    reference_id: log.referenceId,
    tenant_id: log.tenantId,
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
    ip_address: log.ipAddress,
    created_at: log.createdAt,
  };
}

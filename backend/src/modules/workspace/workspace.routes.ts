import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import { requireTenant } from "../../middleware/requireTenant";
import { decryptNullable } from "../../lib/crypto";
import { gatewayMethodFor } from "../../lib/payments/lmbtech";
import { startSubscriptionPayment } from "../../lib/payments/service";
import { recordSignedContract } from "../contracts/contracts.service";
import { issueTokenPair } from "../auth/auth.service";
import { listPublicPlans } from "../subscription/subscription.service";
import { createPendingWorkspace } from "./workspace.service";

export const workspaceRouter = Router();

/**
 * The plan catalogue the signup form reads.
 *
 * Served from the live plan tables rather than the denormalised
 * `public_subscription_plan_catalog` snapshot it used to read. The snapshot
 * was written by the seed script and by nothing else, so a plan a super admin
 * created or repriced in the console never reached the signup page — which
 * made the console's plan editor a form that appeared to work and changed
 * nothing a customer could see.
 */
workspaceRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = await listPublicPlans();
    sendSuccess(res, { messageKey: "workspace.plansLoaded", data: { plans } });
  })
);

workspaceRouter.get(
  "/payment-methods",
  asyncHandler(async (_req, res) => {
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    sendSuccess(res, {
      messageKey: "workspace.paymentMethodsLoaded",
      data: {
        paymentMethods: paymentMethods.map((method) => ({
          ...method,
          // The signup form has to know whether to ask for a phone number
          // before it is submitted; deriving it in the browser would drift the
          // first time a method is added in the console.
          requiresPhone: method.provider === "mtn" || method.provider === "airtel",
          isManual: method.provider === "manual",
        })),
      },
    });
  })
);

const pendingWorkspaceSchema = z.object({
  businessName: z.string().trim().min(1).max(191),
  businessPhone: z.string().trim().max(32).optional(),
  businessLocation: z.string().trim().max(191).optional(),
  businessType: z.string().trim().max(64).optional(),
  teamSize: z.string().trim().max(32).optional(),
  language: z.string().trim().max(8).optional(),
  planCode: z.string().trim().min(1).max(32),
  billingCycle: z.enum(["monthly", "six_months", "annual"]),
  paymentMethod: z.string().trim().max(32).optional(),
  payerPhone: z.string().trim().max(32).optional(),
  /** Opens the workspace on the plan's free trial instead of charging. */
  startTrial: z.boolean().optional(),
  /** Rwanda Revenue Authority TIN, as typed at signup. */
  tinNumber: z.string().trim().max(32).optional().nullable(),
  /**
   * The agreement, accepted on the screen before this one.
   *
   * Only the signature travels — never the contract text. The server renders
   * the wording again from the same template and the same details, so what is
   * stored is what we produced, not what a client claimed it was shown.
   */
  contract: z
    .object({
      templateId: z.string().trim().min(1).max(64),
      signatureImage: z.string().min(1),
      stampImage: z.string().min(1).optional().nullable(),
      signerName: z.string().trim().min(1).max(191),
    })
    .optional(),
});

/**
 * Choosing a plan, and paying for it.
 *
 * This is the second half of signup: the account already exists, and this is
 * where the workspace is created on the chosen plan and the charge is put on
 * the wire in one request. Doing both here — rather than creating the
 * workspace and then asking the client to call checkout — means a customer
 * cannot end up with a workspace nobody ever tried to charge for, which is
 * the state that is hardest to notice and hardest to explain.
 *
 * The workspace is not opened here. That waits for the gateway
 * (lib/payments/service.ts), or for a platform admin in the bank-transfer
 * case.
 */
workspaceRouter.post(
  "/pending",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const input = pendingWorkspaceSchema.parse({
      businessName: body.businessName ?? body.business_name,
      businessPhone: body.businessPhone ?? body.business_phone,
      businessLocation: body.businessLocation ?? body.business_location,
      businessType: body.businessType ?? body.business_type,
      teamSize: body.teamSize ?? body.team_size,
      language: body.language,
      planCode: body.planCode ?? body.plan_code,
      billingCycle: body.billingCycle ?? body.billing_cycle,
      paymentMethod: body.paymentMethod ?? body.payment_method ?? body.payment_method_code,
      payerPhone: body.payerPhone ?? body.payer_phone,
      startTrial: body.startTrial ?? body.start_trial,
      tinNumber: body.tinNumber ?? body.tin_number,
      contract: body.contract,
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { emailEncrypted: true, displayNameEncrypted: true },
    });

    const email = decryptNullable(user?.emailEncrypted ?? null) ?? "";
    const name = decryptNullable(user?.displayNameEncrypted ?? null) ?? input.businessName;

    const workspace = await createPendingWorkspace({
      userId: req.user!.id,
      email,
      displayName: name,
      businessName: input.businessName,
      businessPhone: input.businessPhone,
      businessLocation: input.businessLocation,
      businessType: input.businessType,
      teamSize: input.teamSize,
      language: input.language,
      planCode: input.planCode,
      billingCycle: input.billingCycle,
      paymentMethod: input.paymentMethod,
      startTrial: input.startTrial,
    });

    if (input.tinNumber) {
      await prisma.tenant.update({
        where: { id: workspace.tenantId },
        data: { tinNumber: input.tinNumber },
      });
    }

    /*
     * The signed contract is written before the charge goes out.
     *
     * Sign, then pay — in that order and in that request. If the charge were
     * first, a customer could be debited for an agreement no record says they
     * ever accepted, and that is the one failure here that cannot be put right
     * afterwards. A contract with no payment against it is merely a workspace
     * awaiting payment, which the rest of the system already understands.
     */
    if (input.contract) {
      try {
        await recordSignedContract({
          tenantId: workspace.tenantId,
          userId: req.user!.id,
          email,
          signature: input.contract,
          facts: {
            companyName: input.businessName,
            tinNumber: input.tinNumber ?? null,
            ownerName: name,
            ownerEmail: email,
            businessPhone: input.businessPhone ?? null,
            businessAddress: input.businessLocation ?? null,
            planCode: input.planCode,
            billingCycle: input.billingCycle,
          },
          signedIp: req.ip ?? null,
        });
      } catch (error) {
        console.error("[workspace] could not store the signed contract", {
          tenantId: workspace.tenantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    /*
     * Fire the charge for anything the gateway can take. A failure here is
     * logged and reported, not thrown: the workspace has already committed,
     * and the customer must be able to retry from the billing screen rather
     * than be told the whole thing failed.
     */
    const gatewayMethod = input.paymentMethod ? gatewayMethodFor(input.paymentMethod) : null;
    let payment = null;

    if (workspace.requiresPayment && gatewayMethod) {
      try {
        payment = await startSubscriptionPayment({
          tenantId: workspace.tenantId,
          userId: req.user!.id,
          subscriptionId: workspace.subscriptionId,
          planCode: workspace.planCode,
          billingCycle: workspace.billingCycle,
          amount: workspace.amount,
          currency: workspace.currency,
          paymentMethodCode: input.paymentMethod!,
          payerPhone: input.payerPhone ?? input.businessPhone ?? null,
          email,
          name,
          purpose: "subscription",
        });
      } catch (error) {
        console.error("[workspace] could not start the subscription payment", {
          tenantId: workspace.tenantId,
          method: input.paymentMethod,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    /*
     * A fresh token pair, because the caller's tenancy just changed.
     *
     * The access token carries the tenant id, and the one this request
     * arrived with was minted at signup when there was no workspace yet — so
     * without this, every tenant-scoped route the client calls next (the
     * payment status it is about to poll, the billing screen, the dashboard)
     * is refused with `tenant_required` on a workspace that demonstrably
     * exists. Reissuing here rather than making the client remember to
     * refresh keeps that failure impossible instead of merely documented.
     */
    const tokens = await issueTokenPair(
      { id: req.user!.id },
      workspace.tenantId,
      "owner"
    );

    sendSuccess(res, {
      messageKey: "workspace.created",
      data: {
        tenantId: workspace.tenantId,
        subscriptionId: workspace.subscriptionId,
        requiresPayment: workspace.requiresPayment,
        amount: workspace.amount,
        currency: workspace.currency,
        trialEndsAt: workspace.trialEndsAt,
        trialDays: workspace.trialDays,
        payment,
        ...tokens,
      },
    });
  })
);

const paymentReferenceSchema = z.object({
  reference: z.string().trim().min(1, "A transfer reference is required").max(191),
});

/**
 * Lets a tenant mid-bank-transfer attach the reference/note from their
 * transfer to their own pending subscription, so the reviewing platform
 * admin (platform.routes.ts subscriptions endpoints) has something to match
 * against a bank statement. Scoped to the caller's own tenant and to a
 * subscription still awaiting review — there is nothing to attach a
 * reference to once it has already been approved or rejected.
 */
workspaceRouter.post(
  "/payment-reference",
  requireAuth,
  requireTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const { reference } = paymentReferenceSchema.parse({ reference: body.reference });

    const subscription = await prisma.tenantSubscription.findFirst({
      where: { tenantId, approvalStatus: "pending" },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) throw HttpError.notFound("workspace.noPendingPayment");

    await prisma.tenantSubscription.update({
      where: { id: subscription.id },
      data: { paymentReference: reference },
    });

    sendSuccess(res, { messageKey: "workspace.paymentReferenceSaved" });
  })
);

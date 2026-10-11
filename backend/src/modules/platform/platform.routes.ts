import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { toSnakeCase } from "../../lib/caseMapping";
import { decryptNullable } from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";
import { assertCapacity } from "../../lib/planLimits";
import { ROLES, isRole } from "../../lib/permissions";
import { requireAuth } from "../../middleware/auth";
import { requirePlatformAdmin } from "../../middleware/requirePlatformAdmin";
import { addMonths, monthsForCycle } from "../../lib/billingPeriod";
import { createMemberWithGeneratedPassword } from "../users/users.service";
import { platformContractsRouter } from "./platform.contracts.routes";
import { platformOrganizationsRouter } from "./platform.organizations.routes";
import { platformPaymentsRouter } from "./platform.payments.routes";
import { platformModulesRouter } from "./platform.modules.routes";
import { platformPlansRouter } from "./platform.plans.routes";
import { platformSigningPinRouter } from "./platform.signingPin.routes";

/**
 * The platform console's own routes — a platform admin acts across every
 * tenant, not from inside one, so this router sits outside requireTenant
 * entirely and is gated on User.isPlatformAdmin instead of a tenant role.
 *
 * Deliberately small: originally only what Part D of the member-creation
 * feature needed (a tenant picker, and creating a member in a chosen
 * tenant); now also carries the bank-transfer payment approval queue below.
 * The rest of the platform console is out of scope here.
 */
export const platformRouter = Router();
platformRouter.use(requireAuth, requirePlatformAdmin);

/*
 * The console's larger surfaces live in their own files and inherit the
 * platform-admin gate from the line above: the plan catalogue, every
 * workspace on the platform, and the payment ledger with its gateway logs.
 */
platformRouter.use("/plans", platformPlansRouter);
platformRouter.use("/organizations", platformOrganizationsRouter);
platformRouter.use("/", platformPaymentsRouter);
platformRouter.use("/", platformModulesRouter);
platformRouter.use("/", platformContractsRouter);
platformRouter.use("/", platformSigningPinRouter);

/**
 * The tenant picker's source of truth.
 *
 * A name alone is not enough to choose between workspaces that are named
 * after the same business, so each row also carries the owner's name and
 * email and a member count — the three things somebody actually recognises a
 * workspace by. Owner identity is decrypted here rather than stored in the
 * clear (lib/crypto.ts); this route is already platform-admin only.
 */
platformRouter.get(
  "/tenants",
  asyncHandler(async (_req, res) => {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        workspaceStatus: true,
        createdAt: true,
        owner: {
          select: { id: true, emailEncrypted: true, displayNameEncrypted: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });

    const rows = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      subscriptionPlan: tenant.subscriptionPlan,
      subscriptionStatus: tenant.subscriptionStatus,
      workspaceStatus: tenant.workspaceStatus,
      createdAt: tenant.createdAt,
      memberCount: tenant._count.members,
      ownerId: tenant.owner?.id ?? null,
      // "username" in the product's own wording — the name the owner is
      // known by inside the workspace.
      ownerName: tenant.owner ? decryptNullable(tenant.owner.displayNameEncrypted) : null,
      ownerEmail: tenant.owner ? decryptNullable(tenant.owner.emailEncrypted) : null,
    }));

    sendSuccess(res, { messageKey: "platform.tenantsListed", data: toSnakeCase(rows) });
  })
);

const roleSchema = z.string().refine(isRole, {
  message: `Role must be one of: ${ROLES.join(", ")}`,
});

const createTenantUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(191),
  displayName: z.string().trim().min(1, "Name is required").max(191),
  role: roleSchema,
  department: z.string().trim().max(191).nullable().optional(),
  branchId: z.string().trim().nullable().optional(),
});

/**
 * Creates a member in a tenant the caller does not belong to. There is no
 * outranks() check here — unlike the tenant-scoped POST /users/create, the
 * caller has no role in this tenant to rank against, and platform admin is
 * already the platform's own highest authority.
 */
platformRouter.post(
  "/tenants/:tenantId/users",
  asyncHandler(async (req, res) => {
    const tenantId = req.params.tenantId;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw HttpError.notFound("platform.tenantNotFound");

    const body = (req.body ?? {}) as Record<string, unknown>;
    const input = createTenantUserSchema.parse({
      email: body.email,
      displayName: body.displayName ?? body.display_name ?? body.full_name ?? body.fullName,
      role: body.role,
      department: body.department,
      branchId: body.branchId ?? body.branch_id,
    });

    /*
     * The workspace's seat ceiling applies here too. A platform admin
     * outranks every role in the tenant, but not the subscription the tenant
     * is paying for — quietly seating a fourth user on a three-seat plan is a
     * billing problem, not an authority one.
     */
    await assertCapacity(tenantId, "users");

    const member = await createMemberWithGeneratedPassword({
      tenantId,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      department: input.department ?? null,
      branchId: input.branchId ?? null,
      invitedByUserId: req.user!.id,
      language: res.locals.language,
    });

    sendSuccess(res, { messageKey: "users.memberCreated", status: 201, data: toSnakeCase(member) });
  })
);

// ------------------------------------------------------ subscriptions ---

const subscriptionStatusFilter = z
  .enum(["pending", "approved", "rejected", "all"])
  .default("pending");

/**
 * The bank-transfer review queue: subscriptions created by
 * createPendingWorkspace with approvalStatus "pending" (see
 * workspace.service.ts), awaiting a human to match the transfer against a
 * bank statement before the workspace opens. Defaults to pending so the
 * console's landing view is exactly the admin's to-do list.
 */
platformRouter.get(
  "/subscriptions",
  asyncHandler(async (req, res) => {
    const status = subscriptionStatusFilter.parse(req.query.status ?? "pending");

    const subscriptions = await prisma.tenantSubscription.findMany({
      where: status === "all" ? undefined : { approvalStatus: status },
      orderBy: { createdAt: "desc" },
      include: {
        tenant: { select: { id: true, name: true, workspaceStatus: true } },
        paymentMethod: { select: { name: true, code: true } },
      },
    });

    const planCodes = [...new Set(subscriptions.map((s) => s.planCode))];
    const plans = await prisma.subscriptionPlan.findMany({
      where: { code: { in: planCodes } },
      select: { code: true, name: true },
    });
    const planNameByCode = new Map(plans.map((p) => [p.code, p.name]));

    const requesterIds = [...new Set(subscriptions.map((s) => s.requestedBy).filter((v): v is string => !!v))];
    const requesters = requesterIds.length
      ? await prisma.user.findMany({
          where: { id: { in: requesterIds } },
          select: { id: true, emailEncrypted: true, displayNameEncrypted: true },
        })
      : [];
    const requesterById = new Map(requesters.map((u) => [u.id, u]));

    const data = subscriptions.map((s) => {
      const requester = s.requestedBy ? requesterById.get(s.requestedBy) : undefined;
      return {
        id: s.id,
        tenantId: s.tenantId,
        tenantName: s.tenant.name,
        workspaceStatus: s.tenant.workspaceStatus,
        planCode: s.planCode,
        planName: planNameByCode.get(s.planCode) ?? s.planCode,
        billingCycle: s.billingCycle,
        amount: s.subscriptionAmount,
        currency: s.subscriptionCurrency,
        paymentMethodCode: s.paymentMethodCode,
        paymentMethodName: s.paymentMethod?.name ?? s.paymentMethodCode,
        paymentReference: s.paymentReference,
        approvalStatus: s.approvalStatus,
        rejectionReason: s.rejectionReason,
        requestedByEmail: requester ? decryptNullable(requester.emailEncrypted) : null,
        requestedByName: requester ? decryptNullable(requester.displayNameEncrypted) : null,
        requestedAt: s.requestedAt,
        approvedAt: s.approvedAt,
        activatedAt: s.activatedAt,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        expiresAt: s.expiresAt,
      };
    });

    sendSuccess(res, { messageKey: "platform.subscriptionsListed", data: toSnakeCase(data) });
  })
);

/**
 * Approves a pending bank-transfer payment and opens the workspace in one
 * transaction. Sets the subscription's live period (start = now, end = now +
 * the plan's billing term) and flips the tenant's workspaceStatus to
 * "active" — the field resolveWorkspaceAccessStatus (frontend AuthContext)
 * reads to let the tenant back in.
 */
platformRouter.post(
  "/subscriptions/:id/approve",
  asyncHandler(async (req, res) => {
    const subscription = await prisma.tenantSubscription.findUnique({ where: { id: req.params.id } });
    if (!subscription) throw HttpError.notFound("platform.subscriptionNotFound");
    if (subscription.approvalStatus !== "pending") {
      throw HttpError.conflict("platform.subscriptionAlreadyReviewed");
    }

    const now = new Date();
    const months = monthsForCycle(subscription.billingCycle, subscription.billingMonths);
    const currentPeriodEnd = addMonths(now, months);

    await prisma.$transaction([
      prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: {
          approvalStatus: "approved",
          subscriptionStatus: "active",
          paymentStatus: "paid",
          approvedBy: req.user!.id,
          approvedAt: now,
          activatedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd,
          expiresAt: currentPeriodEnd,
          rejectionReason: null,
        },
      }),
      prisma.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          workspaceStatus: "active",
          subscriptionStatus: "active",
          paymentStatus: "paid",
        },
      }),
    ]);

    sendSuccess(res, { messageKey: "platform.subscriptionApproved" });
  })
);

const rejectSubscriptionSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(1000),
});

platformRouter.post(
  "/subscriptions/:id/reject",
  asyncHandler(async (req, res) => {
    const subscription = await prisma.tenantSubscription.findUnique({ where: { id: req.params.id } });
    if (!subscription) throw HttpError.notFound("platform.subscriptionNotFound");
    if (subscription.approvalStatus !== "pending") {
      throw HttpError.conflict("platform.subscriptionAlreadyReviewed");
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const { reason } = rejectSubscriptionSchema.parse({ reason: body.reason });

    await prisma.tenantSubscription.update({
      where: { id: subscription.id },
      data: {
        approvalStatus: "rejected",
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });

    sendSuccess(res, { messageKey: "platform.subscriptionRejected" });
  })
);

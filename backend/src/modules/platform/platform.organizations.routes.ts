import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { decryptNullable } from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";
import {
  buildCapacityReport,
  CAPACITY_LABELS,
  isCapacityKey,
  resolveTenantLimits,
} from "../../lib/planLimits";
import { serializeTransaction } from "../../lib/payments/service";
import { getPlanByCode } from "../subscription/subscription.service";
import { createOrganization } from "./platform.organizations.service";

/**
 * Every workspace on the platform, and what each one is paying for.
 *
 * The console's job here is monitoring first and editing second: a super
 * admin opens this to see who is on which plan, who is close to their seat
 * ceiling and whose subscription lapses next week. So the list route does the
 * aggregation work up front rather than making the browser fire a request per
 * workspace.
 */
export const platformOrganizationsRouter = Router();

/**
 * Live counts for every tenant at once.
 *
 * The per-tenant version of this (lib/planLimits.ts resolveTenantUsage) runs
 * eight counts for one workspace. Doing that per row in a list of two hundred
 * workspaces is sixteen hundred queries; eight grouped ones answer the same
 * question. The two must agree, so both derive "branches excludes warehouses"
 * the same way.
 */
async function usageByTenant() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [members, invites, branches, warehouses, products, customers, suppliers, sales] =
    await Promise.all([
      prisma.tenantMember.groupBy({ by: ["tenantId"], where: { status: "active" }, _count: { _all: true } }),
      prisma.userInvite.groupBy({
        by: ["tenantId"],
        where: { status: "pending", expiresAt: { gt: new Date() } },
        _count: { _all: true },
      }),
      prisma.branch.groupBy({ by: ["tenantId"], where: { NOT: { type: "warehouse" } }, _count: { _all: true } }),
      prisma.branch.groupBy({ by: ["tenantId"], where: { type: "warehouse" }, _count: { _all: true } }),
      prisma.product.groupBy({ by: ["tenantId"], _count: { _all: true } }),
      prisma.customer.groupBy({ by: ["tenantId"], _count: { _all: true } }),
      prisma.supplier.groupBy({ by: ["tenantId"], _count: { _all: true } }),
      prisma.sale.groupBy({ by: ["tenantId"], where: { createdAt: { gte: monthStart } }, _count: { _all: true } }),
    ]);

  const index = new Map<string, Record<string, number>>();

  const absorb = (
    rows: { tenantId: string; _count: { _all: number } }[],
    key: string,
    add = false
  ) => {
    for (const row of rows) {
      const entry = index.get(row.tenantId) ?? {};
      entry[key] = add ? (entry[key] ?? 0) + row._count._all : row._count._all;
      index.set(row.tenantId, entry);
    }
  };

  absorb(members, "users");
  // Pending invitations are seats already promised — counted the same way
  // resolveTenantUsage counts them, so the console and the enforcement point
  // never disagree about how full a workspace is.
  absorb(invites, "users", true);
  absorb(branches, "branches");
  absorb(warehouses, "warehouses");
  absorb(products, "products");
  absorb(customers, "customers");
  absorb(suppliers, "suppliers");
  absorb(sales, "monthly_transactions");

  return index;
}

platformOrganizationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const statusFilter = String(req.query.status ?? "all").trim();

    const tenants = await prisma.tenant.findMany({
      include: {
        owner: { select: { id: true, emailEncrypted: true, displayNameEncrypted: true } },
        _count: { select: { members: true } },
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    const [usage, plans, overrides] = await Promise.all([
      usageByTenant(),
      prisma.subscriptionPlan.findMany({ include: { limits: true } }),
      prisma.tenantLimitOverride.findMany(),
    ]);

    const planByCode = new Map(plans.map((plan) => [plan.code, plan]));
    const overridesByTenant = new Map<string, typeof overrides>();
    for (const override of overrides) {
      const list = overridesByTenant.get(override.tenantId) ?? [];
      list.push(override);
      overridesByTenant.set(override.tenantId, list);
    }

    const rows = tenants.map((tenant) => {
      const subscription = tenant.subscriptions[0] ?? null;
      const planCode = subscription?.planCode ?? tenant.subscriptionPlan ?? null;
      const plan = planCode ? planByCode.get(planCode) : undefined;
      const counts = usage.get(tenant.id) ?? {};

      /** The one ceiling worth showing in a list: seats. */
      const seatOverride = overridesByTenant
        .get(tenant.id)
        ?.find((entry) => entry.limitKey === "users");
      const seatPlanLimit = plan?.limits.find((limit) => limit.limitKey === "users");

      const seatLimit = seatOverride
        ? seatOverride.isUnlimited
          ? null
          : seatOverride.value
        : seatPlanLimit
          ? seatPlanLimit.isUnlimited
            ? null
            : seatPlanLimit.value
          : null;

      const seatsUsed = counts.users ?? 0;

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logoUrl,
        created_at: tenant.createdAt,

        owner_id: tenant.owner?.id ?? null,
        owner_name: tenant.owner ? decryptNullable(tenant.owner.displayNameEncrypted) : null,
        owner_email: tenant.owner ? decryptNullable(tenant.owner.emailEncrypted) : null,
        contact_email: decryptNullable(tenant.contactEmailEncrypted),

        member_count: tenant._count.members,
        workspace_status: tenant.workspaceStatus,
        onboarding_completed: tenant.onboardingCompleted,

        plan_code: planCode,
        plan_name: plan?.name ?? planCode,
        billing_cycle: subscription?.billingCycle ?? tenant.billingCycle,
        subscription_status: subscription?.subscriptionStatus ?? tenant.subscriptionStatus,
        payment_status: subscription?.paymentStatus ?? tenant.paymentStatus,
        approval_status: subscription?.approvalStatus ?? null,
        subscription_amount: subscription?.subscriptionAmount ?? null,
        subscription_currency: subscription?.subscriptionCurrency ?? "RWF",
        current_period_end: subscription?.currentPeriodEnd ?? null,
        expires_at: subscription?.expiresAt ?? null,
        trial_ends_at: subscription?.trialEndsAt ?? tenant.trialEndsAt,

        seats_used: seatsUsed,
        seats_limit: seatLimit,
        seats_remaining: seatLimit === null ? null : Math.max(0, seatLimit - seatsUsed),
        at_seat_limit: seatLimit !== null && seatsUsed >= seatLimit,

        usage: {
          users: counts.users ?? 0,
          branches: counts.branches ?? 0,
          warehouses: counts.warehouses ?? 0,
          products: counts.products ?? 0,
          customers: counts.customers ?? 0,
          suppliers: counts.suppliers ?? 0,
          monthly_transactions: counts.monthly_transactions ?? 0,
        },

        has_limit_overrides: (overridesByTenant.get(tenant.id)?.length ?? 0) > 0,
      };
    });

    const filtered = rows.filter((row) => {
      if (statusFilter !== "all" && (row.workspace_status ?? "unknown") !== statusFilter) return false;
      if (!search) return true;
      return [row.name, row.owner_name, row.owner_email, row.plan_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    sendSuccess(res, {
      messageKey: "platform.organizationsListed",
      data: { organizations: filtered, total: rows.length },
    });
  })
);

platformOrganizationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, emailEncrypted: true, displayNameEncrypted: true } },
        subscriptions: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!tenant) throw HttpError.notFound("platform.organizationNotFound", { code: "organization_not_found" });

    const subscription = tenant.subscriptions[0] ?? null;
    const planCode = subscription?.planCode ?? tenant.subscriptionPlan ?? null;

    const [capacities, overrides, payments, plan, members] = await Promise.all([
      buildCapacityReport(tenant.id),
      prisma.tenantLimitOverride.findMany({ where: { tenantId: tenant.id } }),
      prisma.paymentTransaction.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      planCode ? getPlanByCode(planCode).catch(() => null) : Promise.resolve(null),
      prisma.tenantMember.findMany({
        where: { tenantId: tenant.id },
        include: { user: { select: { emailEncrypted: true, displayNameEncrypted: true } } },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
    ]);

    sendSuccess(res, {
      messageKey: "platform.organizationFetched",
      data: {
        organization: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logo_url: tenant.logoUrl,
          brand_color: tenant.brandColor,
          created_at: tenant.createdAt,
          workspace_status: tenant.workspaceStatus,
          onboarding_completed: tenant.onboardingCompleted,
          owner_id: tenant.owner?.id ?? null,
          owner_name: tenant.owner ? decryptNullable(tenant.owner.displayNameEncrypted) : null,
          owner_email: tenant.owner ? decryptNullable(tenant.owner.emailEncrypted) : null,
          contact_email: decryptNullable(tenant.contactEmailEncrypted),
        },
        plan,
        subscription: subscription
          ? {
              id: subscription.id,
              plan_code: subscription.planCode,
              billing_cycle: subscription.billingCycle,
              amount: subscription.subscriptionAmount,
              currency: subscription.subscriptionCurrency,
              status: subscription.subscriptionStatus,
              payment_status: subscription.paymentStatus,
              approval_status: subscription.approvalStatus,
              payment_method_code: subscription.paymentMethodCode,
              current_period_start: subscription.currentPeriodStart,
              current_period_end: subscription.currentPeriodEnd,
              expires_at: subscription.expiresAt,
              trial_ends_at: subscription.trialEndsAt,
              activated_at: subscription.activatedAt,
              created_at: subscription.createdAt,
            }
          : null,
        subscription_history: tenant.subscriptions.map((entry) => ({
          id: entry.id,
          plan_code: entry.planCode,
          billing_cycle: entry.billingCycle,
          amount: entry.subscriptionAmount,
          status: entry.subscriptionStatus,
          payment_status: entry.paymentStatus,
          approval_status: entry.approvalStatus,
          created_at: entry.createdAt,
        })),
        capacities,
        limit_overrides: overrides.map((override) => ({
          limit_key: override.limitKey,
          name: isCapacityKey(override.limitKey)
            ? CAPACITY_LABELS[override.limitKey].name
            : override.limitKey,
          value: override.isUnlimited ? null : override.value,
          is_unlimited: override.isUnlimited,
          note: override.note,
          updated_at: override.updatedAt,
        })),
        payments: payments.map(serializeTransaction),
        members: members.map((member) => ({
          id: member.id,
          user_id: member.userId,
          name: decryptNullable(member.user.displayNameEncrypted),
          email: decryptNullable(member.user.emailEncrypted),
          role: member.role,
          status: member.status,
          department: member.department,
          created_at: member.createdAt,
        })),
      },
    });
  })
);

const createOrganizationSchema = z.object({
  businessName: z.string().trim().min(2, "A business name is required").max(191),
  ownerEmail: z.string().trim().email("Enter a valid email address").max(191),
  ownerName: z.string().trim().min(2, "The owner's name is required").max(191),
  ownerPhone: z.string().trim().max(32).nullable().optional(),
  businessLocation: z.string().trim().max(191).nullable().optional(),
  businessType: z.string().trim().max(64).nullable().optional(),
  teamSize: z.string().trim().max(32).nullable().optional(),
  language: z.enum(["en", "fr", "es", "sw", "rw"]).optional(),
  planCode: z.string().trim().min(1).max(32),
  billingCycle: z.enum(["monthly", "six_months", "annual"]),
  paymentMethodCode: z.string().trim().max(32).nullable().optional(),
  activateImmediately: z.boolean().default(true),
  trialDays: z.coerce.number().int().min(0).max(365).nullable().optional(),
});

/**
 * The console's version of the signup form.
 *
 * Same fields the customer would fill in, plus the two decisions only the
 * vendor can make: whether the workspace opens now, and how many free days
 * it starts with.
 */
platformOrganizationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const input = createOrganizationSchema.parse({
      businessName: body.businessName ?? body.business_name ?? body.name,
      ownerEmail: body.ownerEmail ?? body.owner_email ?? body.email,
      ownerName: body.ownerName ?? body.owner_name ?? body.display_name ?? body.displayName,
      ownerPhone: body.ownerPhone ?? body.owner_phone ?? body.phone,
      businessLocation: body.businessLocation ?? body.business_location ?? body.location,
      businessType: body.businessType ?? body.business_type,
      teamSize: body.teamSize ?? body.team_size,
      language: body.language,
      planCode: body.planCode ?? body.plan_code,
      billingCycle: body.billingCycle ?? body.billing_cycle,
      paymentMethodCode: body.paymentMethodCode ?? body.payment_method_code,
      activateImmediately: body.activateImmediately ?? body.activate_immediately ?? true,
      trialDays: body.trialDays ?? body.trial_days,
    });

    const result = await createOrganization({ ...input, createdByUserId: req.user!.id });

    sendSuccess(res, {
      messageKey: "platform.organizationCreated",
      status: 201,
      data: { tenant_id: result.tenantId, owner_user_id: result.userId },
    });
  })
);

const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(191).optional(),
  workspaceStatus: z.enum(["active", "pending_payment", "suspended", "cancelled"]).optional(),
  planCode: z.string().trim().min(1).max(32).optional(),
  billingCycle: z.enum(["monthly", "six_months", "annual"]).optional(),
});

/**
 * Suspending, reinstating, renaming, or moving a workspace to another plan.
 *
 * A plan change writes both the subscription row and the mirror on `tenants`,
 * because the login path reads the mirror and the limit resolver reads the
 * subscription — leaving them out of step is how a workspace ends up paying
 * for one plan and being capped by another.
 */
platformOrganizationsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = req.params.id;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const input = updateOrganizationSchema.parse({
      name: body.name,
      workspaceStatus: body.workspaceStatus ?? body.workspace_status,
      planCode: body.planCode ?? body.plan_code,
      billingCycle: body.billingCycle ?? body.billing_cycle,
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw HttpError.notFound("platform.organizationNotFound", { code: "organization_not_found" });

    let price = null;
    if (input.planCode || input.billingCycle) {
      const planCode = input.planCode ?? tenant.subscriptionPlan ?? "";
      const billingCycle = input.billingCycle ?? tenant.billingCycle ?? "monthly";

      price = await prisma.subscriptionPlanPrice.findFirst({
        where: { planCode, billingCycle, isActive: true },
      });

      if (!price) {
        throw HttpError.badRequest("workspace.invalidPrice", {
          code: "invalid_price",
          params: { plan: planCode, cycle: billingCycle },
        });
      }
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.workspaceStatus
          ? {
              workspaceStatus: input.workspaceStatus,
              subscriptionStatus:
                input.workspaceStatus === "active" ? "active" : input.workspaceStatus,
            }
          : {}),
        ...(price ? { subscriptionPlan: price.planCode, billingCycle: price.billingCycle } : {}),
      },
    });

    const subscription = await prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    if (subscription && price) {
      await prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: {
          planCode: price.planCode,
          billingCycle: price.billingCycle,
          billingMonths: price.billingMonths,
          subscriptionAmount: price.finalPrice,
          subscriptionCurrency: price.currency,
          subscriptionDiscountPercent: price.discountPercent,
        },
      });
    }

    if (subscription && input.workspaceStatus) {
      await prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: {
          subscriptionStatus:
            input.workspaceStatus === "active" ? "active" : input.workspaceStatus,
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        tenantId,
        userId: req.user!.id,
        action: "workspace_updated",
        module: "platform",
        targetId: tenantId,
        description: "Workspace updated from the platform console",
        metadata: input,
      },
    });

    sendSuccess(res, { messageKey: "platform.organizationUpdated" });
  })
);

const overrideSchema = z
  .object({
    value: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
    isUnlimited: z.boolean().default(false),
    note: z.string().trim().max(255).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.isUnlimited && (input.value === null || input.value === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Enter a number, or mark the limit unlimited",
      });
    }
  });

/**
 * Gives one workspace its own ceiling for one capacity — the "they bought one
 * extra seat" case that would otherwise require inventing a bespoke plan.
 */
platformOrganizationsRouter.put(
  "/:id/limits/:limitKey",
  asyncHandler(async (req, res) => {
    const tenantId = req.params.id;
    const limitKey = req.params.limitKey;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw HttpError.notFound("platform.organizationNotFound", { code: "organization_not_found" });

    const input = overrideSchema.parse({
      value: body.value,
      isUnlimited: body.isUnlimited ?? body.is_unlimited ?? false,
      note: body.note,
    });

    await prisma.tenantLimitOverride.upsert({
      where: { tenant_limit_override_unique: { tenantId, limitKey } },
      create: {
        tenantId,
        limitKey,
        value: input.isUnlimited ? null : input.value ?? 0,
        isUnlimited: input.isUnlimited,
        note: input.note ?? null,
        createdBy: req.user!.id,
      },
      update: {
        value: input.isUnlimited ? null : input.value ?? 0,
        isUnlimited: input.isUnlimited,
        note: input.note ?? null,
      },
    });

    const capacities = await buildCapacityReport(tenantId);
    sendSuccess(res, { messageKey: "subscription.overrideSaved", data: { capacities } });
  })
);

platformOrganizationsRouter.delete(
  "/:id/limits/:limitKey",
  asyncHandler(async (req, res) => {
    const { id: tenantId, limitKey } = req.params;

    const existing = await prisma.tenantLimitOverride.findUnique({
      where: { tenant_limit_override_unique: { tenantId, limitKey } },
    });

    if (!existing) {
      throw HttpError.notFound("subscription.overrideNotFound", { code: "override_not_found" });
    }

    await prisma.tenantLimitOverride.delete({
      where: { tenant_limit_override_unique: { tenantId, limitKey } },
    });

    const capacities = await buildCapacityReport(tenantId);
    sendSuccess(res, { messageKey: "subscription.overrideRemoved", data: { capacities } });
  })
);

/** What the workspace is actually allowed, after plan and overrides. */
platformOrganizationsRouter.get(
  "/:id/limits",
  asyncHandler(async (req, res) => {
    const [limits, capacities] = await Promise.all([
      resolveTenantLimits(req.params.id),
      buildCapacityReport(req.params.id),
    ]);

    sendSuccess(res, { messageKey: "subscription.usageLoaded", data: { limits, capacities } });
  })
);

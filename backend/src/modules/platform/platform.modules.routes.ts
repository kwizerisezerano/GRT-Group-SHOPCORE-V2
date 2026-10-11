import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { sendSuccess } from "../../lib/apiResponse";
import { HttpError } from "../../lib/httpError";
import { decryptNullable } from "../../lib/crypto";

/**
 * Granting and revoking modules for one workspace.
 *
 * ## What this completes
 *
 * `PlatformTenantModuleEntitlement` already existed and was already honoured:
 * `getModuleAccess` in the browser reads it *before* the plan's own feature
 * list, so a row here overrides what the subscription would otherwise allow —
 * which is exactly how you give a customer something their plan does not
 * include, or take something away without moving them off their plan.
 *
 * Nothing could write those rows. The table was read-only in practice, so the
 * override existed in the data model and nowhere a person could reach. These
 * two endpoints are the missing half.
 *
 * ## Effective access, not just overrides
 *
 * The GET answers with what the workspace can actually open today and *why* —
 * plan, override, or neither — because "does this customer have Reports?" is
 * the question being asked, and answering it from the override table alone
 * would be wrong for every module the plan already covers.
 */

export const platformModulesRouter = Router();

const moduleGrantSchema = z.object({
  /** enabled | disabled | trial. `trial` counts as access, same as enabled. */
  status: z.enum(["enabled", "disabled", "trial"]),
  moduleName: z.string().trim().min(1).max(191).optional(),
  seatsIncluded: z.coerce.number().int().min(0).optional(),
});

/** Everything the plan catalogue knows about, for the picker. */
async function knownModules() {
  const features = await prisma.subscriptionPlanFeature.findMany({
    where: { category: "modules" },
    select: { featureKey: true, name: true },
    distinct: ["featureKey"],
    orderBy: { name: "asc" },
  });

  return new Map(features.map((feature) => [feature.featureKey, feature.name]));
}

platformModulesRouter.get(
  "/tenants/:tenantId/modules",
  asyncHandler(async (req, res) => {
    const tenantId = req.params.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, subscriptionPlan: true },
    });

    if (!tenant) {
      throw HttpError.notFound("platform.tenantNotFound", { code: "tenant_not_found" });
    }

    const subscription = await prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { planCode: true, subscriptionStatus: true },
    });

    const planCode = subscription?.planCode ?? tenant.subscriptionPlan ?? null;

    const [catalogue, planFeatures, overrides] = await Promise.all([
      knownModules(),
      planCode
        ? prisma.subscriptionPlanFeature.findMany({
            where: { planCode, category: "modules" },
            select: { featureKey: true, name: true, accessLevel: true },
          })
        : Promise.resolve([]),
      prisma.platformTenantModuleEntitlement.findMany({ where: { tenantId } }),
    ]);

    const planMap = new Map(planFeatures.map((feature) => [feature.featureKey, feature]));
    const overrideMap = new Map(overrides.map((entry) => [entry.moduleKey, entry]));

    /*
     * The union of everything nameable: what the plan grants, what has been
     * overridden, and everything else in the catalogue — so a module the plan
     * does not include is still offered to be granted rather than being
     * invisible.
     */
    const keys = new Set<string>([...catalogue.keys(), ...planMap.keys(), ...overrideMap.keys()]);

    const modules = [...keys].map((moduleKey) => {
      const override = overrideMap.get(moduleKey) ?? null;
      const planFeature = planMap.get(moduleKey) ?? null;

      const planAllows =
        planFeature?.accessLevel === "included" || planFeature?.accessLevel === "limited";
      const overrideAllows = override
        ? override.status === "enabled" || override.status === "trial"
        : null;

      return {
        module_key: moduleKey,
        name: override?.moduleName ?? planFeature?.name ?? catalogue.get(moduleKey) ?? moduleKey,
        // What the plan alone would say.
        in_plan: Boolean(planFeature),
        plan_allows: planAllows,
        // The override, when one exists.
        override_status: override?.status ?? null,
        seats_included: override?.seatsIncluded ?? null,
        // What actually happens today, and on whose authority.
        allowed: overrideAllows ?? planAllows,
        source: override ? "tenant_override" : planFeature ? "plan" : "not_granted",
      };
    });

    modules.sort((a, b) => a.name.localeCompare(b.name));

    sendSuccess(res, {
      messageKey: "platform.tenantModulesListed",
      data: {
        tenant: { id: tenant.id, name: tenant.name },
        plan_code: planCode,
        subscription_status: subscription?.subscriptionStatus ?? null,
        modules,
      },
    });
  }),
);

platformModulesRouter.put(
  "/tenants/:tenantId/modules/:moduleKey",
  asyncHandler(async (req, res) => {
    const { tenantId, moduleKey } = req.params;
    const input = moduleGrantSchema.parse(req.body ?? {});

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw HttpError.notFound("platform.tenantNotFound", { code: "tenant_not_found" });
    }

    const catalogue = await knownModules();
    const name = input.moduleName ?? catalogue.get(moduleKey) ?? moduleKey;

    /*
     * There is no unique constraint on (tenantId, moduleKey), so this cannot
     * be an upsert — find, then update or create. Two grants for the same
     * module racing would otherwise leave two rows and an arbitrary winner.
     */
    const existing = await prisma.platformTenantModuleEntitlement.findFirst({
      where: { tenantId, moduleKey },
      orderBy: { createdAt: "desc" },
    });

    const entitlement = existing
      ? await prisma.platformTenantModuleEntitlement.update({
          where: { id: existing.id },
          data: {
            status: input.status,
            moduleName: name,
            seatsIncluded: input.seatsIncluded ?? existing.seatsIncluded,
          },
        })
      : await prisma.platformTenantModuleEntitlement.create({
          data: {
            tenantId,
            moduleKey,
            moduleName: name,
            status: input.status,
            seatsIncluded: input.seatsIncluded ?? null,
          },
        });

    // Tidy up any duplicates a previous race may have left behind.
    await prisma.platformTenantModuleEntitlement.deleteMany({
      where: { tenantId, moduleKey, id: { not: entitlement.id } },
    });

    sendSuccess(res, {
      messageKey: "platform.tenantModuleUpdated",
      data: {
        module_key: entitlement.moduleKey,
        name: entitlement.moduleName,
        status: entitlement.status,
        seats_included: entitlement.seatsIncluded,
      },
    });
  }),
);

/**
 * Every person with an account, across every workspace.
 *
 * The console's Platform Users screen read the Supabase table
 * `platform_admins`, which this deployment does not have — so it listed nobody
 * however many operators and members existed. This answers from our own
 * database.
 *
 * Emails and display names are encrypted at rest, so they are decrypted here
 * rather than stored in the clear; the route is already platform-admin only.
 * Nothing sensitive beyond identity is returned — no hashes, no tokens.
 */
platformModulesRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        emailEncrypted: true,
        displayNameEncrypted: true,
        isPlatformAdmin: true,
        createdAt: true,
        tenantMemberships: {
          select: { role: true, tenant: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const rows = users.map((user) => {
      const membership = user.tenantMemberships[0] ?? null;

      return {
        id: user.id,
        email: decryptNullable(user.emailEncrypted) ?? "(unreadable)",
        display_name: decryptNullable(user.displayNameEncrypted),
        is_platform_admin: user.isPlatformAdmin,
        role: membership?.role ?? null,
        tenant_id: membership?.tenant.id ?? null,
        tenant_name: membership?.tenant.name ?? null,
        created_at: user.createdAt,
      };
    });

    sendSuccess(res, {
      messageKey: "platform.usersListed",
      data: {
        users: rows,
        total: rows.length,
        platform_admins: rows.filter((row) => row.is_platform_admin).length,
      },
    });
  }),
);

/**
 * Grants or revokes platform-admin rights.
 *
 * ## The self-revoke guard
 *
 * An operator cannot remove their own rights. It is the one change that
 * cannot be undone from the interface that made it: the moment it saves, the
 * console closes behind them, and if they were the last admin the platform has
 * nobody who can let anyone back in. Refusing costs a caller nothing — they
 * can ask a colleague — while allowing it can only be repaired from the
 * database.
 *
 * The last-admin case is refused for the same reason even when somebody is
 * demoting a different account.
 */
platformModulesRouter.put(
  "/users/:userId/platform-admin",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { isPlatformAdmin } = z
      .object({ isPlatformAdmin: z.boolean() })
      .parse(req.body ?? {});

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isPlatformAdmin: true, emailEncrypted: true },
    });

    if (!target) {
      throw HttpError.notFound("platform.userNotFound", { code: "user_not_found" });
    }

    if (!isPlatformAdmin) {
      if (req.user?.id === userId) {
        throw HttpError.badRequest("platform.cannotRevokeSelf", {
          code: "cannot_revoke_self",
        });
      }

      const remaining = await prisma.user.count({
        where: { isPlatformAdmin: true, id: { not: userId } },
      });

      if (remaining === 0) {
        throw HttpError.badRequest("platform.lastPlatformAdmin", {
          code: "last_platform_admin",
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isPlatformAdmin },
      select: { id: true, isPlatformAdmin: true, emailEncrypted: true },
    });

    sendSuccess(res, {
      messageKey: isPlatformAdmin
        ? "platform.platformAdminGranted"
        : "platform.platformAdminRevoked",
      data: {
        id: updated.id,
        email: decryptNullable(updated.emailEncrypted),
        is_platform_admin: updated.isPlatformAdmin,
      },
    });
  }),
);

/** Removes the override so the plan decides again. */
platformModulesRouter.delete(
  "/tenants/:tenantId/modules/:moduleKey",
  asyncHandler(async (req, res) => {
    const { tenantId, moduleKey } = req.params;

    const removed = await prisma.platformTenantModuleEntitlement.deleteMany({
      where: { tenantId, moduleKey },
    });

    sendSuccess(res, {
      messageKey: "platform.tenantModuleReset",
      data: { module_key: moduleKey, removed: removed.count },
    });
  }),
);

/**
 * Every subscription on the platform, with the workspace it belongs to.
 *
 * The console's Subscriptions screen reported "Subscription records could not
 * be loaded" because it called a Supabase RPC this deployment does not have.
 * The rows have been in `tenant_subscriptions` all along.
 */
platformModulesRouter.get(
  "/subscription-records",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "all").trim();

    const subscriptions = await prisma.tenantSubscription.findMany({
      where: status === "all" || !status ? undefined : { subscriptionStatus: status },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { tenant: { select: { id: true, name: true } } },
    });

    const planNames = new Map(
      (await prisma.subscriptionPlan.findMany({ select: { code: true, name: true } })).map((p) => [
        p.code,
        p.name,
      ]),
    );

    /*
     * Invoice and payment counts per workspace, in two queries rather than two
     * per row. The console prints both beside every subscription, and reading
     * zero when a customer has paid is the kind of wrong that sends an
     * operator chasing a problem that does not exist.
     */
    const tenantIds = subscriptions.map((s) => s.tenantId);

    const [invoiceCounts, paymentCounts] = await Promise.all([
      prisma.subscriptionInvoice.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: tenantIds } },
        _count: { _all: true },
      }),
      prisma.paymentTransaction.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: tenantIds } },
        _count: { _all: true },
      }),
    ]);

    const invoicesByTenant = new Map(invoiceCounts.map((r) => [r.tenantId, r._count._all]));
    const paymentsByTenant = new Map(
      paymentCounts.filter((r) => r.tenantId).map((r) => [r.tenantId as string, r._count._all]),
    );

    const now = Date.now();

    sendSuccess(res, {
      messageKey: "platform.subscriptionsListed",
      data: {
        subscriptions: subscriptions.map((s) => ({
          id: s.id,
          tenant_id: s.tenantId,
          tenant_name: s.tenant?.name ?? null,
          plan_code: s.planCode,
          plan_name: planNames.get(s.planCode) ?? s.planCode,
          billing_cycle: s.billingCycle,
          status: s.subscriptionStatus,
          payment_status: s.paymentStatus,
          approval_status: s.approvalStatus,
          amount: s.subscriptionAmount,
          current_period_start: s.currentPeriodStart,
          current_period_end: s.currentPeriodEnd,
          trial_ends_at: s.trialEndsAt,
          activated_at: s.activatedAt,
          created_at: s.createdAt,
          invoice_count: invoicesByTenant.get(s.tenantId) ?? 0,
          payment_count: paymentsByTenant.get(s.tenantId) ?? 0,
          /* Days left, so the caller does not recompute it in four places. */
          days_remaining: s.currentPeriodEnd
            ? Math.ceil((s.currentPeriodEnd.getTime() - now) / 86_400_000)
            : null,
        })),
      },
    });
  }),
);

/**
 * Issued receipts, newest first — the platform-wide view of
 * `subscription_invoices`.
 */
platformModulesRouter.get(
  "/invoices",
  asyncHandler(async (_req, res) => {
    const invoices = await prisma.subscriptionInvoice.findMany({
      orderBy: { issuedAt: "desc" },
      take: 500,
      include: { tenant: { select: { id: true, name: true } } },
    });

    sendSuccess(res, {
      messageKey: "platform.invoicesListed",
      data: {
        invoices: invoices.map((invoice) => ({
          id: invoice.id,
          invoice_no: invoice.invoiceNo,
          tenant_id: invoice.tenantId,
          tenant_name: invoice.tenant?.name ?? null,
          plan_code: invoice.planCode,
          plan_name: invoice.planName,
          billing_cycle: invoice.billingCycle,
          period_start: invoice.periodStart,
          period_end: invoice.periodEnd,
          amount: invoice.amount,
          currency: invoice.currency,
          payment_method_name: invoice.paymentMethodName,
          provider_txn_id: invoice.providerTxnId,
          paid_at: invoice.paidAt,
          issued_at: invoice.issuedAt,
          emailed_at: invoice.emailedAt,
          sms_sent_at: invoice.smsSentAt,
        })),
        total: invoices.length,
      },
    });
  }),
);

/**
 * Granting a module to one workspace, and taking it away again.
 *
 *   npx tsx scripts/smoke_module_grants.ts
 *
 * The point being proved is not that a row can be written — it is that the
 * row changes what the workspace is actually allowed to open. So every
 * assertion reads back through `resolveEntitlements`, the same data the
 * browser's `getModuleAccess` decides on.
 */
import { prisma } from "../src/db/prisma";
import { resolveEntitlements } from "../src/lib/planLimits";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ok    ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL  ${label}`, detail ?? "");
  }
}

/** What the workspace can open right now, as the app would decide it. */
async function allows(tenantId: string, moduleKey: string) {
  const entitlements = await resolveEntitlements(tenantId);

  const override = entitlements.module_entitlements.find((e) => e.module_key === moduleKey);
  if (override) return override.status === "enabled" || override.status === "trial";

  const feature = entitlements.features.find((f) => f.feature_key === moduleKey);
  return feature ? feature.access_level === "included" || feature.access_level === "limited" : false;
}

async function main() {
  const stamp = Date.now();

  // A workspace on the smallest plan, which does not include reports.
  const tenant = await prisma.tenant.create({
    data: { name: `Module Grant ${stamp}`, subscriptionPlan: "starter", workspaceStatus: "active" },
  });

  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      planCode: "starter",
      billingCycle: "monthly",
      billingMonths: 1,
      subscriptionStatus: "active",
      paymentStatus: "paid",
      approvalStatus: "approved",
    },
  });

  try {
    console.log(`\n  workspace ${tenant.name} on the Starter plan\n`);

    const beforeReports = await allows(tenant.id, "reports");
    check("Starter does not include Reports", beforeReports === false, beforeReports);

    const beforePos = await allows(tenant.id, "pos");
    check("Starter does include the till", beforePos === true, beforePos);

    // ---- grant a module the plan does not cover --------------------------
    await prisma.platformTenantModuleEntitlement.create({
      data: { tenantId: tenant.id, moduleKey: "reports", moduleName: "Reports", status: "enabled" },
    });

    check("granting Reports opens it", (await allows(tenant.id, "reports")) === true);

    // ---- revoke a module the plan *does* cover ---------------------------
    await prisma.platformTenantModuleEntitlement.create({
      data: { tenantId: tenant.id, moduleKey: "pos", moduleName: "Point of sale", status: "disabled" },
    });

    check("revoking the till closes it, despite the plan", (await allows(tenant.id, "pos")) === false);

    // ---- trial counts as access -----------------------------------------
    await prisma.platformTenantModuleEntitlement.updateMany({
      where: { tenantId: tenant.id, moduleKey: "reports" },
      data: { status: "trial" },
    });

    check("a trial grant still opens the module", (await allows(tenant.id, "reports")) === true);

    // ---- removing the override hands the decision back to the plan -------
    await prisma.platformTenantModuleEntitlement.deleteMany({
      where: { tenantId: tenant.id, moduleKey: "pos" },
    });

    check("removing the override restores the plan's answer", (await allows(tenant.id, "pos")) === true);

    await prisma.platformTenantModuleEntitlement.deleteMany({
      where: { tenantId: tenant.id, moduleKey: "reports" },
    });

    check("and closes what the plan never granted", (await allows(tenant.id, "reports")) === false);
  } finally {
    await prisma.platformTenantModuleEntitlement.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenantSubscription.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  }

  console.log(failures === 0 ? "\nAll module grant checks passed.\n" : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error("\nsmoke failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

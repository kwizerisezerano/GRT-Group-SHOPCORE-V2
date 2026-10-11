/**
 * Provisions the shared cashier account in every organization.
 *
 * This is intentionally an explicit seed, not part of the normal database
 * seed: it creates a login account and therefore needs an operator-supplied
 * password. Set SEED_CASHIER_PASSWORD before running it.
 *
 * Usage:
 *   SEED_CASHIER_PASSWORD="..." npm run seed:cashier
 */

import { prisma } from "../src/db/prisma";
import { env } from "../src/config/env";
import { emailBlindIndex, encrypt } from "../src/lib/crypto";
import { hashPassword } from "../src/lib/password";

const EMAIL = process.env.SEED_CASHIER_EMAIL || "globaltech@gmail.com";
const DISPLAY_NAME = process.env.SEED_CASHIER_DISPLAY_NAME || "GlobalTech Cashier";
const PASSWORD = process.env.SEED_CASHIER_PASSWORD;
const TENANT_HINT = process.env.SEED_CASHIER_TENANT || "";
const CASHIER_PERMISSIONS = [
  "pos.use",
  "sales.view",
  "sales.create",
  "sales.refund",
  "products.view",
  "products.create",
  "products.update",
  "inventory.view",
  "inventory.adjust",
  "inventory.count",
  "customers.view",
  "customers.create",
  "customers.update",
  "dashboard.view",
  "reports.view",
] as const;

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to provision a known-password cashier account in production.");
  }
  if (!PASSWORD) {
    throw new Error("Set SEED_CASHIER_PASSWORD before running seed:cashier.");
  }

  const tenants = await prisma.tenant.findMany({
    where: TENANT_HINT ? { OR: [{ id: TENANT_HINT }, { name: TENANT_HINT }] } : undefined,
    orderBy: { createdAt: "asc" },
  });
  if (tenants.length === 0) {
    throw new Error(
      TENANT_HINT
        ? `No organization matches SEED_CASHIER_TENANT="${TENANT_HINT}".`
        : "No organizations exist yet. Create an organization, then re-run."
    );
  }

  const user = await prisma.user.upsert({
    where: { emailHash: emailBlindIndex(EMAIL) },
    create: {
      emailEncrypted: encrypt(EMAIL),
      emailHash: emailBlindIndex(EMAIL),
      passwordHash: await hashPassword(PASSWORD),
      displayNameEncrypted: encrypt(EMAIL === "globaltech@gmail.com" ? DISPLAY_NAME : EMAIL),
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: await hashPassword(PASSWORD),
      displayNameEncrypted: encrypt(EMAIL === "globaltech@gmail.com" ? DISPLAY_NAME : EMAIL),
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.profile.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      tenantId: tenants[0].id,
      displayNameEncrypted: encrypt(DISPLAY_NAME),
      language: "en",
    },
    update: {
      tenantId: tenants[0].id,
      displayNameEncrypted: encrypt(DISPLAY_NAME),
    },
  });

  for (const tenant of tenants) {
    await prisma.tenantMember.upsert({
      where: { tenant_members_user_tenant_unique: { userId: user.id, tenantId: tenant.id } },
      create: {
        userId: user.id,
        tenantId: tenant.id,
        role: "cashier",
        isDefault: tenant.id === tenants[0].id,
        status: "active",
      },
      update: { role: "cashier", status: "active" },
    });

    await prisma.userRole.upsert({
      where: { user_roles_unique: { userId: user.id, tenantId: tenant.id, role: "cashier" } },
      create: { userId: user.id, tenantId: tenant.id, role: "cashier" },
      update: {},
    });

    // Persist the operational grants too. They are redundant with the
    // shipped cashier defaults, but make the assignment visible in
    // phpMyAdmin and keep older deployed permission readers in sync.
    for (const permission of CASHIER_PERMISSIONS) {
      await prisma.rolePermission.upsert({
        where: {
          tenantId_role_permission: {
            tenantId: tenant.id,
            role: "cashier",
            permission,
          },
        },
        create: {
          tenantId: tenant.id,
          role: "cashier",
          permission,
          granted: true,
          updatedBy: user.id,
        },
        update: { granted: true, updatedBy: user.id },
      });
    }
  }

  console.log(`Provisioned ${EMAIL} as cashier in ${tenants.length} organization(s).`);
  console.log("The account can use POS, add/update products, view stock, and adjust/count stock.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

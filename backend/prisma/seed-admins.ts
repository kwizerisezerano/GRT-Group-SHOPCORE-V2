/**
 * Seeds the two standing administrator accounts for local development.
 *
 * ## Why this is separate from seed.ts
 *
 * `prisma db seed` runs on every `npm run dev`, and what it seeds is reference
 * data — plans, prices, payment methods — which is the same for every
 * installation and carries no secret. Login credentials are neither. Baking a
 * known password into the automatic seed would mean every environment that
 * ever ran the dev script has two accounts whose password is published in the
 * repository, which is precisely how a development convenience becomes a
 * production incident.
 *
 * So this is an explicit, opt-in script: `npm run seed:admins`. It refuses to
 * run against NODE_ENV=production, and takes the password from the environment
 * when one is supplied.
 *
 * ## The two kinds of "admin"
 *
 * They are unrelated and both are granted here:
 *
 *   users.is_platform_admin   Platform-wide. Unlocks /platform-admin — the
 *                             operator console over every tenant (subscriptions,
 *                             invoices, feature flags, audit). Not scoped to a
 *                             workspace and not a role.
 *
 *   tenant_members.role       Workspace-scoped. "admin" is rank 7 of 9
 *                             (lib/permissions.ts): everything a manager has
 *                             plus user and branch administration, and short of
 *                             owner by settings.billing and the owner-only acts.
 *
 * ## Idempotency
 *
 * Every write is an upsert keyed on something stable, so re-running repairs
 * rather than duplicates. The password is rehashed on each run — that is what
 * makes this the way to recover a forgotten local login.
 */

import { prisma } from "../src/db/prisma";
import { env } from "../src/config/env";
import { emailBlindIndex, encrypt } from "../src/lib/crypto";
import { hashPassword } from "../src/lib/password";
import type { Role } from "../src/lib/permissions";

const PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@2026";

/** Which workspace the admins join. Accepts a tenant id or an exact name. */
const TENANT_HINT = process.env.SEED_ADMIN_TENANT || "";

const ADMINS: { email: string; displayName: string; role: Role; platformAdmin: boolean }[] = [
  {
    email: "yumvagusengapatrick14@gmail.com",
    displayName: "Patrick Yumvagusenga",
    role: "owner",
    platformAdmin: true,
  },
  {
    email: "yumvagusenga2000@gmail.com",
    displayName: "Yumvagusenga",
    role: "owner",
    platformAdmin: false,
  },
];

/**
 * The workspace to attach the admins to.
 *
 * A workspace role has no meaning without a tenant — `requirePermission` reads
 * the caller's role off `tenant_members` per request, so a user with no
 * membership row has no permissions at all. There is no sensible tenant to
 * invent here either: it would be an empty workspace with none of the data the
 * admins are meant to administer. So this resolves an existing one and stops
 * with an instruction if there is none.
 */
async function resolveTenant() {
  if (TENANT_HINT) {
    const match = await prisma.tenant.findFirst({
      where: { OR: [{ id: TENANT_HINT }, { name: TENANT_HINT }] },
    });
    if (!match) {
      throw new Error(
        `No workspace matches SEED_ADMIN_TENANT="${TENANT_HINT}" (checked id and name).`
      );
    }
    return match;
  }

  // Oldest first: the workspace created at first signup is the one being
  // worked in, and picking it keeps a no-argument run predictable.
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) {
    throw new Error(
      "No workspace exists yet. Sign up once at http://127.0.0.1:5173 to create one, then re-run."
    );
  }
  return tenant;
}

async function seedAdmin(
  spec: (typeof ADMINS)[number],
  tenant: { id: string; name: string },
  passwordHash: string
) {
  const emailHash = emailBlindIndex(spec.email);

  // Email is encrypted with a random IV per call, so it cannot be matched on.
  // The blind index is the lookup key — see lib/crypto.ts.
  /*
   * Note: this does not clear `metadata.otpRequired`, and clearing it here
   * would be pointless. Login raises the emailed second factor for every
   * account on every sign-in (auth.service.ts), so a flag cleared at seed time
   * is set again by the next login. These admins go through the same code
   * screen as everybody else.
   */

  // Email is encrypted with a random IV per call, so it cannot be matched on.
  // The blind index is the lookup key — see lib/crypto.ts.
  const user = await prisma.user.upsert({
    where: { emailHash },
    create: {
      emailEncrypted: encrypt(spec.email),
      emailHash,
      passwordHash,
      displayNameEncrypted: encrypt(spec.displayName),
      isPlatformAdmin: spec.platformAdmin,
      // Nothing gates login on this, but leaving it null would misrepresent a
      // deliberately provisioned account as one that never confirmed.
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash,
      displayNameEncrypted: encrypt(spec.displayName),
      isPlatformAdmin: spec.platformAdmin,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.profile.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      tenantId: tenant.id,
      displayNameEncrypted: encrypt(spec.displayName),
      language: "en",
    },
    update: { tenantId: tenant.id, displayNameEncrypted: encrypt(spec.displayName) },
  });

  // What the permission middleware actually reads on every request.
  await prisma.tenantMember.upsert({
    where: { tenant_members_user_tenant_unique: { userId: user.id, tenantId: tenant.id } },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: spec.role,
      isDefault: true,
      status: "active",
    },
    update: { role: spec.role, status: "active" },
  });

  // Kept in step with tenant_members because createPendingWorkspace writes
  // both; a row here that disagreed with the membership would be a trap for
  // whatever reads this table next.
  await prisma.userRole.upsert({
    where: { user_roles_unique: { userId: user.id, tenantId: tenant.id, role: spec.role } },
    create: { userId: user.id, tenantId: tenant.id, role: spec.role },
    update: {},
  });

  return user.id;
}

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to seed known-password admin accounts in production.");
  }

  const tenant = await resolveTenant();
  const passwordHash = await hashPassword(PASSWORD);

  console.log(`Workspace: ${tenant.name} (${tenant.id})`);

  for (const spec of ADMINS) {
    const id = await seedAdmin(spec, tenant, passwordHash);
    console.log(
      `  ${spec.email}  ->  ${spec.platformAdmin ? "platform admin + " : ""}workspace ${spec.role}  (${id})`
    );
  }

  console.log(`\nPassword for both: ${PASSWORD}`);
  console.log("Platform console: http://127.0.0.1:5173/platform-admin");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

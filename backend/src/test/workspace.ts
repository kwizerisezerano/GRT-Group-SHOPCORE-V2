import crypto from "node:crypto";
import { prisma } from "../db/prisma";
import { emailBlindIndex, encrypt } from "../lib/crypto";
import type { Role } from "../lib/permissions";

/**
 * Creates a workspace a request can actually be authorised against.
 *
 * Integration tests used to sign a token for an invented user id and a tenant
 * with no membership row, which worked only because nothing checked. Now that
 * `requirePermission` reads the caller's role from `tenant_members` on every
 * request — deliberately, so a demotion takes effect immediately rather than
 * whenever a token happens to expire — a caller with no membership has no
 * permissions and every write is refused.
 *
 * That is the correct behaviour, so the tests grew a real membership rather
 * than the guard growing an exception for them. This is that setup: a user
 * row (the membership's foreign key needs one), a tenant, and the join between
 * them carrying the role under test.
 */
export async function seedWorkspace(input: {
  tenantId: string;
  userId: string;
  role?: Role;
  tenantName?: string;
}) {
  const { tenantId, userId, role = "owner", tenantName = "Test Workspace" } = input;

  // Unique per call: emailHash is globally unique, so two workspaces in the
  // same suite must not collide on it.
  const email = `${userId}@test.local`;

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      emailEncrypted: encrypt(email),
      emailHash: emailBlindIndex(email),
      passwordHash: crypto.randomBytes(16).toString("hex"),
    },
  });

  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: { id: tenantId, name: tenantName },
  });

  await prisma.tenantMember.upsert({
    where: { tenant_members_user_tenant_unique: { userId, tenantId } },
    update: { role },
    create: { tenantId, userId, role },
  });
}

/** Removes what seedWorkspace created, innermost first. */
export async function cleanupWorkspace(input: { tenantId: string; userId: string }) {
  await prisma.tenantMember.deleteMany({ where: { tenantId: input.tenantId } });
  await prisma.tenant.deleteMany({ where: { id: input.tenantId } });
  await prisma.user.deleteMany({ where: { id: input.userId } });
}

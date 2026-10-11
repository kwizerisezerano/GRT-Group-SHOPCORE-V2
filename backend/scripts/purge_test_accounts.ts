/**
 * Deletes the throwaway accounts left behind by end-to-end runs.
 *
 *   npx tsx scripts/purge_test_accounts.ts            # dry run, lists them
 *   npx tsx scripts/purge_test_accounts.ts --delete   # actually removes them
 *
 * ## Why this cannot be a `LIKE '%@example.test'`
 *
 * Emails are encrypted at rest (lib/crypto.ts) and indexed by an HMAC blind
 * index, so there is no column to pattern-match on — an exact address can be
 * looked up by its hash, but "every address on this domain" cannot. So each
 * row is decrypted in memory and matched here.
 *
 * ## Why the domain is fixed
 *
 * `.test` is reserved by RFC 2606 and can never be a real domain, so nothing a
 * customer could actually own is reachable by this script. The domain is not a
 * command-line argument on purpose: a script that deletes every user on a
 * domain someone types is one typo away from deleting real accounts.
 *
 * Dry run by default, for the same reason.
 */
import { prisma } from "../src/db/prisma";
import { decryptNullable } from "../src/lib/crypto";

/** Reserved by RFC 2606. Never a real address. */
const TEST_DOMAIN = "@example.test";

const shouldDelete = process.argv.includes("--delete");

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, emailEncrypted: true, createdAt: true },
  });

  const doomed = users.filter((user) => {
    const email = decryptNullable(user.emailEncrypted)?.toLowerCase() ?? "";
    return email.endsWith(TEST_DOMAIN);
  });

  if (doomed.length === 0) {
    console.log(`\nNo accounts on ${TEST_DOMAIN}. Nothing to do.\n`);
    return;
  }

  console.log(`\n${doomed.length} test account(s) on ${TEST_DOMAIN}:\n`);
  for (const user of doomed) {
    const email = decryptNullable(user.emailEncrypted) ?? "(unreadable)";
    console.log(`  ${user.createdAt.toISOString().slice(0, 16).replace("T", " ")}  ${email}`);
  }

  const userIds = doomed.map((user) => user.id);

  // Workspaces these accounts own, so their data goes with them rather than
  // being orphaned to a tenant nobody can sign into.
  const memberships = await prisma.tenantMember.findMany({
    where: { userId: { in: userIds } },
    select: { tenantId: true },
  });
  const tenantIds = [...new Set(memberships.map((m) => m.tenantId))];

  console.log(`\nand ${tenantIds.length} workspace(s) belonging to them.`);

  if (!shouldDelete) {
    console.log("\nDry run. Re-run with --delete to remove them.\n");
    return;
  }

  /*
   * Ordered child-first. Several of these relations are RESTRICT rather than
   * CASCADE, so deleting the user first fails on a foreign key and leaves the
   * job half done.
   */
  if (tenantIds.length) {
    await prisma.paymentLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.paymentTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.activityLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantSubscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.userRole.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.profile.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }

  await prisma.paymentLog.deleteMany({ where: { tenantId: null } }).catch(() => undefined);
  await prisma.loginOtp.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.tenantMember.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.profile.deleteMany({ where: { id: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log(`\nRemoved ${doomed.length} account(s) and ${tenantIds.length} workspace(s).\n`);
}

main()
  .catch((error) => {
    console.error("\npurge failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

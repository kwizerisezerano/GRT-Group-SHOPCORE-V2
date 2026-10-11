/**
 * Checks the data the workspace picker is built from: every tenant with its
 * owner's name and email and a member count, decrypted for display.
 *
 * Run with:  npx tsx smoke_tenant_picker.ts
 */
import { prisma } from "./src/db/prisma";
import { decryptNullable } from "./src/lib/crypto";

async function main() {
  const admins = await prisma.user.findMany({
    where: { isPlatformAdmin: true },
    select: { emailEncrypted: true },
  });
  console.log(
    "\nPlatform admins:",
    admins.map((a) => decryptNullable(a.emailEncrypted)).join(", ") || "(none)"
  );

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      owner: { select: { emailEncrypted: true, displayNameEncrypted: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });

  console.log(`\nWorkspaces the picker will offer (${tenants.length}):\n`);
  for (const tenant of tenants) {
    const ownerName = decryptNullable(tenant.owner?.displayNameEncrypted ?? null) ?? "(no owner)";
    const ownerEmail = decryptNullable(tenant.owner?.emailEncrypted ?? null) ?? "(no email)";
    console.log(`  ${tenant.name}`);
    console.log(`      owner: ${ownerName} <${ownerEmail}>  ·  ${tenant._count.members} member(s)`);
  }
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

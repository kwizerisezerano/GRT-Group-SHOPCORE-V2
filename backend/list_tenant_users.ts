import { prisma } from "./src/db/prisma";
import { decrypt } from "./src/lib/crypto";

async function main() {
  const tenantId = "5ef6989b-3b5d-42a9-b2b4-685b98c319cf"; // Patrick shop
  
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      owner: true,
      members: {
        include: { user: true }
      }
    }
  });

  if (!tenant) {
    console.log("Tenant not found");
    return;
  }

  console.log(`\nUsers for Tenant: ${tenant.name}\n`);

  if (tenant.ownerId) {
    console.log("Tenant ownerId points to:", tenant.ownerId);
  }

  const members = await prisma.tenantMember.findMany({
    where: { tenantId },
    include: { user: true }
  });

  for (const member of members) {
    const email = decrypt(member.user.emailEncrypted);
    const isPlatformAdmin = member.user.isPlatformAdmin;
    console.log(`- Email: ${email}`);
    console.log(`  Role: ${member.role}`);
    console.log(`  Is Platform Admin: ${isPlatformAdmin}\n`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

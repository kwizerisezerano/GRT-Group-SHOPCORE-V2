import { prisma } from "./src/db/prisma";
import { decrypt } from "./src/lib/crypto";

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { id: "5ef6989b-3b5d-42a9-b2b4-685b98c319cf" }, // Patrick shop
    include: {
      owner: true,
      members: {
        include: { user: true }
      }
    }
  });

  if (!tenant) {
    console.log("Tenant not found.");
    return;
  }

  if (tenant.owner) {
    const ownerEmail = decrypt(tenant.owner.emailEncrypted);
    console.log("Owner ID:", tenant.owner.id);
    console.log("Owner Email:", ownerEmail);
    console.log("Owner is platform admin:", tenant.owner.isPlatformAdmin);
  } else {
    console.log("No ownerId set on the tenant.");
    
    // Check members for 'owner' role
    console.log("Looking for members with owner role...");
    for (const member of tenant.members) {
      if (member.role === "owner" || member.role === "admin") {
        const memberEmail = decrypt(member.user.emailEncrypted);
        console.log(`Member [${member.role}]:`, memberEmail);
      }
    }
  }

  // Also check platform admins in general
  const platformAdmins = await prisma.user.findMany({
    where: { isPlatformAdmin: true }
  });
  console.log("\nPlatform Admins:");
  for (const admin of platformAdmins) {
    console.log("- ", decrypt(admin.emailEncrypted));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { prisma } from "./src/db/prisma";
import { emailBlindIndex } from "./src/lib/crypto";
import { hashPassword } from "./src/lib/password";

async function main() {
  const email = "cashier@gmail.com";
  const newPassword = "Rwanda1234@";
  const tenantId = "5ef6989b-3b5d-42a9-b2b4-685b98c319cf"; // Patrick shop
  
  const user = await prisma.user.findUnique({
    where: { emailHash: emailBlindIndex(email) }
  });

  if (!user) {
    console.log("User not found!");
    return;
  }

  // Update password so we know what it is
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) }
  });
  
  // Set as tenant owner in the tenant record
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { ownerId: user.id }
  });

  // Assign owner role to the tenant
  await prisma.tenantMember.upsert({
    where: { tenant_members_user_tenant_unique: { userId: user.id, tenantId } },
    create: {
      userId: user.id,
      tenantId,
      role: "owner"
    },
    update: {
      role: "owner"
    }
  });

  await prisma.userRole.upsert({
    where: { user_roles_unique: { userId: user.id, tenantId, role: "owner" } },
    create: {
      userId: user.id,
      tenantId,
      role: "owner"
    },
    update: {}
  });

  // Optionally remove the "cashier" role from UserRole if we only want them to be owner
  try {
    await prisma.userRole.delete({
      where: { user_roles_unique: { userId: user.id, tenantId, role: "cashier" } }
    });
  } catch (e) {
    // Ignore if they didn't have it
  }

  console.log(`Successfully promoted ${email} to Owner of Patrick shop! Password set to ${newPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

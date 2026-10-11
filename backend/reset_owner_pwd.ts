import { prisma } from "./src/db/prisma";
import { encrypt, emailBlindIndex } from "./src/lib/crypto";
import { hashPassword } from "./src/lib/password";

async function main() {
  const email = "yumvagusengapatrick14@gmail.com";
  const newPassword = "Rwanda1234@";
  const tenantId = "5ef6989b-3b5d-42a9-b2b4-685b98c319cf"; // Patrick shop
  
  const user = await prisma.user.findUnique({
    where: { emailHash: emailBlindIndex(email) }
  });

  if (!user) {
    console.log("Owner user not found!");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) }
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

  console.log(`Successfully reset Owner password to ${newPassword} and assigned to Patrick shop!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

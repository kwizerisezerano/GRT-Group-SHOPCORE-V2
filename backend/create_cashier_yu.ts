import { prisma } from "./src/db/prisma";
import { encrypt, emailBlindIndex } from "./src/lib/crypto";
import { hashPassword } from "./src/lib/password";

async function main() {
  const email = "yumvagusenga2000@gmail.com";
  const password = "Rwanda1234@";
  const name = "YU Yumvagusenga";
  const tenantId = "5ef6989b-3b5d-42a9-b2b4-685b98c319cf"; // Patrick shop
  const role = "cashier";

  const emailHash = emailBlindIndex(email);
  const emailEncrypted = encrypt(email);
  const nameEncrypted = encrypt(name);
  const passwordHash = await hashPassword(password);

  // Check if user exists
  let user = await prisma.user.findUnique({ where: { emailHash } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        emailHash,
        emailEncrypted,
        passwordHash,
        isPlatformAdmin: false
      }
    });
    console.log("Created user:", user.id);
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash
      }
    });
    console.log("Updated existing user password:", user.id);
  }

  // Profile
  await prisma.profile.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      tenantId,
      displayNameEncrypted: nameEncrypted,
    },
    update: {
      tenantId,
      displayNameEncrypted: nameEncrypted,
    }
  });

  // Tenant Member
  await prisma.tenantMember.upsert({
    where: { tenant_members_user_tenant_unique: { userId: user.id, tenantId } },
    create: {
      userId: user.id,
      tenantId,
      role
    },
    update: {
      role
    }
  });

  // User Role
  await prisma.userRole.upsert({
    where: { user_roles_unique: { userId: user.id, tenantId, role } },
    create: {
      userId: user.id,
      tenantId,
      role
    },
    update: {}
  });

  console.log("Successfully setup cashier YU Yumvagusenga for Patrick shop.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

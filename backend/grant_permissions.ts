import { prisma } from "./src/db/prisma";
import { emailBlindIndex } from "./src/lib/crypto";
import { ALL_PERMISSIONS } from "./src/lib/permissions";

async function main() {
  const yHash = emailBlindIndex("yumvagusenga2000@gmail.com");
  const cashierHash = emailBlindIndex("globaltech@gmail.com");

  const yUser = await prisma.user.findUnique({ where: { emailHash: yHash } });
  const cUser = await prisma.user.findUnique({ where: { emailHash: cashierHash } });

  if (!yUser || !cUser) throw new Error("Users not found");

  // Find yTenant (where yUser is the owner)
  const tm = await prisma.tenantMember.findFirst({
    where: { userId: yUser.id, role: "owner" }
  });

  if (!tm) throw new Error("Tenant not found for yUser");

  const tenantId = tm.tenantId;

  console.log("Found tenant:", tenantId);

  // Grant ALL permissions to the cashier role in this tenant
  for (const permission of ALL_PERMISSIONS) {
    await prisma.rolePermission.upsert({
      where: {
        tenantId_role_permission: {
          tenantId: tenantId,
          role: "cashier",
          permission,
        },
      },
      create: {
        tenantId: tenantId,
        role: "cashier",
        permission,
        granted: true,
        updatedBy: yUser.id,
      },
      update: { granted: true, updatedBy: yUser.id },
    });
  }

  console.log(`Granted ALL ${ALL_PERMISSIONS.length} permissions to the Cashier in Yumvagusenga's workspace.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

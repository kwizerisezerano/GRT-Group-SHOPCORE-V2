import { prisma } from "./src/db/prisma";

async function main() {
  const members = await prisma.tenantMember.findMany();
  for (const m of members) {
    await prisma.userRole.upsert({
      where: { user_roles_unique: { userId: m.userId, tenantId: m.tenantId, role: m.role } },
      create: { userId: m.userId, tenantId: m.tenantId, role: m.role },
      update: {},
    });
  }
  console.log("Synced user_roles for all members");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

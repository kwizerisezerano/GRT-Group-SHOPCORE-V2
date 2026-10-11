import { prisma } from "./src/db/prisma";
import { emailBlindIndex, encrypt } from "./src/lib/crypto";

async function main() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
  if (tenants.length === 0) throw new Error("No tenants found");

  const patrickTenant = tenants[0]; // Tenant 1
  let yTenant = tenants.length > 1 ? tenants[1] : null;

  // Create a second tenant if it doesn't exist
  if (!yTenant) {
    yTenant = await prisma.tenant.create({
      data: {
        name: "Yumvagusenga Workspace",
        createdAt: new Date(),
      },
    });
    console.log("Created new workspace for Yumvagusenga2000");
  }

  const patrickHash = emailBlindIndex("yumvagusengapatrick14@gmail.com");
  const yHash = emailBlindIndex("yumvagusenga2000@gmail.com");
  const cashierHash = emailBlindIndex("globaltech@gmail.com");

  const pUser = await prisma.user.findUnique({ where: { emailHash: patrickHash } });
  const yUser = await prisma.user.findUnique({ where: { emailHash: yHash } });
  const cUser = await prisma.user.findUnique({ where: { emailHash: cashierHash } });

  // 1. Move yUser to yTenant, and remove from patrickTenant
  if (yUser) {
    await prisma.tenantMember.upsert({
      where: { tenant_members_user_tenant_unique: { userId: yUser.id, tenantId: yTenant.id } },
      create: { userId: yUser.id, tenantId: yTenant.id, role: "owner", status: "active", isDefault: true },
      update: { role: "owner", status: "active", isDefault: true },
    });
    // Set profile's active tenant
    await prisma.profile.updateMany({
      where: { id: yUser.id },
      data: { tenantId: yTenant.id },
    });
    // Remove from patrickTenant
    await prisma.tenantMember.deleteMany({
      where: { userId: yUser.id, tenantId: patrickTenant.id },
    });
    console.log("Moved Yumvagusenga2000 to their own workspace");
  }

  // 2. Move Cashier to yTenant, and remove from patrickTenant
  if (cUser) {
    await prisma.tenantMember.upsert({
      where: { tenant_members_user_tenant_unique: { userId: cUser.id, tenantId: yTenant.id } },
      create: { userId: cUser.id, tenantId: yTenant.id, role: "cashier", status: "active", isDefault: true },
      update: { role: "cashier", status: "active", isDefault: true },
    });
    await prisma.profile.updateMany({
      where: { id: cUser.id },
      data: { tenantId: yTenant.id },
    });
    // Remove from patrickTenant
    await prisma.tenantMember.deleteMany({
      where: { userId: cUser.id, tenantId: patrickTenant.id },
    });
    console.log("Moved Cashier exclusively to Yumvagusenga2000's workspace");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

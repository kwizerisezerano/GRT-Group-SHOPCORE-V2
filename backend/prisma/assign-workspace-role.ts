import { prisma } from "../src/db/prisma";
import { emailBlindIndex } from "../src/lib/crypto";

const EMAIL = process.env.WORKSPACE_USER_EMAIL || "yumvagusenga2000@gmail.com";
const TENANT = process.env.WORKSPACE_TENANT || "GRT Group";
const ROLE = process.env.WORKSPACE_ROLE || "owner";

async function main() {
  const user = await prisma.user.findUnique({
    where: { emailHash: emailBlindIndex(EMAIL) },
    select: { id: true },
  });
  if (!user) throw new Error(`No user found for ${EMAIL}.`);

  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ id: TENANT }, { name: TENANT }] },
    select: { id: true, name: true },
  });
  if (!tenant) throw new Error(`No organization found for "${TENANT}".`);

  await prisma.tenantMember.upsert({
    where: { tenant_members_user_tenant_unique: { userId: user.id, tenantId: tenant.id } },
    create: { userId: user.id, tenantId: tenant.id, role: ROLE, isDefault: true, status: "active" },
    update: { role: ROLE, status: "active", isDefault: true },
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id, tenantId: tenant.id } });
  await prisma.userRole.create({ data: { userId: user.id, tenantId: tenant.id, role: ROLE } });

  console.log(`${EMAIL} is now ${ROLE} in ${tenant.name}. Full workspace permissions are enabled.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

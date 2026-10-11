import { prisma } from "./src/db/prisma";

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true }
  });
  console.log(tenants);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

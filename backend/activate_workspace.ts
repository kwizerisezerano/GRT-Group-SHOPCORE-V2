import { prisma } from "./src/db/prisma";

async function main() {
  const yTenant = await prisma.tenant.findFirst({
    where: { name: "Yumvagusenga Workspace" }
  });

  if (!yTenant) {
    console.log("Tenant not found");
    return;
  }

  await prisma.tenant.update({
    where: { id: yTenant.id },
    data: {
      subscriptionPlan: "professional",
      subscriptionStatus: "active",
      paymentStatus: "paid",
      workspaceStatus: "active",
      billingCycle: "monthly",
      onboardingCompleted: true,
      trialStatus: "active",
    }
  });

  console.log("Workspace successfully activated!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

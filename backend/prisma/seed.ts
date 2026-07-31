import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type PlanSeed = {
  code: string;
  name: string;
  prices: {
    billingCycle: "monthly" | "six_months" | "annual";
    billingMonths: number;
    listPrice: number;
    discountPercent: number;
  }[];
};

// Mirrors the plan/price catalog the live Supabase project seeded manually.
// create_pending_workspace_for_user's port (workspace.service.ts) 404s on
// signup without matching rows here, exactly as the RPC does today if
// subscription_plans is empty live.
const PLANS: PlanSeed[] = [
  {
    code: "starter",
    name: "Starter",
    prices: [
      { billingCycle: "monthly", billingMonths: 1, listPrice: 15000, discountPercent: 0 },
      { billingCycle: "six_months", billingMonths: 6, listPrice: 15000, discountPercent: 10 },
      { billingCycle: "annual", billingMonths: 12, listPrice: 15000, discountPercent: 20 },
    ],
  },
  {
    code: "professional",
    name: "Professional",
    prices: [
      { billingCycle: "monthly", billingMonths: 1, listPrice: 35000, discountPercent: 0 },
      { billingCycle: "six_months", billingMonths: 6, listPrice: 35000, discountPercent: 10 },
      { billingCycle: "annual", billingMonths: 12, listPrice: 35000, discountPercent: 20 },
    ],
  },
  {
    code: "business_plus",
    name: "Business Plus",
    prices: [
      { billingCycle: "monthly", billingMonths: 1, listPrice: 75000, discountPercent: 0 },
      { billingCycle: "six_months", billingMonths: 6, listPrice: 75000, discountPercent: 10 },
      { billingCycle: "annual", billingMonths: 12, listPrice: 75000, discountPercent: 20 },
    ],
  },
  {
    code: "enterprise_pro",
    name: "Enterprise Pro",
    prices: [
      { billingCycle: "monthly", billingMonths: 1, listPrice: 150000, discountPercent: 0 },
      { billingCycle: "six_months", billingMonths: 6, listPrice: 150000, discountPercent: 10 },
      { billingCycle: "annual", billingMonths: 12, listPrice: 150000, discountPercent: 20 },
    ],
  },
];

const PAYMENT_METHODS = [
  { code: "mobile_money_mtn", name: "MTN Mobile Money", provider: "mtn", displayOrder: 1 },
  { code: "mobile_money_airtel", name: "Airtel Money", provider: "airtel", displayOrder: 2 },
  { code: "card", name: "Card payment", provider: "dpo", displayOrder: 3 },
  { code: "bank_transfer", name: "Bank transfer", provider: "manual", displayOrder: 4 },
];

function finalPrice(listPrice: number, discountPercent: number) {
  return Math.round(listPrice * (1 - discountPercent / 100));
}

async function main() {
  for (const plan of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: { code: plan.code, name: plan.name, isActive: true },
      update: { name: plan.name, isActive: true },
    });

    const priceRows = plan.prices.map((p) => ({
      billingCycle: p.billingCycle,
      billingMonths: p.billingMonths,
      listPrice: p.listPrice,
      finalPrice: finalPrice(p.listPrice, p.discountPercent),
      discountPercent: p.discountPercent,
      currency: "RWF",
    }));

    for (const price of priceRows) {
      await prisma.subscriptionPlanPrice.upsert({
        where: { plan_price_unique: { planCode: plan.code, billingCycle: price.billingCycle } },
        create: { planCode: plan.code, ...price },
        update: price,
      });
    }

    await prisma.publicSubscriptionPlanCatalog.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        isActive: true,
        isPublic: true,
        features: [],
        limits: [],
        prices: priceRows,
      },
      update: {
        name: plan.name,
        isActive: true,
        prices: priceRows,
      },
    });
  }

  for (const method of PAYMENT_METHODS) {
    await prisma.paymentMethod.upsert({
      where: { code: method.code },
      create: { ...method, isActive: true, currency: "RWF" },
      update: { name: method.name, provider: method.provider, displayOrder: method.displayOrder },
    });
  }

  console.log(`Seeded ${PLANS.length} subscription plans with pricing and ${PAYMENT_METHODS.length} payment methods.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

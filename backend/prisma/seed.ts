import { PrismaClient } from "@prisma/client";

import { TEST_PLAN_CODE } from "../src/modules/subscription/testPlan";

const prisma = new PrismaClient();

/**
 * The starting plan catalogue.
 *
 * Seeded, not owned: everything here is editable from the platform console
 * (modules/platform/platform.plans.routes.ts), and re-running the seed only
 * restores these four plans to their shipped shape. A plan a super admin
 * created is never touched.
 *
 * The limits are the point. Before this, plans had prices and nothing else,
 * so every workspace on every tier was effectively unlimited — "Starter" and
 * "Enterprise Pro" differed only in what they cost. A ceiling that nobody
 * wrote down is a ceiling the server cannot enforce.
 */

type LimitSeed = {
  limitKey: string;
  name: string;
  value: number | null;
  unit: string | null;
};

type FeatureSeed = {
  featureKey: string;
  name: string;
  category: string;
  accessLevel?: "included" | "limited" | "addon" | "unavailable";
  isHighlighted?: boolean;
};

type PlanSeed = {
  code: string;
  name: string;
  tagline: string;
  description: string;
  isPopular?: boolean;
  badgeText?: string | null;
  trialDays: number;
  displayOrder: number;
  prices: {
    billingCycle: "monthly" | "six_months" | "annual";
    billingMonths: number;
    listPrice: number;
    discountPercent: number;
  }[];
  /** `null` value means unlimited. */
  limits: LimitSeed[];
  features: FeatureSeed[];
};

/** The modules every paying workspace gets, whatever the tier. */
const CORE_MODULES: FeatureSeed[] = [
  { featureKey: "dashboard", name: "Dashboard", category: "modules" },
  { featureKey: "pos", name: "Point of sale", category: "modules", isHighlighted: true },
  { featureKey: "sales", name: "Sales & invoicing", category: "modules" },
  { featureKey: "products", name: "Products", category: "modules" },
  { featureKey: "categories", name: "Categories", category: "modules" },
  { featureKey: "brands", name: "Brands", category: "modules" },
  { featureKey: "units", name: "Units", category: "modules" },
  { featureKey: "inventory", name: "Inventory & stock", category: "modules" },
  { featureKey: "customers", name: "Customers", category: "modules" },
  { featureKey: "settings", name: "Workspace settings", category: "modules" },
  { featureKey: "notifications", name: "Notifications", category: "modules" },
  { featureKey: "support", name: "Support", category: "modules" },
];

const GROWTH_MODULES: FeatureSeed[] = [
  { featureKey: "purchases", name: "Purchase orders", category: "modules" },
  { featureKey: "suppliers", name: "Suppliers", category: "modules" },
  { featureKey: "expenses", name: "Expenses", category: "modules" },
  { featureKey: "reports", name: "Reports & analytics", category: "modules", isHighlighted: true },
  { featureKey: "branches", name: "Multi-branch", category: "modules" },
];

const ADVANCED_MODULES: FeatureSeed[] = [
  { featureKey: "warehouses", name: "Warehouses", category: "modules" },
  { featureKey: "loyalty", name: "Loyalty programme", category: "modules" },
  { featureKey: "staff", name: "Staff management", category: "modules" },
  { featureKey: "workspace_chat", name: "Workspace chat", category: "modules" },
  { featureKey: "activity", name: "Activity log", category: "modules" },
];

const ENTERPRISE_MODULES: FeatureSeed[] = [
  { featureKey: "ebm", name: "EBM / RRA integration", category: "modules", isHighlighted: true },
  { featureKey: "qa", name: "Quality assurance suite", category: "modules" },
];

const PLANS: PlanSeed[] = [
  {
    code: "starter",
    name: "Starter",
    tagline: "One shop, up and selling today",
    description:
      "Everything a single retail outlet needs to take payments, track stock and know what sold.",
    trialDays: 14,
    displayOrder: 1,
    prices: [
      { billingCycle: "monthly", billingMonths: 1, listPrice: 15000, discountPercent: 0 },
      { billingCycle: "six_months", billingMonths: 6, listPrice: 90000, discountPercent: 10 },
      { billingCycle: "annual", billingMonths: 12, listPrice: 180000, discountPercent: 20 },
    ],
    limits: [
      { limitKey: "users", name: "Team members", value: 3, unit: "users" },
      { limitKey: "branches", name: "Branches", value: 1, unit: "branches" },
      { limitKey: "warehouses", name: "Warehouses", value: 0, unit: "warehouses" },
      { limitKey: "products", name: "Products", value: 500, unit: "products" },
      { limitKey: "customers", name: "Customers", value: 1000, unit: "customers" },
      { limitKey: "suppliers", name: "Suppliers", value: 50, unit: "suppliers" },
      { limitKey: "monthly_transactions", name: "Monthly transactions", value: 2000, unit: "sales / month" },
    ],
    features: CORE_MODULES,
  },
  {
    code: "professional",
    name: "Professional",
    tagline: "A growing business with more than one counter",
    description:
      "Adds purchasing, suppliers, expenses and full reporting, across up to three branches.",
    isPopular: true,
    badgeText: "Most popular",
    trialDays: 14,
    displayOrder: 2,
    prices: [
      { billingCycle: "monthly", billingMonths: 1, listPrice: 35000, discountPercent: 0 },
      { billingCycle: "six_months", billingMonths: 6, listPrice: 210000, discountPercent: 10 },
      { billingCycle: "annual", billingMonths: 12, listPrice: 420000, discountPercent: 20 },
    ],
    limits: [
      { limitKey: "users", name: "Team members", value: 10, unit: "users" },
      { limitKey: "branches", name: "Branches", value: 3, unit: "branches" },
      { limitKey: "warehouses", name: "Warehouses", value: 1, unit: "warehouses" },
      { limitKey: "products", name: "Products", value: 5000, unit: "products" },
      { limitKey: "customers", name: "Customers", value: 10000, unit: "customers" },
      { limitKey: "suppliers", name: "Suppliers", value: 500, unit: "suppliers" },
      { limitKey: "monthly_transactions", name: "Monthly transactions", value: 15000, unit: "sales / month" },
    ],
    features: [...CORE_MODULES, ...GROWTH_MODULES],
  },
  {
    code: "business_plus",
    name: "Business Plus",
    tagline: "Multi-branch retail with warehouses behind it",
    description:
      "Warehouses, transfers, loyalty, staff management and workspace chat for a team running several sites.",
    trialDays: 7,
    displayOrder: 3,
    prices: [
      { billingCycle: "monthly", billingMonths: 1, listPrice: 75000, discountPercent: 0 },
      { billingCycle: "six_months", billingMonths: 6, listPrice: 450000, discountPercent: 10 },
      { billingCycle: "annual", billingMonths: 12, listPrice: 900000, discountPercent: 20 },
    ],
    limits: [
      { limitKey: "users", name: "Team members", value: 25, unit: "users" },
      { limitKey: "branches", name: "Branches", value: 10, unit: "branches" },
      { limitKey: "warehouses", name: "Warehouses", value: 5, unit: "warehouses" },
      { limitKey: "products", name: "Products", value: 25000, unit: "products" },
      { limitKey: "customers", name: "Customers", value: null, unit: "customers" },
      { limitKey: "suppliers", name: "Suppliers", value: null, unit: "suppliers" },
      { limitKey: "monthly_transactions", name: "Monthly transactions", value: 60000, unit: "sales / month" },
    ],
    features: [...CORE_MODULES, ...GROWTH_MODULES, ...ADVANCED_MODULES],
  },
  {
    code: "enterprise_pro",
    name: "Enterprise Pro",
    tagline: "No ceilings, and the compliance stack",
    description:
      "Every module, unlimited capacity, EBM/RRA integration and the quality-assurance suite.",
    badgeText: "Unlimited",
    trialDays: 0,
    displayOrder: 4,
    prices: [
      { billingCycle: "monthly", billingMonths: 1, listPrice: 150000, discountPercent: 0 },
      { billingCycle: "six_months", billingMonths: 6, listPrice: 900000, discountPercent: 10 },
      { billingCycle: "annual", billingMonths: 12, listPrice: 1800000, discountPercent: 20 },
    ],
    limits: [
      { limitKey: "users", name: "Team members", value: null, unit: "users" },
      { limitKey: "branches", name: "Branches", value: null, unit: "branches" },
      { limitKey: "warehouses", name: "Warehouses", value: null, unit: "warehouses" },
      { limitKey: "products", name: "Products", value: null, unit: "products" },
      { limitKey: "customers", name: "Customers", value: null, unit: "customers" },
      { limitKey: "suppliers", name: "Suppliers", value: null, unit: "suppliers" },
      { limitKey: "monthly_transactions", name: "Monthly transactions", value: null, unit: "sales / month" },
    ],
    features: [...CORE_MODULES, ...GROWTH_MODULES, ...ADVANCED_MODULES, ...ENTERPRISE_MODULES],
  },
  /*
   * A real plan that costs RWF 100, for putting an actual payment through the
   * gateway end to end without spending a subscription's worth of money.
   *
   * It is seeded everywhere but *offered* nowhere unless `SHOW_TEST_PLAN` is
   * set — see `listPublicPlans`. The plan screens read the public list, so
   * making it visible for testing would also put "Test — RWF 100" on the
   * pricing page in front of paying customers. The flag is the only thing
   * standing between those two, which is why the code is a constant the
   * service imports rather than a string typed in two places.
   *
   * No trial: the whole point is to reach the payment prompt.
   */
  {
    code: TEST_PLAN_CODE,
    name: "Test plan",
    tagline: "Payment testing only — not for customers",
    description:
      "A live RWF 100 charge, so the gateway, the callback and activation can be exercised for real. Hidden unless SHOW_TEST_PLAN is set.",
    trialDays: 0,
    displayOrder: 99,
    prices: [
      { billingCycle: "monthly", billingMonths: 1, listPrice: 100, discountPercent: 0 },
      { billingCycle: "six_months", billingMonths: 6, listPrice: 100, discountPercent: 0 },
      { billingCycle: "annual", billingMonths: 12, listPrice: 100, discountPercent: 0 },
    ],
    /*
     * Small on purpose: the ceilings are what this plan is for. Two of each
     * means a tester can reach "you have used 2 of 2 team members" in a couple
     * of clicks and see the block actually happen, rather than having to
     * create ten users to find out whether enforcement works.
     */
    limits: [
      { limitKey: "users", name: "Team members", value: 2, unit: "users" },
      { limitKey: "branches", name: "Branches", value: 2, unit: "branches" },
      { limitKey: "warehouses", name: "Warehouses", value: 1, unit: "warehouses" },
      { limitKey: "products", name: "Products", value: 50, unit: "products" },
      { limitKey: "customers", name: "Customers", value: 50, unit: "customers" },
      { limitKey: "suppliers", name: "Suppliers", value: 10, unit: "suppliers" },
      { limitKey: "monthly_transactions", name: "Monthly transactions", value: 100, unit: "sales / month" },
    ],
    features: CORE_MODULES,
  },
];

/**
 * The gateway's three live rails plus the one manual method.
 *
 * `provider` is what lib/payments/lmbtech.ts maps to a wire value, and what
 * the signup form reads to decide whether to ask for a phone number — so
 * these strings are load-bearing, not labels.
 */
const PAYMENT_METHODS = [
  {
    code: "mobile_money_mtn",
    name: "MTN Mobile Money",
    description: "Approve the payment on your phone with your MoMo PIN.",
    provider: "mtn",
    displayOrder: 1,
    supportsRecurring: false,
  },
  {
    code: "mobile_money_airtel",
    name: "Airtel Money",
    description: "Approve the payment on your phone with your Airtel Money PIN.",
    provider: "airtel",
    displayOrder: 2,
    supportsRecurring: false,
  },
  {
    code: "card",
    name: "Card payment",
    description: "Visa or Mastercard, on the gateway's secure page.",
    provider: "pesapal",
    displayOrder: 3,
    supportsRecurring: true,
  },
  {
    code: "bank_transfer",
    name: "Bank transfer",
    description: "Transfer to our account; the workspace opens once we confirm the funds.",
    provider: "manual",
    displayOrder: 4,
    supportsRecurring: false,
  },
];

function finalPrice(listPrice: number, discountPercent: number) {
  return Math.round(listPrice * (1 - discountPercent / 100));
}

async function main() {
  for (const plan of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        tagline: plan.tagline,
        description: plan.description,
        isActive: true,
        isPublic: true,
        isPopular: plan.isPopular ?? false,
        badgeText: plan.badgeText ?? null,
        trialDays: plan.trialDays,
        displayOrder: plan.displayOrder,
      },
      update: {
        name: plan.name,
        tagline: plan.tagline,
        description: plan.description,
        isActive: true,
        isPopular: plan.isPopular ?? false,
        badgeText: plan.badgeText ?? null,
        trialDays: plan.trialDays,
        displayOrder: plan.displayOrder,
      },
    });

    const priceRows = plan.prices.map((price) => ({
      billingCycle: price.billingCycle,
      billingMonths: price.billingMonths,
      listPrice: price.listPrice,
      finalPrice: finalPrice(price.listPrice, price.discountPercent),
      discountPercent: price.discountPercent,
      currency: "RWF",
    }));

    for (const price of priceRows) {
      await prisma.subscriptionPlanPrice.upsert({
        where: { plan_price_unique: { planCode: plan.code, billingCycle: price.billingCycle } },
        create: { planCode: plan.code, ...price },
        update: price,
      });
    }

    for (const [index, limit] of plan.limits.entries()) {
      await prisma.subscriptionPlanLimit.upsert({
        where: { plan_limit_unique: { planCode: plan.code, limitKey: limit.limitKey } },
        create: {
          planCode: plan.code,
          limitKey: limit.limitKey,
          name: limit.name,
          value: limit.value,
          isUnlimited: limit.value === null,
          unit: limit.unit,
          displayOrder: index,
        },
        update: {
          name: limit.name,
          value: limit.value,
          isUnlimited: limit.value === null,
          unit: limit.unit,
          displayOrder: index,
        },
      });
    }

    for (const [index, feature] of plan.features.entries()) {
      await prisma.subscriptionPlanFeature.upsert({
        where: { plan_feature_unique: { planCode: plan.code, featureKey: feature.featureKey } },
        create: {
          planCode: plan.code,
          featureKey: feature.featureKey,
          name: feature.name,
          category: feature.category,
          accessLevel: feature.accessLevel ?? "included",
          isHighlighted: feature.isHighlighted ?? false,
          displayOrder: index,
        },
        update: {
          name: feature.name,
          category: feature.category,
          accessLevel: feature.accessLevel ?? "included",
          isHighlighted: feature.isHighlighted ?? false,
          displayOrder: index,
        },
      });
    }

    /*
     * The denormalised catalogue is kept in step for anything still reading
     * it. The signup page no longer does — it reads the plan tables directly
     * (modules/workspace/workspace.routes.ts), which is why a plan created in
     * the console now reaches customers at all.
     */
    await prisma.publicSubscriptionPlanCatalog.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        isActive: true,
        isPublic: true,
        features: plan.features,
        limits: plan.limits,
        prices: priceRows,
      },
      update: {
        name: plan.name,
        isActive: true,
        features: plan.features,
        limits: plan.limits,
        prices: priceRows,
      },
    });
  }

  for (const method of PAYMENT_METHODS) {
    await prisma.paymentMethod.upsert({
      where: { code: method.code },
      create: { ...method, isActive: true, currency: "RWF" },
      update: {
        name: method.name,
        description: method.description,
        provider: method.provider,
        displayOrder: method.displayOrder,
        supportsRecurring: method.supportsRecurring,
      },
    });
  }

  const limitCount = PLANS.reduce((total, plan) => total + plan.limits.length, 0);

  console.log(
    `Seeded ${PLANS.length} subscription plans (${limitCount} limits, pricing and feature entitlements) ` +
      `and ${PAYMENT_METHODS.length} payment methods.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

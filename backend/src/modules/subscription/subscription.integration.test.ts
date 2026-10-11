import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { signAccessToken } from "../../lib/jwt";
import { seedWorkspace } from "../../test/workspace";

/**
 * Subscriptions, plan ceilings, and the money behind them.
 *
 * Three things are worth proving here and they are the three that would cost
 * real money if they broke:
 *
 *   1. A plan's ceilings are enforced by the *server*. The browser showing
 *      "3 of 3 used" is a courtesy; a workspace that can POST a fourth member
 *      past its own plan is a billing hole.
 *   2. A workspace does not open until a payment is confirmed. Signing up is
 *      not paying.
 *   3. A callback that arrives twice settles the payment once. Gateways retry.
 */

const app = createApp();

const PLAN = "test_limits_plan";
const TENANT = "5b5b5b5b-7777-4777-8777-a1a1a1a1a1a1";
const OWNER = "5b5b5b5b-7777-4777-8777-b1b1b1b1b1b1";
const OTHER_TENANT = "5c5c5c5c-7777-4777-8777-a2a2a2a2a2a2";
const OTHER_OWNER = "5c5c5c5c-7777-4777-8777-b2b2b2b2b2b2";

const token = signAccessToken({ sub: OWNER, tenantId: TENANT, role: "owner" });
const otherToken = signAccessToken({ sub: OTHER_OWNER, tenantId: OTHER_TENANT, role: "owner" });

const as = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);
const asOther = (r: request.Test) => r.set("Authorization", `Bearer ${otherToken}`);

/** A plan with deliberately tiny ceilings, so the boundary is cheap to reach. */
async function seedPlan() {
  await prisma.subscriptionPlan.upsert({
    where: { code: PLAN },
    update: { name: "Test Limits", isActive: true, isPublic: false },
    create: { code: PLAN, name: "Test Limits", isActive: true, isPublic: false },
  });

  await prisma.subscriptionPlanPrice.upsert({
    where: { plan_price_unique: { planCode: PLAN, billingCycle: "monthly" } },
    update: { listPrice: 1000, finalPrice: 1000, billingMonths: 1 },
    create: {
      planCode: PLAN,
      billingCycle: "monthly",
      billingMonths: 1,
      listPrice: 1000,
      finalPrice: 1000,
      discountPercent: 0,
      currency: "RWF",
    },
  });

  const limits = [
    { limitKey: "users", name: "Team members", value: 2 },
    { limitKey: "branches", name: "Branches", value: 1 },
    { limitKey: "products", name: "Products", value: 2 },
    { limitKey: "customers", name: "Customers", value: null },
  ];

  for (const limit of limits) {
    await prisma.subscriptionPlanLimit.upsert({
      where: { plan_limit_unique: { planCode: PLAN, limitKey: limit.limitKey } },
      update: { value: limit.value, isUnlimited: limit.value === null, name: limit.name },
      create: {
        planCode: PLAN,
        limitKey: limit.limitKey,
        name: limit.name,
        value: limit.value,
        isUnlimited: limit.value === null,
      },
    });
  }
}

async function putTenantOnPlan(tenantId: string, userId: string) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { subscriptionPlan: PLAN, billingCycle: "monthly", workspaceStatus: "active" },
  });

  await prisma.tenantSubscription.deleteMany({ where: { tenantId } });

  return prisma.tenantSubscription.create({
    data: {
      tenantId,
      userId,
      planCode: PLAN,
      billingCycle: "monthly",
      billingMonths: 1,
      subscriptionAmount: 1000,
      subscriptionCurrency: "RWF",
      subscriptionStatus: "active",
      paymentStatus: "paid",
      approvalStatus: "approved",
    },
  });
}

async function clearWorkspaceContent() {
  const tenants = [TENANT, OTHER_TENANT];
  await prisma.paymentLog.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.paymentTransaction.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.product.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.branch.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.userInvite.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.tenantLimitOverride.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.activityLog.deleteMany({ where: { tenantId: { in: tenants } } });
  // Every member except the owner each suite seeds.
  await prisma.tenantMember.deleteMany({
    where: { tenantId: { in: tenants }, userId: { notIn: [OWNER, OTHER_OWNER] } },
  });
}

async function cleanup() {
  const tenants = [TENANT, OTHER_TENANT];

  await clearWorkspaceContent();
  await prisma.tenantSubscription.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.userRole.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.profile.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, OTHER_OWNER] } } });

  await prisma.subscriptionPlanLimit.deleteMany({ where: { planCode: PLAN } });
  await prisma.subscriptionPlanFeature.deleteMany({ where: { planCode: PLAN } });
  await prisma.subscriptionPlanPrice.deleteMany({ where: { planCode: PLAN } });
  await prisma.subscriptionPlan.deleteMany({ where: { code: PLAN } });
}

beforeAll(async () => {
  await cleanup();
  await seedPlan();
  await seedWorkspace({ tenantId: TENANT, userId: OWNER, role: "owner", tenantName: "Limits Co" });
  await seedWorkspace({
    tenantId: OTHER_TENANT,
    userId: OTHER_OWNER,
    role: "owner",
    tenantName: "Other Co",
  });
  await putTenantOnPlan(TENANT, OWNER);
  await putTenantOnPlan(OTHER_TENANT, OTHER_OWNER);
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(clearWorkspaceContent);

/** Members created through the API, so the ceiling sees them the way it will live. */
const createMember = (email: string) =>
  as(request(app).post("/api/users/create")).send({
    email,
    display_name: "Test Member",
    role: "cashier",
  });

describe("plan entitlements", () => {
  it("reports the plan's ceilings and what the workspace has spent", async () => {
    const res = await as(request(app).get("/api/subscription/entitlements"));

    expect(res.status).toBe(200);
    expect(res.body.data.plan_code).toBe(PLAN);

    const seats = res.body.data.capacities.find((c: any) => c.limit_key === "users");
    expect(seats).toMatchObject({ limit: 2, is_unlimited: false, usage: 1, remaining: 1 });
  });

  it("treats a capacity the plan never priced as unlimited", async () => {
    const res = await as(request(app).get("/api/subscription/usage"));

    const suppliers = res.body.data.capacities.find((c: any) => c.limit_key === "suppliers");
    expect(suppliers.is_unlimited).toBe(true);
    expect(suppliers.limit).toBeNull();
  });

  it("honours an explicit unlimited on a priced capacity", async () => {
    const res = await as(request(app).get("/api/subscription/usage"));

    const customers = res.body.data.capacities.find((c: any) => c.limit_key === "customers");
    expect(customers.is_unlimited).toBe(true);
    expect(customers.source).toBe("plan");
  });
});

describe("seat ceiling", () => {
  it("allows members up to the plan's limit", async () => {
    // The owner already holds seat 1, so exactly one more fits.
    const res = await createMember(`seat2.${Date.now()}@example.test`);
    expect(res.status).toBe(201);
  });

  it("refuses the member past the ceiling, with the numbers in the error", async () => {
    await createMember(`seat2.${Date.now()}@example.test`).expect(201);

    const res = await createMember(`seat3.${Date.now()}@example.test`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("capacity_reached");
    expect(res.body.error.details).toMatchObject({ limit_key: "users", limit: 2, remaining: 0 });
    // The message has to be usable as it stands - "limit reached" alone sends
    // somebody back to the same button.
    expect(res.body.message).toContain("2");
  });

  it("counts a pending invitation as a seat already spent", async () => {
    const res = await as(request(app).post("/api/users/invites")).send({
      email: `invited.${Date.now()}@example.test`,
      role: "cashier",
    });
    expect(res.status).toBe(201);

    // Owner + the invitation = both seats.
    const blocked = await createMember(`after-invite.${Date.now()}@example.test`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("capacity_reached");
  });

  it("does not let one workspace's usage limit another", async () => {
    await createMember(`seat2.${Date.now()}@example.test`).expect(201);
    await createMember(`seat3.${Date.now()}@example.test`).expect(403);

    const res = await asOther(request(app).post("/api/users/create")).send({
      email: `other.${Date.now()}@example.test`,
      display_name: "Other Member",
      role: "cashier",
    });

    expect(res.status).toBe(201);
  });
});

describe("branch and product ceilings", () => {
  const createBranch = (name: string, type = "store") =>
    as(request(app).post("/api/branches")).send({ name, type });

  it("stops at the branch ceiling", async () => {
    await createBranch("Main Shop").expect(201);

    const res = await createBranch("Second Shop");
    expect(res.status).toBe(403);
    expect(res.body.error.details).toMatchObject({ limit_key: "branches" });
  });

  it("counts warehouses against their own ceiling, not the branch one", async () => {
    await createBranch("Main Shop").expect(201);

    // `warehouses` is unpriced on this plan, so it is unlimited - a warehouse
    // must not be refused just because the shop ceiling is full.
    const res = await createBranch("Central Store", "warehouse");
    expect(res.status).toBe(201);
  });

  it("stops at the product ceiling", async () => {
    const create = (name: string) =>
      as(request(app).post("/api/products")).send({ name, price: 100, cost: 50 });

    await create("Product A").expect(201);
    await create("Product B").expect(201);

    const res = await create("Product C");
    expect(res.status).toBe(403);
    expect(res.body.error.details).toMatchObject({ limit_key: "products" });
  });
});

describe("per-workspace limit overrides", () => {
  it("raises a ceiling for one workspace without touching the plan", async () => {
    await prisma.tenantLimitOverride.create({
      data: { tenantId: TENANT, limitKey: "users", value: 3, isUnlimited: false },
    });

    const usage = await as(request(app).get("/api/subscription/usage"));
    const seats = usage.body.data.capacities.find((c: any) => c.limit_key === "users");

    expect(seats).toMatchObject({ limit: 3, source: "override" });

    await createMember(`ov2.${Date.now()}@example.test`).expect(201);
    await createMember(`ov3.${Date.now()}@example.test`).expect(201);
    await createMember(`ov4.${Date.now()}@example.test`).expect(403);

    // The other workspace is still on the plan's own ceiling.
    const otherUsage = await asOther(request(app).get("/api/subscription/usage"));
    const otherSeats = otherUsage.body.data.capacities.find((c: any) => c.limit_key === "users");
    expect(otherSeats).toMatchObject({ limit: 2, source: "plan" });
  });

  it("can lift a ceiling entirely", async () => {
    await prisma.tenantLimitOverride.create({
      data: { tenantId: TENANT, limitKey: "branches", value: null, isUnlimited: true },
    });

    await as(request(app).post("/api/branches")).send({ name: "One" }).expect(201);
    await as(request(app).post("/api/branches")).send({ name: "Two" }).expect(201);
    await as(request(app).post("/api/branches")).send({ name: "Three" }).expect(201);
  });
});

describe("subscription payments", () => {
  it("starts a charge without treating it as paid", async () => {
    const res = await as(request(app).post("/api/subscription/checkout")).send({
      payment_method_code: "mobile_money_mtn",
      payer_phone: "0780000000",
    });

    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe("pending");
    // INV-YYYYMMDD-<timestamp tail>-<random>, the format the gateway documents.
    expect(res.body.data.reference_id).toMatch(/^INV-\d{8}-\d{8}-\d{4}$/);

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { referenceId: res.body.data.reference_id },
    });
    expect(transaction?.status).toBe("pending");
    // The number is PII and is stored encrypted, never in the clear.
    expect(transaction?.payerPhoneEncrypted).not.toContain("0780000000");
  });

  it("refuses mobile money with no number to send the prompt to", async () => {
    const res = await as(request(app).post("/api/subscription/checkout")).send({
      payment_method_code: "mobile_money_mtn",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("phone_required");
  });

  it("logs the exchange with the payer's details masked", async () => {
    const checkout = await as(request(app).post("/api/subscription/checkout")).send({
      payment_method_code: "mobile_money_mtn",
      payer_phone: "0780000000",
    });

    const logs = await prisma.paymentLog.findMany({
      where: { referenceId: checkout.body.data.reference_id },
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain("+250780000000");
  });

  it("opens the workspace when the gateway confirms, and only then", async () => {
    await prisma.tenant.update({
      where: { id: TENANT },
      data: { workspaceStatus: "pending_payment", paymentStatus: "pending" },
    });

    const checkout = await as(request(app).post("/api/subscription/checkout")).send({
      payment_method_code: "mobile_money_mtn",
      payer_phone: "0780000000",
    });
    const reference = checkout.body.data.reference_id;

    const midway = await prisma.tenant.findUnique({ where: { id: TENANT } });
    expect(midway?.workspaceStatus).toBe("pending_payment");

    const callback = await request(app)
      .post("/api/payments/callback/lmbtech")
      .send({ reference_id: reference, transaction_id: "TXN-1", status: "success" });

    expect(callback.status).toBe(200);
    expect(callback.body.status).toBe(true);

    const after = await prisma.tenant.findUnique({ where: { id: TENANT } });
    expect(after?.workspaceStatus).toBe("active");
    expect(after?.paymentStatus).toBe("paid");

    const subscription = await prisma.tenantSubscription.findFirst({ where: { tenantId: TENANT } });
    expect(subscription?.currentPeriodEnd).toBeTruthy();
  });

  it("absorbs a repeated callback without extending the period twice", async () => {
    const checkout = await as(request(app).post("/api/subscription/checkout")).send({
      payment_method_code: "mobile_money_mtn",
      payer_phone: "0780000000",
    });
    const reference = checkout.body.data.reference_id;

    const settle = () =>
      request(app)
        .post("/api/payments/callback/lmbtech")
        .send({ reference_id: reference, transaction_id: "TXN-2", status: "success" });

    await settle().expect(200);
    const first = await prisma.tenantSubscription.findFirst({ where: { tenantId: TENANT } });

    await settle().expect(200);
    const second = await prisma.tenantSubscription.findFirst({ where: { tenantId: TENANT } });

    expect(second?.currentPeriodEnd?.getTime()).toBe(first?.currentPeriodEnd?.getTime());
  });

  it("does not let a late failure close a workspace that already paid", async () => {
    const checkout = await as(request(app).post("/api/subscription/checkout")).send({
      payment_method_code: "mobile_money_mtn",
      payer_phone: "0780000000",
    });
    const reference = checkout.body.data.reference_id;

    await request(app)
      .post("/api/payments/callback/lmbtech")
      .send({ reference_id: reference, status: "success" })
      .expect(200);

    await request(app)
      .post("/api/payments/callback/lmbtech")
      .send({ reference_id: reference, status: "failed" })
      .expect(200);

    const tenant = await prisma.tenant.findUnique({ where: { id: TENANT } });
    expect(tenant?.workspaceStatus).toBe("active");
  });

  it("rejects a callback carrying no reference", async () => {
    const res = await request(app).post("/api/payments/callback/lmbtech").send({ status: "success" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_callback");
  });

  it("404s a reference belonging to another workspace", async () => {
    const checkout = await as(request(app).post("/api/subscription/checkout")).send({
      payment_method_code: "mobile_money_mtn",
      payer_phone: "0780000000",
    });

    const res = await asOther(
      request(app).get(`/api/payments/status/${checkout.body.data.reference_id}`)
    );

    expect(res.status).toBe(404);
  });
});

describe("public plan catalogue", () => {
  it("serves plans from the live tables, not a frozen snapshot", async () => {
    await prisma.subscriptionPlan.update({
      where: { code: PLAN },
      data: { isPublic: true, tagline: "Written in the console" },
    });

    const res = await request(app).get("/api/subscription/plans");
    const plan = res.body.data.plans.find((entry: any) => entry.code === PLAN);

    expect(plan.tagline).toBe("Written in the console");
    expect(plan.limits.find((limit: any) => limit.limit_key === "users").value).toBe(2);

    await prisma.subscriptionPlan.update({ where: { code: PLAN }, data: { isPublic: false } });
  });

  it("keeps a private plan off the public catalogue", async () => {
    const res = await request(app).get("/api/subscription/plans");
    expect(res.body.data.plans.some((entry: any) => entry.code === PLAN)).toBe(false);
  });
});

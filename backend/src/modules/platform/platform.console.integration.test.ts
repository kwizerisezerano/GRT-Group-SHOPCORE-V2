import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { emailBlindIndex } from "../../lib/crypto";
import { signAccessToken } from "../../lib/jwt";

/**
 * The commercial console: writing plans, and opening workspaces from the
 * inside.
 *
 * The guard over these routes is proved next door in platform.integration.
 * What is proved here is the behaviour a super admin depends on being exactly
 * right, because getting it wrong is either a refund or a lawsuit:
 *
 *   - a ceiling typed into a plan reaches the customer and the enforcement
 *     layer unchanged;
 *   - a plan somebody is subscribed to cannot be deleted out from under them;
 *   - a workspace created from the console is a real workspace, with an owner
 *     who has to set their own password.
 */

const app = createApp();

const ADMIN = "aa11bb22-8888-4888-8888-000000000001";
const PLAN = "console_test_plan";

const token = signAccessToken({ sub: ADMIN, tenantId: null, role: null });
const as = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

const OWNER_EMAIL = "console.owner@test.local";

async function removeCreatedWorkspace() {
  const user = await prisma.user.findUnique({ where: { emailHash: emailBlindIndex(OWNER_EMAIL) } });
  if (!user) return;

  const memberships = await prisma.tenantMember.findMany({ where: { userId: user.id } });
  const tenantIds = memberships.map((membership) => membership.tenantId);

  if (tenantIds.length > 0) {
    await prisma.activityLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantSubscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.userRole.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.profile.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }

  await prisma.profile.deleteMany({ where: { id: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

async function removeTestPlan() {
  await prisma.subscriptionPlanLimit.deleteMany({ where: { planCode: PLAN } });
  await prisma.subscriptionPlanFeature.deleteMany({ where: { planCode: PLAN } });
  await prisma.subscriptionPlanPrice.deleteMany({ where: { planCode: PLAN } });
  await prisma.subscriptionPlan.deleteMany({ where: { code: PLAN } });
}

async function cleanup() {
  await removeCreatedWorkspace();
  await removeTestPlan();
  await prisma.user.deleteMany({ where: { id: ADMIN } });
}

beforeAll(async () => {
  await cleanup();

  await prisma.user.create({
    data: {
      id: ADMIN,
      emailEncrypted: "x",
      emailHash: emailBlindIndex("console.admin@test.local"),
      passwordHash: "x",
      isPlatformAdmin: true,
    },
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(removeTestPlan);

const planBody = (overrides: Record<string, unknown> = {}) => ({
  code: PLAN,
  name: "Console Test",
  tagline: "Typed by a super admin",
  is_active: true,
  is_public: true,
  is_popular: false,
  trial_days: 7,
  display_order: 9,
  prices: [
    { billing_cycle: "monthly", list_price: 20000, discount_percent: 0 },
    { billing_cycle: "annual", list_price: 240000, discount_percent: 25 },
  ],
  limits: [
    { limit_key: "users", name: "Team members", value: 3, is_unlimited: false, unit: "users" },
    { limit_key: "branches", name: "Branches", value: 2, is_unlimited: false, unit: "branches" },
    { limit_key: "products", name: "Products", value: null, is_unlimited: true, unit: "products" },
  ],
  features: [{ feature_key: "pos", name: "Point of sale", access_level: "included" }],
  ...overrides,
});

describe("plan editor", () => {
  it("stores exactly the ceilings that were typed", async () => {
    const res = await as(request(app).post("/api/platform/plans")).send(planBody());

    expect(res.status).toBe(201);

    const limits = res.body.data.plan.limits;
    expect(limits.find((l: any) => l.limit_key === "users")).toMatchObject({
      value: 3,
      is_unlimited: false,
    });
    expect(limits.find((l: any) => l.limit_key === "branches").value).toBe(2);
    expect(limits.find((l: any) => l.limit_key === "products")).toMatchObject({
      value: null,
      is_unlimited: true,
    });
  });

  it("applies the discount rather than storing the list price as the charge", async () => {
    const res = await as(request(app).post("/api/platform/plans")).send(planBody());

    const annual = res.body.data.plan.prices.find((p: any) => p.billing_cycle === "annual");
    expect(annual.list_price).toBe(240000);
    expect(annual.final_price).toBe(180000);
    expect(annual.billing_months).toBe(12);
  });

  it("puts a public plan straight onto the signup catalogue", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    const res = await request(app).get("/api/subscription/plans");
    const plan = res.body.data.plans.find((entry: any) => entry.code === PLAN);

    expect(plan).toBeTruthy();
    expect(plan.tagline).toBe("Typed by a super admin");
    expect(plan.limits.find((l: any) => l.limit_key === "users").value).toBe(3);
  });

  it("replaces the whole ceiling set on edit, so a removed limit really goes", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    const res = await as(request(app).patch(`/api/platform/plans/${PLAN}`)).send(
      planBody({
        limits: [
          { limit_key: "users", name: "Team members", value: 10, is_unlimited: false, unit: "users" },
        ],
      })
    );

    expect(res.status).toBe(200);
    expect(res.body.data.plan.limits).toHaveLength(1);
    expect(res.body.data.plan.limits[0].value).toBe(10);

    const stored = await prisma.subscriptionPlanLimit.findMany({ where: { planCode: PLAN } });
    expect(stored).toHaveLength(1);
  });

  it("refuses a ceiling that is neither a number nor unlimited", async () => {
    const res = await as(request(app).post("/api/platform/plans")).send(
      planBody({
        limits: [{ limit_key: "users", name: "Team members", value: null, is_unlimited: false }],
      })
    );

    expect(res.status).toBe(400);
  });

  it("refuses to put a plan on sale with nothing priced", async () => {
    const res = await as(request(app).post("/api/platform/plans")).send(
      planBody({ prices: [] })
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("price_required");
  });

  it("refuses a duplicate plan code", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    const res = await as(request(app).post("/api/platform/plans")).send(planBody());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("plan_code_taken");
  });

  it("only offers capacity keys the server actually counts", async () => {
    const res = await as(request(app).get("/api/platform/plans/capacity-keys"));

    const keys = res.body.data.capacity_keys;
    expect(keys.find((k: any) => k.limit_key === "users").enforced).toBe(true);
    // Honest about the ones nothing meters yet, rather than implying a
    // ceiling that would never bite.
    expect(keys.find((k: any) => k.limit_key === "storage_gb").enforced).toBe(false);
  });
});

describe("creating an organization", () => {
  beforeEach(removeCreatedWorkspace);

  it("opens a real workspace with an owner who must set their own password", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    const res = await as(request(app).post("/api/platform/organizations")).send({
      business_name: "Console Created Ltd",
      owner_email: OWNER_EMAIL,
      owner_name: "Console Owner",
      plan_code: PLAN,
      billing_cycle: "monthly",
      activate_immediately: true,
    });

    expect(res.status).toBe(201);

    const tenantId = res.body.data.tenant_id;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    expect(tenant?.workspaceStatus).toBe("active");
    expect(tenant?.subscriptionPlan).toBe(PLAN);

    const membership = await prisma.tenantMember.findFirst({ where: { tenantId } });
    expect(membership?.role).toBe("owner");

    const owner = await prisma.user.findUnique({ where: { id: res.body.data.owner_user_id } });
    expect((owner?.metadata as any)?.mustChangePassword).toBe(true);

    const subscription = await prisma.tenantSubscription.findFirst({ where: { tenantId } });
    expect(subscription?.paymentStatus).toBe("paid");
    expect(subscription?.currentPeriodEnd).toBeTruthy();
  });

  it("leaves it closed when the sale has not been paid for", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    const res = await as(request(app).post("/api/platform/organizations")).send({
      business_name: "Awaiting Payment Ltd",
      owner_email: OWNER_EMAIL,
      owner_name: "Console Owner",
      plan_code: PLAN,
      billing_cycle: "monthly",
      activate_immediately: false,
    });

    expect(res.status).toBe(201);

    const tenant = await prisma.tenant.findUnique({ where: { id: res.body.data.tenant_id } });
    expect(tenant?.workspaceStatus).toBe("pending_payment");

    const subscription = await prisma.tenantSubscription.findFirst({
      where: { tenantId: res.body.data.tenant_id },
    });
    expect(subscription?.approvalStatus).toBe("pending");
  });

  it("refuses to attach a new workspace to somebody else's account", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    const payload = {
      business_name: "First Ltd",
      owner_email: OWNER_EMAIL,
      owner_name: "Console Owner",
      plan_code: PLAN,
      billing_cycle: "monthly",
      activate_immediately: true,
    };

    await as(request(app).post("/api/platform/organizations")).send(payload).expect(201);

    const res = await as(request(app).post("/api/platform/organizations")).send({
      ...payload,
      business_name: "Second Ltd",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("owner_email_taken");
  });

  it("shows the new workspace in the console with its seat usage", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    const created = await as(request(app).post("/api/platform/organizations")).send({
      business_name: "Listed Ltd",
      owner_email: OWNER_EMAIL,
      owner_name: "Console Owner",
      plan_code: PLAN,
      billing_cycle: "monthly",
      activate_immediately: true,
    });

    const res = await as(request(app).get("/api/platform/organizations"));
    const row = res.body.data.organizations.find(
      (entry: any) => entry.id === created.body.data.tenant_id
    );

    expect(row).toMatchObject({
      name: "Listed Ltd",
      plan_code: PLAN,
      seats_limit: 3,
      seats_used: 1,
      seats_remaining: 2,
      at_seat_limit: false,
    });
    expect(row.owner_email).toBe(OWNER_EMAIL);
  });

  it("refuses a plan that is not priced for the chosen cycle", async () => {
    await as(request(app).post("/api/platform/plans"))
      .send(
        planBody({
          prices: [{ billing_cycle: "monthly", list_price: 20000, discount_percent: 0 }],
        })
      )
      .expect(201);

    const res = await as(request(app).post("/api/platform/organizations")).send({
      business_name: "Wrong Cycle Ltd",
      owner_email: OWNER_EMAIL,
      owner_name: "Console Owner",
      plan_code: PLAN,
      billing_cycle: "annual",
      activate_immediately: true,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_price");
  });
});

describe("deleting a plan", () => {
  beforeEach(removeCreatedWorkspace);

  it("removes one nobody is on", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    await as(request(app).delete(`/api/platform/plans/${PLAN}`)).expect(200);

    expect(await prisma.subscriptionPlan.findUnique({ where: { code: PLAN } })).toBeNull();
  });

  it("refuses while a workspace is still subscribed to it", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    await as(request(app).post("/api/platform/organizations")).send({
      business_name: "Subscriber Ltd",
      owner_email: OWNER_EMAIL,
      owner_name: "Console Owner",
      plan_code: PLAN,
      billing_cycle: "monthly",
      activate_immediately: true,
    });

    const res = await as(request(app).delete(`/api/platform/plans/${PLAN}`));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("plan_in_use");
    // Deleting would take the ceilings with it, which reads as "unlimited" to
    // the limit resolver - the subscriber must keep exactly what they bought.
    expect(await prisma.subscriptionPlanLimit.count({ where: { planCode: PLAN } })).toBe(3);
  });
});

describe("workspace limit overrides", () => {
  beforeEach(removeCreatedWorkspace);

  it("raises one workspace's ceiling and reports the new headroom", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    const created = await as(request(app).post("/api/platform/organizations")).send({
      business_name: "Override Ltd",
      owner_email: OWNER_EMAIL,
      owner_name: "Console Owner",
      plan_code: PLAN,
      billing_cycle: "monthly",
      activate_immediately: true,
    });

    const tenantId = created.body.data.tenant_id;

    const res = await as(request(app).put(`/api/platform/organizations/${tenantId}/limits/users`)).send({
      value: 12,
      is_unlimited: false,
      note: "Negotiated at signing",
    });

    expect(res.status).toBe(200);

    const seats = res.body.data.capacities.find((c: any) => c.limit_key === "users");
    expect(seats).toMatchObject({ limit: 12, source: "override", remaining: 11 });
  });

  it("puts the plan's own ceiling back when the override is cleared", async () => {
    await as(request(app).post("/api/platform/plans")).send(planBody()).expect(201);

    const created = await as(request(app).post("/api/platform/organizations")).send({
      business_name: "Reset Ltd",
      owner_email: OWNER_EMAIL,
      owner_name: "Console Owner",
      plan_code: PLAN,
      billing_cycle: "monthly",
      activate_immediately: true,
    });

    const tenantId = created.body.data.tenant_id;

    await as(request(app).put(`/api/platform/organizations/${tenantId}/limits/users`))
      .send({ value: 12, is_unlimited: false })
      .expect(200);

    const res = await as(
      request(app).delete(`/api/platform/organizations/${tenantId}/limits/users`)
    );

    expect(res.status).toBe(200);
    const seats = res.body.data.capacities.find((c: any) => c.limit_key === "users");
    expect(seats).toMatchObject({ limit: 3, source: "plan" });
  });
});

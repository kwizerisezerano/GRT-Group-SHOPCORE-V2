import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { signAccessToken } from "../../lib/jwt";
import { seedWorkspace } from "../../test/workspace";

/**
 * The workspace module: what a prospective customer is shown before they pay,
 * and what an existing one may write against their own subscription.
 *
 * It had no integration coverage, and it is the module that decides who gets
 * to use the product at all. Two things here are worth pinning down properly:
 *
 *  - the plan and payment-method catalogues are public, unauthenticated
 *    endpoints, so anything not meant for sale must not appear in them;
 *  - the payment-reference endpoint lets a tenant write to a subscription
 *    row, and a row is exactly the kind of thing that gets addressed by id
 *    somewhere down the line. It has to be impossible to reach another
 *    tenant's, or to alter one that has already been decided.
 */

const app = createApp();

const TENANT_A = "d4d4d4d4-5555-4555-8555-aaaaaaaaaaaa";
const TENANT_B = "d4d4d4d4-5555-4555-8555-bbbbbbbbbbbb";
const OWNER_A = "d4d4d4d4-5555-4555-8555-000000000001";
const OWNER_B = "d4d4d4d4-5555-4555-8555-000000000002";

const tokenFor = (userId: string, tenantId: string) =>
  signAccessToken({ sub: userId, tenantId, role: "owner" });

/** A plan that exists but is deliberately not on sale. */
const HIDDEN_PLAN = "zz_internal_test_plan";
/** A payment method that has been switched off. */
const RETIRED_METHOD = "zz_retired_test_method";

async function cleanup() {
  await prisma.tenantSubscription.deleteMany({
    where: { tenantId: { in: [TENANT_A, TENANT_B] } },
  });
  await prisma.tenantMember.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
  await prisma.user.deleteMany({ where: { id: { in: [OWNER_A, OWNER_B] } } });
  await prisma.publicSubscriptionPlanCatalog.deleteMany({ where: { code: HIDDEN_PLAN } });
  await prisma.paymentMethod.deleteMany({ where: { code: RETIRED_METHOD } });
}

beforeAll(async () => {
  await cleanup();
  await seedWorkspace({ tenantId: TENANT_A, userId: OWNER_A, role: "owner", tenantName: "Tenant A" });
  await seedWorkspace({ tenantId: TENANT_B, userId: OWNER_B, role: "owner", tenantName: "Tenant B" });
});

afterAll(cleanup);

beforeEach(async () => {
  await prisma.tenantSubscription.deleteMany({
    where: { tenantId: { in: [TENANT_A, TENANT_B] } },
  });
});

async function pendingSubscription(tenantId: string, reference: string | null = null) {
  return prisma.tenantSubscription.create({
    data: {
      tenantId,
      planCode: "starter",
      billingCycle: "monthly",
      approvalStatus: "pending",
      paymentReference: reference,
    },
  });
}

describe("public catalogues", () => {
  it("lists plans without a session", async () => {
    const response = await request(app).get("/api/workspace/plans").expect(200);
    expect(Array.isArray(response.body.data.plans)).toBe(true);
    expect(response.body.data.plans.length).toBeGreaterThan(0);
  });

  it("never offers a plan that is inactive or not public", async () => {
    /*
     * The catalogue is what the signup form renders. An internal or retired
     * plan appearing here is a plan someone can subscribe to.
     */
    await prisma.publicSubscriptionPlanCatalog.create({
      data: { code: HIDDEN_PLAN, name: "Internal Only", isActive: true, isPublic: false },
    });

    const response = await request(app).get("/api/workspace/plans").expect(200);
    const codes = response.body.data.plans.map((p: { code: string }) => p.code);
    expect(codes).not.toContain(HIDDEN_PLAN);
  });

  it("never offers a payment method that has been switched off", async () => {
    await prisma.paymentMethod.create({
      data: { code: RETIRED_METHOD, name: "Retired Method", isActive: false },
    });

    const response = await request(app).get("/api/workspace/payment-methods").expect(200);
    const codes = response.body.data.paymentMethods.map((m: { code: string }) => m.code);
    expect(codes).not.toContain(RETIRED_METHOD);
  });
});

describe("payment reference", () => {
  it("attaches the reference to the caller's own pending subscription", async () => {
    const subscription = await pendingSubscription(TENANT_A);

    await request(app)
      .post("/api/workspace/payment-reference")
      .set("Authorization", `Bearer ${tokenFor(OWNER_A, TENANT_A)}`)
      .send({ reference: "BK-TRANSFER-9931" })
      .expect(200);

    const updated = await prisma.tenantSubscription.findUnique({ where: { id: subscription.id } });
    expect(updated?.paymentReference).toBe("BK-TRANSFER-9931");
  });

  it("cannot reach another tenant's subscription", async () => {
    /*
     * The endpoint takes no id — it resolves the subscription from the
     * caller's own token. This asserts that stays true: B posting a
     * reference must not touch A's row, even though A's is the only pending
     * one in the table at that moment.
     */
    const aSubscription = await pendingSubscription(TENANT_A, "A-ORIGINAL");

    await request(app)
      .post("/api/workspace/payment-reference")
      .set("Authorization", `Bearer ${tokenFor(OWNER_B, TENANT_B)}`)
      .send({ reference: "B-TRYING-TO-WRITE" })
      .expect(404);

    const untouched = await prisma.tenantSubscription.findUnique({
      where: { id: aSubscription.id },
    });
    expect(untouched?.paymentReference).toBe("A-ORIGINAL");
  });

  it("refuses once the subscription has been approved", async () => {
    // Nothing to attach a reference to after the decision has been made —
    // and letting it through would mean editing an approved payment record.
    await prisma.tenantSubscription.create({
      data: {
        tenantId: TENANT_A,
        planCode: "starter",
        billingCycle: "monthly",
        approvalStatus: "approved",
      },
    });

    await request(app)
      .post("/api/workspace/payment-reference")
      .set("Authorization", `Bearer ${tokenFor(OWNER_A, TENANT_A)}`)
      .send({ reference: "TOO-LATE" })
      .expect(404);
  });

  it("rejects an empty reference rather than blanking the stored one", async () => {
    const subscription = await pendingSubscription(TENANT_A, "KEEP-ME");

    await request(app)
      .post("/api/workspace/payment-reference")
      .set("Authorization", `Bearer ${tokenFor(OWNER_A, TENANT_A)}`)
      .send({ reference: "   " })
      .expect(400);

    const unchanged = await prisma.tenantSubscription.findUnique({
      where: { id: subscription.id },
    });
    expect(unchanged?.paymentReference).toBe("KEEP-ME");
  });

  it("requires a session", async () => {
    await pendingSubscription(TENANT_A);

    await request(app)
      .post("/api/workspace/payment-reference")
      .send({ reference: "NO-SESSION" })
      .expect(401);
  });

  it("takes the newest pending subscription when there is more than one", async () => {
    await pendingSubscription(TENANT_A, "OLDER");
    // Ordered by createdAt desc, so the one a person is actually paying for.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const newer = await pendingSubscription(TENANT_A, null);

    await request(app)
      .post("/api/workspace/payment-reference")
      .set("Authorization", `Bearer ${tokenFor(OWNER_A, TENANT_A)}`)
      .send({ reference: "NEWEST" })
      .expect(200);

    const updated = await prisma.tenantSubscription.findUnique({ where: { id: newer.id } });
    expect(updated?.paymentReference).toBe("NEWEST");
  });
});

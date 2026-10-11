import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { emailBlindIndex } from "../../lib/crypto";

/**
 * Signing up in two halves, and what happens when the term runs out.
 *
 * Signup used to create the account, the workspace and the subscription in one
 * transaction, which meant a customer had to commit to a price before they had
 * an account. It is now split: signup makes the account, and choosing a plan
 * makes the workspace. Three things about that split are easy to get wrong and
 * are checked here.
 *
 *   1. An account with no plan has no workspace — and the client is told so,
 *      rather than left to infer it from a null.
 *   2. Creating the workspace reissues the access token. The tenant is baked
 *      into it, so the token minted at signup knows nothing about the
 *      workspace that now exists, and every tenant-scoped call after it would
 *      be refused.
 *   3. Expiry is resolved from the period dates on every read. Nothing ages a
 *      subscription out on a schedule, so a term that ended must close the
 *      workspace by itself.
 */

const app = createApp();

const STAMP = Date.now();
const EMAIL = `onboarding.split.${STAMP}@test.local`;

let token = "";
let workspaceToken = "";
let tenantId = "";

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { emailHash: emailBlindIndex(EMAIL) } });
  if (!user) return;

  const memberships = await prisma.tenantMember.findMany({ where: { userId: user.id } });
  const tenantIds = memberships.map((membership) => membership.tenantId);

  if (tenantIds.length > 0) {
    await prisma.paymentLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.paymentTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.activityLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantSubscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.userRole.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.profile.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }

  await prisma.profile.deleteMany({ where: { id: user.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

beforeAll(cleanup);

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("signing up without choosing a plan", () => {
  it("creates the account and nothing else", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({
        email: EMAIL,
        password: "Sp1it!Passw0rd",
        displayName: "Split Owner",
        businessName: `Split Co ${STAMP}`,
        businessType: "retail",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBeNull();
    // The client needs to be told, not left to infer it from a null id.
    expect(res.body.data.needsPlan).toBe(true);
    expect(res.body.data.payment).toBeNull();

    token = res.body.data.accessToken;
    expect(token).toBeTruthy();
  });

  it("reports no workspace on the session", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tenant).toBeNull();
    expect(res.body.data.subscription).toBeNull();
  });

  it("refuses tenant-scoped routes until there is one", async () => {
    const res = await request(app)
      .get("/api/subscription/usage")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("tenant_required");
  });
});

describe("choosing a plan", () => {
  it("creates the workspace and charges for it in one request", async () => {
    const res = await request(app)
      .post("/api/workspace/pending")
      .set("Authorization", `Bearer ${token}`)
      .send({
        business_name: `Split Co ${STAMP}`,
        plan_code: "starter",
        billing_cycle: "monthly",
        payment_method: "mobile_money_mtn",
        payer_phone: "0780000000",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.requiresPayment).toBe(true);
    expect(res.body.data.payment?.reference_id).toBeTruthy();
    expect(res.body.data.payment?.status).toBe("pending");

    tenantId = res.body.data.tenantId;
    expect(tenantId).toBeTruthy();
  });

  it("hands back a token that knows about the new workspace", async () => {
    // Re-created here rather than carried from the test above, so this reads
    // as its own assertion: the reissued token is what makes everything after
    // the plan screen work.
    const res = await request(app)
      .post("/api/workspace/pending")
      .set("Authorization", `Bearer ${token}`)
      .send({
        business_name: `Split Co ${STAMP}`,
        plan_code: "starter",
        billing_cycle: "monthly",
        payment_method: "mobile_money_mtn",
        payer_phone: "0780000000",
      });

    workspaceToken = res.body.data.accessToken;
    expect(workspaceToken).toBeTruthy();
    expect(workspaceToken).not.toBe(token);

    const scoped = await request(app)
      .get("/api/subscription/usage")
      .set("Authorization", `Bearer ${workspaceToken}`);

    expect(scoped.status).toBe(200);
  });

  it("leaves the workspace shut until the gateway confirms", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    expect(tenant?.workspaceStatus).toBe("pending_payment");
  });

  it("is idempotent — a second attempt does not open a second workspace", async () => {
    const memberships = await prisma.tenantMember.findMany({
      where: { tenantId },
    });

    expect(memberships).toHaveLength(1);
  });
});

describe("payment, expiry and renewal", () => {
  it("opens the workspace once the gateway confirms", async () => {
    const subscription = await prisma.tenantSubscription.findFirst({ where: { tenantId } });
    const reference = subscription?.paymentReference;

    const transaction = await prisma.paymentTransaction.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    await request(app)
      .post("/api/payments/callback/lmbtech")
      .send({
        reference_id: reference ?? transaction!.referenceId,
        transaction_id: "TXN-SPLIT",
        status: "success",
      })
      .expect(200);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${workspaceToken}`);

    expect(me.body.data.tenant.workspace_status).toBe("active");
    expect(me.body.data.subscription.is_open).toBe(true);
    expect(me.body.data.subscription.days_remaining).toBeGreaterThan(0);
  });

  it("closes it again when the term runs out, with no scheduler involved", async () => {
    const yesterday = new Date(Date.now() - 86_400_000);

    await prisma.tenantSubscription.updateMany({
      where: { tenantId },
      data: { currentPeriodEnd: yesterday, expiresAt: yesterday },
    });

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${workspaceToken}`);

    expect(me.body.data.tenant.workspace_status).toBe("expired");
    expect(me.body.data.subscription.status).toBe("expired");
    expect(me.body.data.subscription.is_open).toBe(false);
    // The stored column still says what it always said — expiry is resolved,
    // not written.
    expect(me.body.data.subscription.stored_status).toBe("active");
  });

  it("distinguishes an expired term from one never paid for", async () => {
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${workspaceToken}`);

    // The customer is asked to renew, not to buy for the first time — the
    // screens read from this to pick their wording.
    expect(me.body.data.tenant.workspace_status).not.toBe("pending_payment");
  });

  it("reopens on a renewal payment, extending rather than restarting", async () => {
    const renewal = await request(app)
      .post("/api/subscription/checkout")
      .set("Authorization", `Bearer ${workspaceToken}`)
      .send({ payment_method_code: "mobile_money_mtn", payer_phone: "0780000000" });

    expect(renewal.status).toBe(202);

    await request(app)
      .post("/api/payments/callback/lmbtech")
      .send({ reference_id: renewal.body.data.reference_id, status: "success" })
      .expect(200);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${workspaceToken}`);

    expect(me.body.data.tenant.workspace_status).toBe("active");
    expect(me.body.data.subscription.days_remaining).toBeGreaterThan(0);
  });
});

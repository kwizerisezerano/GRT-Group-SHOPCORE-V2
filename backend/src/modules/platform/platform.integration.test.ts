import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { emailBlindIndex } from "../../lib/crypto";
import { signAccessToken } from "../../lib/jwt";
import { seedWorkspace } from "../../test/workspace";

/**
 * The platform console guard.
 *
 * These endpoints read and write across every tenant on the installation:
 * listing all workspaces, creating users inside one, approving and rejecting
 * subscriptions. The whole router sits behind a single
 * `platformRouter.use(requireAuth, requirePlatformAdmin)`.
 *
 * A blanket guard is the right shape, and also the kind that quietly stops
 * covering a route — mount one line above the `use`, or reach for a nested
 * router, and it is bypassed with nothing to show for it. So rather than test
 * the middleware in isolation, every endpoint is called as an ordinary
 * workspace owner and as a stranger, and each one has to refuse.
 *
 * `isPlatformAdmin` is read from the database per request rather than from
 * the token, so revoking it takes effect immediately — the last test holds
 * that behaviour in place.
 */

const app = createApp();

const TENANT = "e5e5e5e5-6666-4666-8666-e5e5e5e5e5e5";
const OWNER = "e5e5e5e5-6666-4666-8666-000000000001";
const ADMIN = "e5e5e5e5-6666-4666-8666-000000000002";

const tokenFor = (userId: string) =>
  signAccessToken({ sub: userId, tenantId: TENANT, role: "owner" });

/** Every route the platform console exposes, with a harmless payload. */
const ENDPOINTS: Array<{ method: "get" | "post"; path: string; body?: unknown }> = [
  { method: "get", path: "/api/platform/tenants" },
  { method: "get", path: "/api/platform/subscriptions" },
  {
    method: "post",
    path: `/api/platform/tenants/${TENANT}/users`,
    body: { email: "should-never-exist@test.local", displayName: "Nope", role: "cashier" },
  },
  { method: "post", path: "/api/platform/subscriptions/00000000-0000-4000-8000-000000000000/approve" },
  {
    method: "post",
    path: "/api/platform/subscriptions/00000000-0000-4000-8000-000000000000/reject",
    body: { reason: "no" },
  },

  /*
   * The commercial console's own routes. They live in nested routers mounted
   * below the guard, which is exactly the arrangement the comment above warns
   * can silently stop being covered - so each one is listed here and has to
   * refuse an ordinary account like everything else.
   */
  { method: "get", path: "/api/platform/plans" },
  { method: "get", path: "/api/platform/plans/capacity-keys" },
  {
    method: "post",
    path: "/api/platform/plans",
    body: { code: "should_never_exist", name: "Nope", prices: [] },
  },
  { method: "get", path: "/api/platform/organizations" },
  {
    method: "post",
    path: "/api/platform/organizations",
    body: {
      business_name: "Nope",
      owner_email: "should-never-exist@test.local",
      owner_name: "Nope",
      plan_code: "starter",
      billing_cycle: "monthly",
    },
  },
  { method: "get", path: "/api/platform/payments" },
  { method: "get", path: "/api/platform/payment-logs" },
  { method: "get", path: "/api/platform/overview" },
];

async function cleanup() {
  await prisma.activityLog.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenant.deleteMany({ where: { id: TENANT } });
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, ADMIN] } } });
}

beforeAll(async () => {
  await cleanup();
  await seedWorkspace({ tenantId: TENANT, userId: OWNER, role: "owner", tenantName: "Guarded" });
  await seedWorkspace({ tenantId: TENANT, userId: ADMIN, role: "admin", tenantName: "Guarded" });
});

afterAll(cleanup);

describe("platform console is closed to ordinary accounts", () => {
  it.each(ENDPOINTS)("refuses $method $path without a session", async ({ method, path, body }) => {
    const call = request(app)[method](path);
    if (body) call.send(body);
    await call.expect(401);
  });

  it.each(ENDPOINTS)(
    "refuses $method $path for a workspace owner",
    async ({ method, path, body }) => {
      /*
       * Owner is the highest role inside a workspace, which makes it the
       * right account to prove the boundary with: being in charge of your own
       * tenant must grant nothing across the others.
       */
      const call = request(app)[method](path).set("Authorization", `Bearer ${tokenFor(OWNER)}`);
      if (body) call.send(body);
      await call.expect(403);
    },
  );

  it("refuses a workspace admin as well", async () => {
    await request(app)
      .get("/api/platform/tenants")
      .set("Authorization", `Bearer ${tokenFor(ADMIN)}`)
      .expect(403);
  });

  it("creates nothing while refusing", async () => {
    /*
     * The refused calls above tried to create this member. A 403 that had
     * already written the row would be worse than no guard at all — the
     * account would exist, unlisted, with a password nobody was sent.
     */
    const ghost = await prisma.user.findFirst({
      where: { emailHash: emailBlindIndex("should-never-exist@test.local") },
    });
    expect(ghost).toBeNull();
  });

  it("lets a platform admin through, and refuses again the moment the flag is revoked", async () => {
    await prisma.user.update({ where: { id: OWNER }, data: { isPlatformAdmin: true } });

    await request(app)
      .get("/api/platform/tenants")
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`)
      .expect(200);

    /*
     * The same token, still perfectly valid and unexpired. Because the flag
     * is read per request rather than carried in the JWT, revoking it takes
     * effect on the very next call instead of whenever the token happens to
     * run out.
     */
    await prisma.user.update({ where: { id: OWNER }, data: { isPlatformAdmin: false } });

    await request(app)
      .get("/api/platform/tenants")
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`)
      .expect(403);
  });
});

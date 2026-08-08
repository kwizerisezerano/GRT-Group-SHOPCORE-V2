import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { signAccessToken } from "../../lib/jwt";
import type { Role } from "../../lib/permissions";
import { seedWorkspace } from "../../test/workspace";

/**
 * Roles used to be a label: `requireAuth` read one off the token and nothing
 * ever looked at it, so every member of a workspace could call every endpoint.
 * These tests are about the two things that had to become true — that a role
 * actually limits what you can do, and that changing roles cannot be used to
 * take over the workspace.
 */

const app = createApp();

const TENANT = "f0f0f0f0-1111-4111-8111-f0f0f0f0f0f0";
const OWNER = "f0f0f0f0-1111-4111-8111-000000000001";
const ADMIN = "f0f0f0f0-1111-4111-8111-000000000002";
const MANAGER = "f0f0f0f0-1111-4111-8111-000000000003";
const CASHIER = "f0f0f0f0-1111-4111-8111-000000000004";
const ACCOUNTANT = "f0f0f0f0-1111-4111-8111-000000000005";
const OUTSIDER = "f0f0f0f0-1111-4111-8111-000000000009";

const tokenFor = (userId: string) =>
  signAccessToken({ sub: userId, tenantId: TENANT, role: "owner" });

const as = (userId: string, r: request.Test) =>
  r.set("Authorization", `Bearer ${tokenFor(userId)}`);

async function cleanup() {
  await prisma.activityLog.deleteMany({ where: { tenantId: TENANT } });
  await prisma.rolePermission.deleteMany({ where: { tenantId: TENANT } });
  await prisma.userInvite.deleteMany({ where: { tenantId: TENANT } });
  await prisma.stockMovement.deleteMany({ where: { tenantId: TENANT } });
  await prisma.saleItem.deleteMany({ where: { tenantId: TENANT } });
  await prisma.sale.deleteMany({ where: { tenantId: TENANT } });
  await prisma.purchaseItem.deleteMany({ where: { tenantId: TENANT } });
  await prisma.purchase.deleteMany({ where: { tenantId: TENANT } });
  await prisma.invoiceCounter.deleteMany({ where: { tenantId: TENANT } });
  await prisma.product.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenant.deleteMany({ where: { id: TENANT } });
  await prisma.user.deleteMany({
    where: { id: { in: [OWNER, ADMIN, MANAGER, CASHIER, ACCOUNTANT, OUTSIDER] } },
  });
}

async function member(userId: string, role: Role) {
  await seedWorkspace({ tenantId: TENANT, userId, role, tenantName: "Roles Workspace" });
}

beforeAll(async () => {
  await cleanup();
  await member(OWNER, "owner");
  await member(ADMIN, "admin");
  await member(MANAGER, "manager");
  await member(CASHIER, "cashier");
  await member(ACCOUNTANT, "accountant");
});

beforeEach(async () => {
  // Each test starts from the shipped defaults, not another test's overrides.
  await prisma.rolePermission.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenantMember.updateMany({ where: { tenantId: TENANT, userId: CASHIER }, data: { role: "cashier" } });
  await prisma.tenantMember.updateMany({ where: { tenantId: TENANT, userId: MANAGER }, data: { role: "manager" } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("a role actually limits what you can do", () => {
  it("lets a cashier record a sale", async () => {
    const product = await prisma.product.create({
      data: { tenantId: TENANT, name: "Cashier Sellable", sellingPrice: 500, stockQuantity: 10, stock: 10 },
    });

    const res = await as(CASHIER, request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
    });

    expect(res.status).toBe(201);
  });

  it("refuses to let a cashier delete a product", async () => {
    /*
     * The headline of this whole change. Before enforcement existed this
     * returned 200 and the product was gone — the UI hid the button, which is
     * worth doing and is not security.
     */
    const product = await prisma.product.create({
      data: { tenantId: TENANT, name: "Not Yours To Delete", sellingPrice: 100, stockQuantity: 1, stock: 1 },
    });

    const res = await as(CASHIER, request(app).delete(`/api/products/${product.id}`));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("missing_permission");
    // The refusal names what was needed, so the cashier can ask the right
    // person for the right thing instead of filing "it doesn't work".
    expect(res.body.error.details.missing).toContain("products.delete");
    expect(res.body.message).toContain("products.delete");

    expect(await prisma.product.findUnique({ where: { id: product.id } })).not.toBeNull();
  });

  it("refuses to let a cashier receive stock", async () => {
    const product = await prisma.product.create({
      data: { tenantId: TENANT, name: "Cashier Receipt", sellingPrice: 100, stockQuantity: 0, stock: 0 },
    });

    const res = await as(CASHIER, request(app).post("/api/purchases")).send({
      items: [{ product_id: product.id, quantity: 50 }],
    });

    expect(res.status).toBe(403);
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toMatchObject({
      stockQuantity: 0,
    });
  });

  it("lets an accountant read but not change expenses' surroundings", async () => {
    const canRead = await as(ACCOUNTANT, request(app).get("/api/expenses"));
    expect(canRead.status).toBe(200);

    const cannotWrite = await as(ACCOUNTANT, request(app).post("/api/products")).send({
      name: "Accountant Product",
      selling_price: 100,
    });
    expect(cannotWrite.status).toBe(403);
  });

  it("gives someone who is not a member of the workspace nothing at all", async () => {
    // Fails closed. A token that looks right but has no membership behind it
    // is treated as having no permissions, not as having defaults.
    const res = await as(OUTSIDER, request(app).get("/api/products"));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("missing_permission");
  });

  it("takes a demotion into effect on the very next request", async () => {
    /*
     * Why the role is read from the database rather than the token. The token
     * below still says "owner" and always will until it expires — if authority
     * came from it, removing someone's powers would not remove them during
     * exactly the window in which that matters most.
     */
    const before = await as(MANAGER, request(app).get("/api/purchases"));
    expect(before.status).toBe(200);

    await prisma.tenantMember.updateMany({
      where: { tenantId: TENANT, userId: MANAGER },
      data: { role: "sales_staff" },
    });

    const after = await as(MANAGER, request(app).get("/api/purchases"));
    expect(after.status).toBe(403);
  });
});

describe("changing roles cannot be used to take over the workspace", () => {
  it("refuses to let anyone change their own role", async () => {
    const res = await as(ADMIN, request(app).patch(`/api/users/members/${ADMIN}/role`)).send({
      role: "owner",
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("cannot_change_own_role");
  });

  it("refuses to let an admin mint an owner", async () => {
    // You may not create a peer or a superior — that is how a workspace gets
    // taken over by someone who was only ever meant to help run it.
    const res = await as(ADMIN, request(app).patch(`/api/users/members/${CASHIER}/role`)).send({
      role: "owner",
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("role_above_yours");
  });

  it("refuses to let an admin demote a fellow admin", async () => {
    const peer = "f0f0f0f0-1111-4111-8111-00000000000a";
    await member(peer, "admin");

    const res = await as(ADMIN, request(app).patch(`/api/users/members/${peer}/role`)).send({
      role: "cashier",
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("target_outranks_you");

    await prisma.tenantMember.deleteMany({ where: { tenantId: TENANT, userId: peer } });
    await prisma.user.deleteMany({ where: { id: peer } });
  });

  it("lets an admin promote a cashier to accountant", async () => {
    const res = await as(ADMIN, request(app).patch(`/api/users/members/${CASHIER}/role`)).send({
      role: "accountant",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("accountant");
  });

  it("refuses to let a manager touch user management at all", async () => {
    const res = await as(MANAGER, request(app).get("/api/users/members"));
    expect(res.status).toBe(403);
  });

  it("will not leave a workspace without an owner", async () => {
    const res = await as(OWNER, request(app).patch(`/api/users/members/${OWNER}/role`)).send({
      role: "admin",
    });

    // Caught by the self-change rule first, which is the stricter of the two
    // and gets there first — either way the last owner survives.
    expect(res.status).toBe(403);
    expect(await prisma.tenantMember.count({ where: { tenantId: TENANT, role: "owner" } })).toBe(1);
  });

  it("records every authority change in the activity log", async () => {
    await as(ADMIN, request(app).patch(`/api/users/members/${CASHIER}/role`)).send({
      role: "sales_staff",
    });

    const logged = await prisma.activityLog.findFirst({
      where: { tenantId: TENANT, action: "role_changed", targetId: CASHIER },
      orderBy: { createdAt: "desc" },
    });

    expect(logged).toMatchObject({ userId: ADMIN, module: "users" });
    expect(logged?.metadata).toMatchObject({ to: "sales_staff" });
  });
});

describe("a workspace can shape its own roles", () => {
  it("grants a permission the default does not include", async () => {
    const product = await prisma.product.create({
      data: { tenantId: TENANT, name: "Granted Delete", sellingPrice: 100, stockQuantity: 1, stock: 1 },
    });

    const denied = await as(CASHIER, request(app).delete(`/api/products/${product.id}`));
    expect(denied.status).toBe(403);

    await as(OWNER, request(app).put("/api/users/permissions")).send({
      role: "cashier",
      permission: "products.delete",
      granted: true,
    });

    const allowed = await as(CASHIER, request(app).delete(`/api/products/${product.id}`));
    expect(allowed.status).toBe(200);
  });

  it("revokes a permission the default does include", async () => {
    await as(OWNER, request(app).put("/api/users/permissions")).send({
      role: "cashier",
      permission: "sales.create",
      granted: false,
    });

    const product = await prisma.product.create({
      data: { tenantId: TENANT, name: "Revoked Sale", sellingPrice: 100, stockQuantity: 5, stock: 5 },
    });

    const res = await as(CASHIER, request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
    });

    expect(res.status).toBe(403);
  });

  it("stores only the difference, so resetting removes the row", async () => {
    /*
     * Setting a permission back to what the default already says is not a
     * customisation. Storing it would freeze that role against future changes
     * to the defaults, which is the opposite of what "reset" means.
     */
    await as(OWNER, request(app).put("/api/users/permissions")).send({
      role: "cashier",
      permission: "products.delete",
      granted: true,
    });
    expect(
      await prisma.rolePermission.count({ where: { tenantId: TENANT, role: "cashier" } })
    ).toBe(1);

    await as(OWNER, request(app).put("/api/users/permissions")).send({
      role: "cashier",
      permission: "products.delete",
      granted: false,
    });
    expect(
      await prisma.rolePermission.count({ where: { tenantId: TENANT, role: "cashier" } })
    ).toBe(0);
  });

  it("refuses to let anyone edit a role at or above their own", async () => {
    // Otherwise "manage permissions" is a way to grant yourself anything.
    const res = await as(ADMIN, request(app).put("/api/users/permissions")).send({
      role: "admin",
      permission: "settings.billing",
      granted: true,
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("role_above_yours");
  });

  it("answers with the whole matrix, not just the differences", async () => {
    const res = await as(OWNER, request(app).get("/api/users/permissions"));

    expect(res.status).toBe(200);
    expect(res.body.data.catalogue.length).toBeGreaterThan(30);

    const cashier = res.body.data.roles.find((r: { role: string }) => r.role === "cashier");
    expect(cashier.effective).toContain("pos.use");
    expect(cashier.effective).not.toContain("products.delete");
  });
});

describe("invitations", () => {
  it("returns the token exactly once and stores only its hash", async () => {
    const res = await as(OWNER, request(app).post("/api/users/invites")).send({
      email: "new.cashier@shopcore.local",
      role: "cashier",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();

    const stored = await prisma.userInvite.findFirst({
      where: { tenantId: TENANT },
      orderBy: { createdAt: "desc" },
    });

    // An invite link is a credential until it is used: a leaked database must
    // not be turnable into workspace access.
    expect(stored?.tokenHash).not.toBe(res.body.data.token);
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    // Nor is the address readable at rest.
    expect(stored?.emailEncrypted).toMatch(/^v1\./);
    expect(stored?.emailEncrypted).not.toContain("new.cashier");

    // And listing never hands the token back.
    const list = await as(OWNER, request(app).get("/api/users/invites"));
    expect(JSON.stringify(list.body)).not.toContain(res.body.data.token);
  });

  it("refuses a second live invitation for the same address", async () => {
    await as(OWNER, request(app).post("/api/users/invites")).send({
      email: "dup@shopcore.local",
      role: "cashier",
    });

    const again = await as(OWNER, request(app).post("/api/users/invites")).send({
      email: "dup@shopcore.local",
      role: "cashier",
    });

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("invite_pending");
  });

  it("refuses to invite someone into a role above the inviter's", async () => {
    const res = await as(ADMIN, request(app).post("/api/users/invites")).send({
      email: "would.be.owner@shopcore.local",
      role: "owner",
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("role_above_yours");
  });

  it("refuses to invite someone who is already a member", async () => {
    const res = await as(OWNER, request(app).post("/api/users/invites")).send({
      email: `${CASHIER}@test.local`,
      role: "cashier",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_member");
  });
});

describe("telling the client what it may do", () => {
  it("answers with the same permissions the server will enforce", async () => {
    // The client hides what would be refused. If this answer and the guard
    // ever disagree, the UI is lying — so both read the same resolver.
    const res = await as(CASHIER, request(app).get("/api/users/me/permissions"));

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("cashier");
    expect(res.body.data.permissions).toContain("pos.use");
    expect(res.body.data.permissions).not.toContain("products.delete");
  });

  it("reflects a workspace's own overrides", async () => {
    await as(OWNER, request(app).put("/api/users/permissions")).send({
      role: "cashier",
      permission: "reports.viewProfit",
      granted: true,
    });

    const res = await as(CASHIER, request(app).get("/api/users/me/permissions"));
    expect(res.body.data.permissions).toContain("reports.viewProfit");
  });
});

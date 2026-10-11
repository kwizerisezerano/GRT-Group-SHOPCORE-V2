import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { signAccessToken } from "../../lib/jwt";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type Role,
} from "../../lib/permissions";
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
  await prisma.branch.deleteMany({ where: { tenantId: TENANT } });
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
  await prisma.tenantMember.updateMany({
    where: { tenantId: TENANT },
    data: { branchId: null, department: null, status: "active" },
  });
  await prisma.branch.deleteMany({ where: { tenantId: TENANT } });
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

/**
 * Setting a whole role in one request.
 *
 * The editor has a switch per permission and there are well over a hundred of
 * them, so "give this role everything" or "take it all away" cannot be a loop
 * of single-permission calls: too slow to look like it is working, and not
 * atomic, so a dropped connection leaves the role holding an arbitrary half of
 * the change with nothing on screen to say which half.
 */
describe("setting a whole role at once", () => {
  const bulk = (actor: string, body: Record<string, unknown>) =>
    as(actor, request(app).put("/api/users/permissions/bulk")).send(body);

  const permissionsOf = async (userId: string) =>
    (await as(userId, request(app).get("/api/users/me/permissions"))).body.data
      .permissions as string[];

  it("grants every permission the application has", async () => {
    const res = await bulk(OWNER, { role: "cashier", mode: "grant_all" });

    expect(res.status).toBe(200);
    expect(res.body.data.effective).toEqual([...ALL_PERMISSIONS].sort());

    // And the member actually has them, not just the response.
    const mine = await permissionsOf(CASHIER);
    expect(mine).toContain("products.delete");
    expect(mine).toContain("reports.viewProfit");
    expect(mine).toContain("settings.billing");
  });

  it("takes every permission away", async () => {
    const res = await bulk(OWNER, { role: "cashier", mode: "revoke_all" });

    expect(res.status).toBe(200);
    expect(res.body.data.effective).toEqual([]);
    expect(await permissionsOf(CASHIER)).toEqual([]);

    // A role holding nothing is refused, not silently allowed through.
    const denied = await as(CASHIER, request(app).get("/api/sales"));
    expect(denied.status).toBe(403);
  });

  it("puts a role back on its defaults and stores no rows doing it", async () => {
    await bulk(OWNER, { role: "cashier", mode: "grant_all" });
    expect(
      await prisma.rolePermission.count({ where: { tenantId: TENANT, role: "cashier" } })
    ).toBeGreaterThan(0);

    const res = await bulk(OWNER, { role: "cashier", mode: "defaults" });

    expect(res.status).toBe(200);
    /*
     * The row count is the point, not the permission list. Writing today's
     * defaults in as rows would resolve to the same answer today and freeze
     * the role out of every module released afterwards — which is the exact
     * failure the override model exists to avoid.
     */
    expect(
      await prisma.rolePermission.count({ where: { tenantId: TENANT, role: "cashier" } })
    ).toBe(0);
    expect(await permissionsOf(CASHIER)).toEqual([...DEFAULT_ROLE_PERMISSIONS.cashier].sort());
  });

  it("stores only the difference from the defaults", async () => {
    await bulk(OWNER, { role: "cashier", mode: "grant_all" });

    const rows = await prisma.rolePermission.findMany({
      where: { tenantId: TENANT, role: "cashier" },
    });

    expect(rows.length).toBe(ALL_PERMISSIONS.length - DEFAULT_ROLE_PERMISSIONS.cashier.length);
    expect(rows.every((row) => row.granted)).toBe(true);
    for (const row of rows) {
      expect(DEFAULT_ROLE_PERMISSIONS.cashier).not.toContain(row.permission);
    }
  });

  it("sets an exact list, replacing whatever was there before", async () => {
    await bulk(OWNER, { role: "cashier", mode: "grant_all" });

    const res = await bulk(OWNER, {
      role: "cashier",
      mode: "set",
      permissions: ["dashboard.view", "pos.use", "sales.view"],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.effective).toEqual(["dashboard.view", "pos.use", "sales.view"]);

    /*
     * Replace, not merge. If any part of the earlier grant-all survived, the
     * button labelled "these three" would mean "these three plus a hundred
     * others" — the kind of thing nobody notices until an audit.
     */
    expect(await permissionsOf(CASHIER)).toEqual(["dashboard.view", "pos.use", "sales.view"]);
  });

  it("ignores permissions the application does not recognise", async () => {
    const res = await bulk(OWNER, {
      role: "cashier",
      mode: "set",
      permissions: ["pos.use", "sales.deleteEverything", "pos.view"],
    });

    expect(res.status).toBe(200);
    // pos.view is one of the dead entries removed from the catalogue; a client
    // on an older build must not be able to plant a row for it.
    expect(res.body.data.effective).toEqual(["pos.use"]);
  });

  it("refuses a role at or above the caller own rank", async () => {
    // Otherwise "grant everything to my own role" is a single request.
    const own = await bulk(ADMIN, { role: "admin", mode: "grant_all" });
    expect(own.status).toBe(403);
    expect(own.body.error.code).toBe("role_above_yours");

    const above = await bulk(ADMIN, { role: "owner", mode: "revoke_all" });
    expect(above.status).toBe(403);

    // Including an owner on the owner role: owner means every permission, and
    // nothing may edit that.
    const ownerOnOwner = await bulk(OWNER, { role: "owner", mode: "revoke_all" });
    expect(ownerOnOwner.status).toBe(403);
  });

  it("refuses a caller without users.managePermissions", async () => {
    const res = await bulk(MANAGER, { role: "cashier", mode: "revoke_all" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("missing_permission");
  });

  it("refuses a request that says neither a mode nor a list", async () => {
    const res = await bulk(OWNER, { role: "cashier" });
    expect(res.status).toBe(400);
  });

  it("writes one activity log entry, not one per permission", async () => {
    await prisma.activityLog.deleteMany({ where: { tenantId: TENANT } });
    await bulk(OWNER, { role: "cashier", mode: "revoke_all" });

    const logged = await prisma.activityLog.findMany({
      where: { tenantId: TENANT, action: "permissions_bulk_set" },
    });

    expect(logged.length).toBe(1);
    expect(logged[0].metadata).toMatchObject({ role: "cashier", mode: "revoke_all" });
  });
});

/**
 * The screens whose switches used to decide nothing.
 *
 * Categories, brands and units each have four permissions in the editor, and
 * each was enforced against products.*. So revoking categories.delete left the
 * delete working, and granting it to a role without products.delete still
 * refused — a switch that moves and changes nothing, which is worse than no
 * switch at all because the person using it has every reason to believe it.
 */
describe("catalogue modules are enforced by their own permissions", () => {
  it("refuses a category delete when categories.delete is revoked", async () => {
    const category = await prisma.category.create({
      data: { tenantId: TENANT, name: "Doomed Category" },
    });

    // A manager holds categories.delete by default.
    await as(OWNER, request(app).put("/api/users/permissions")).send({
      role: "manager",
      permission: "categories.delete",
      granted: false,
    });

    const denied = await as(MANAGER, request(app).delete(`/api/categories/${category.id}`));
    expect(denied.status).toBe(403);
    expect(denied.body.error.details.missing).toEqual(["categories.delete"]);

    // Still holding products.delete is not enough, which is the whole point.
    const perms = await as(MANAGER, request(app).get("/api/users/me/permissions"));
    expect(perms.body.data.permissions).toContain("products.delete");
  });

  it("lets a role create categories without letting it create products", async () => {
    await as(OWNER, request(app).put("/api/users/permissions")).send({
      role: "cashier",
      permission: "products.create",
      granted: false,
    });

    // A cashier keeps categories.create by default.
    const category = await as(CASHIER, request(app).post("/api/categories")).send({
      name: "Cashier Made This",
    });
    expect(category.status).toBe(201);

    const product = await as(CASHIER, request(app).post("/api/products")).send({
      name: "Should Be Refused",
      selling_price: 100,
    });
    expect(product.status).toBe(403);
  });

  it("enforces units against units.*", async () => {
    await as(OWNER, request(app).put("/api/users/permissions")).send({
      role: "cashier",
      permission: "units.create",
      granted: false,
    });

    const denied = await as(CASHIER, request(app).post("/api/units")).send({ name: "Crate" });
    expect(denied.status).toBe(403);
    expect(denied.body.error.details.missing).toEqual(["units.create"]);
  });
});

/**
 * What an owner does on the permission screen is what the member sees when
 * they next sign in. That is the promise the screen makes, so it is tested
 * through the session endpoint rather than only through the permission one.
 */
describe("a permission change reaches the member next session", () => {
  it("carries the workspace overrides in the session payload", async () => {
    await as(OWNER, request(app).put("/api/users/permissions/bulk")).send({
      role: "cashier",
      mode: "set",
      permissions: ["dashboard.view", "pos.use", "sales.create", "reports.viewProfit"],
    });

    /*
     * /auth/me is what the client calls on load, and its answer seeds the
     * sidebar and the route guard. If it disagreed with requirePermission, the
     * menu would be a lie in one direction or the other — a button that 403s,
     * or a screen hidden from someone entitled to it. Both come from the same
     * resolver, and this is the test that says so.
     */
    const me = await as(CASHIER, request(app).get("/api/auth/me"));

    expect(me.status).toBe(200);
    expect(me.body.data.permissions).toEqual([
      "dashboard.view",
      "pos.use",
      "reports.viewProfit",
      "sales.create",
    ]);

    // And the guard agrees with what the session was told.
    expect((await as(CASHIER, request(app).get("/api/sales"))).status).toBe(403);
    expect((await as(CASHIER, request(app).get("/api/products"))).status).toBe(403);
  });

  it("takes effect on the very next request, without a new token", async () => {
    /*
     * The token is minted once and lives for its full lifetime. If authority
     * were read from it, an owner revoking access would not actually revoke
     * anything until it expired — which is exactly the window in which it
     * matters most.
     */
    expect((await as(CASHIER, request(app).get("/api/sales"))).status).toBe(200);

    await as(OWNER, request(app).put("/api/users/permissions/bulk")).send({
      role: "cashier",
      mode: "revoke_all",
    });

    expect((await as(CASHIER, request(app).get("/api/sales"))).status).toBe(403);
  });

  it("gives a suspended member nothing, whatever their role holds", async () => {
    await as(OWNER, request(app).put("/api/users/permissions/bulk")).send({
      role: "cashier",
      mode: "grant_all",
    });

    await prisma.tenantMember.updateMany({
      where: { tenantId: TENANT, userId: CASHIER },
      data: { status: "suspended" },
    });

    const me = await as(CASHIER, request(app).get("/api/auth/me"));
    expect(me.body.data.permissions).toEqual([]);

    const denied = await as(CASHIER, request(app).get("/api/sales"));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("membership_suspended");
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
    expect(res.body.data.permissions).toContain("products.create");
    expect(res.body.data.permissions).toContain("products.update");
    expect(res.body.data.permissions).toContain("inventory.adjust");
    expect(res.body.data.permissions).toContain("inventory.count");
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

/**
 * Where someone works, and whether their membership is live.
 *
 * All three of these fields were offered by the admin screen and stored by
 * nothing: it wrote them to Supabase, against columns this database did not
 * have. So these tests are as much about the write landing at all as they are
 * about the rules around it.
 */
describe("member postings", () => {
  const branchNamed = async (name: string) =>
    prisma.branch.create({ data: { tenantId: TENANT, name } });

  it("posts a member to a branch and shows it on the member list", async () => {
    const branch = await branchNamed("Kicukiro");

    const res = await as(OWNER, request(app).patch(`/api/users/members/${CASHIER}/profile`)).send({
      branch_id: branch.id,
      department: "Front of house",
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      branch_id: branch.id,
      branch_name: "Kicukiro",
      department: "Front of house",
    });

    const members = await as(OWNER, request(app).get("/api/users/members"));
    const cashier = members.body.data.find((m: { user_id: string }) => m.user_id === CASHIER);
    expect(cashier).toMatchObject({ branch_name: "Kicukiro", department: "Front of house" });

    // And it is actually in the database, which is the part that never worked.
    const stored = await prisma.tenantMember.findFirstOrThrow({
      where: { tenantId: TENANT, userId: CASHIER },
    });
    expect(stored.branchId).toBe(branch.id);
  });

  it('treats "all" as workspace-wide rather than a branch id', async () => {
    const branch = await branchNamed("Remera");
    await as(OWNER, request(app).patch(`/api/users/members/${CASHIER}/profile`)).send({
      branch_id: branch.id,
    });

    const res = await as(OWNER, request(app).patch(`/api/users/members/${CASHIER}/profile`)).send({
      branch_id: "all",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.branch_id).toBeNull();
  });

  it("refuses a branch belonging to another workspace", async () => {
    const otherTenant = "f0f0f0f0-1111-4111-8111-0000000000ff";
    const otherUser = "f0f0f0f0-1111-4111-8111-0000000000fe";
    await seedWorkspace({ tenantId: otherTenant, userId: otherUser, role: "owner" });
    const foreign = await prisma.branch.create({
      data: { tenantId: otherTenant, name: "Somebody Else's Shop" },
    });

    try {
      const res = await as(OWNER, request(app).patch(`/api/users/members/${CASHIER}/profile`)).send({
        branch_id: foreign.id,
      });

      expect(res.status).toBe(404);
      const stored = await prisma.tenantMember.findFirstOrThrow({
        where: { tenantId: TENANT, userId: CASHIER },
      });
      expect(stored.branchId).toBeNull();
    } finally {
      await prisma.branch.deleteMany({ where: { tenantId: otherTenant } });
      await prisma.tenantMember.deleteMany({ where: { tenantId: otherTenant } });
      await prisma.tenant.deleteMany({ where: { id: otherTenant } });
      await prisma.user.deleteMany({ where: { id: otherUser } });
    }
  });

  it("will not let an admin post someone who outranks them", async () => {
    const res = await as(ADMIN, request(app).patch(`/api/users/members/${OWNER}/profile`)).send({
      department: "Nowhere",
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("target_outranks_you");
  });

  it("lets you set your own branch and department, but not suspend yourself", async () => {
    const branch = await branchNamed("Head Office");

    const allowed = await as(ADMIN, request(app).patch(`/api/users/members/${ADMIN}/profile`)).send({
      branch_id: branch.id,
      department: "Operations",
    });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.department).toBe("Operations");

    const refused = await as(ADMIN, request(app).patch(`/api/users/members/${ADMIN}/profile`)).send({
      status: "suspended",
    });
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe("cannot_suspend_self");
  });

  /*
   * An owner cannot be suspended by anyone, including another owner: `outranks`
   * is strictly greater, and nothing ranks above owner. That is stronger than a
   * last-owner count, and it is why this endpoint has no such count where the
   * role and removal endpoints do.
   */
  it("never lets an owner be suspended, even by another owner", async () => {
    const secondOwner = "f0f0f0f0-1111-4111-8111-00000000000a";
    await member(secondOwner, "owner");

    try {
      const res = await as(secondOwner, request(app).patch(`/api/users/members/${OWNER}/profile`))
        .send({ status: "suspended" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("target_outranks_you");

      const stored = await prisma.tenantMember.findFirstOrThrow({
        where: { tenantId: TENANT, userId: OWNER },
      });
      expect(stored.status).toBe("active");
    } finally {
      await prisma.tenantMember.deleteMany({ where: { tenantId: TENANT, userId: secondOwner } });
      await prisma.user.deleteMany({ where: { id: secondOwner } });
    }
  });

  /*
   * The half that matters. A status column nothing enforces is decoration —
   * exactly the bug this whole endpoint exists to fix — so suspension is
   * checked where every guarded request already passes, and it takes effect on
   * the very next one rather than whenever a token happens to expire.
   */
  it("stops a suspended member acting, on the very next request", async () => {
    const before = await as(CASHIER, request(app).get("/api/products"));
    expect(before.status).toBe(200);

    await as(OWNER, request(app).patch(`/api/users/members/${CASHIER}/profile`)).send({
      status: "suspended",
    });

    const after = await as(CASHIER, request(app).get("/api/products"));
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe("membership_suspended");

    // Reinstating restores them just as immediately.
    await as(OWNER, request(app).patch(`/api/users/members/${CASHIER}/profile`)).send({
      status: "active",
    });
    expect((await as(CASHIER, request(app).get("/api/products"))).status).toBe(200);
  });

  it("records the posting change in the activity log", async () => {
    await as(OWNER, request(app).patch(`/api/users/members/${CASHIER}/profile`)).send({
      department: "Stockroom",
    });

    const log = await prisma.activityLog.findFirst({
      where: { tenantId: TENANT, action: "member_profile_updated", targetId: CASHIER },
      orderBy: { createdAt: "desc" },
    });

    expect(log).not.toBeNull();
  });
});

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { signAccessToken } from "../../lib/jwt";
import { seedWorkspace } from "../../test/workspace";

/**
 * Branches.
 *
 * The interesting part is `is_default` — the one rule MySQL cannot enforce for
 * us — so most of what follows is about that flag holding under ordinary use,
 * under concurrency, and across tenants. The plain CRUD is covered too, but
 * briefly: it is the same shape the factory already proves elsewhere.
 */

const app = createApp();

const TENANT = "b1b1b1b1-4444-4444-8444-b1b1b1b1b1b1";
const USER = "b1b1b1b1-4444-4444-8444-c1c1c1c1c1c1";
const OTHER_TENANT = "b2b2b2b2-4444-4444-8444-b2b2b2b2b2b2";
const OTHER_USER = "b2b2b2b2-4444-4444-8444-c2c2c2c2c2c2";
const CASHIER = "b3b3b3b3-4444-4444-8444-c3c3c3c3c3c3";

const token = signAccessToken({ sub: USER, tenantId: TENANT, role: "owner" });
const otherToken = signAccessToken({ sub: OTHER_USER, tenantId: OTHER_TENANT, role: "owner" });
const cashierToken = signAccessToken({ sub: CASHIER, tenantId: TENANT, role: "cashier" });

const as = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);
const asOther = (r: request.Test) => r.set("Authorization", `Bearer ${otherToken}`);
const asCashier = (r: request.Test) => r.set("Authorization", `Bearer ${cashierToken}`);

async function clearBranches() {
  await prisma.branch.deleteMany({ where: { tenantId: { in: [TENANT, OTHER_TENANT] } } });
}

async function cleanup() {
  await clearBranches();
  await prisma.tenantMember.deleteMany({ where: { tenantId: { in: [TENANT, OTHER_TENANT] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [TENANT, OTHER_TENANT] } } });
  await prisma.user.deleteMany({ where: { id: { in: [USER, OTHER_USER, CASHIER] } } });
}

beforeAll(async () => {
  await cleanup();
  await seedWorkspace({ tenantId: TENANT, userId: USER, role: "owner" });
  await seedWorkspace({ tenantId: OTHER_TENANT, userId: OTHER_USER, role: "owner" });
  // Same workspace, lesser role — seedWorkspace upserts the tenant, so this
  // adds a second member rather than a second workspace.
  await seedWorkspace({ tenantId: TENANT, userId: CASHIER, role: "cashier" });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(clearBranches);

const create = (body: Record<string, unknown>) => as(request(app).post("/api/branches")).send(body);

describe("branches", () => {
  it("stores contact details encrypted and returns them decrypted", async () => {
    const res = await create({
      name: "Kigali Main",
      code: "KGL-01",
      manager: "Aline",
      phone: "0788123456",
      email: "kigali@example.test",
      city: "Kigali",
      opening_date: "2026-01-15",
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "Kigali Main",
      code: "KGL-01",
      phone: "0788123456",
      email: "kigali@example.test",
      city: "Kigali",
    });

    // The wire shape carries no ciphertext and no `*_encrypted` columns.
    expect(res.body.data.phone_encrypted).toBeUndefined();
    expect(res.body.data.email_encrypted).toBeUndefined();

    const stored = await prisma.branch.findFirstOrThrow({ where: { tenantId: TENANT } });
    expect(stored.phoneEncrypted).toMatch(/^v1\./);
    expect(stored.phoneEncrypted).not.toContain("0788123456");
    expect(stored.emailEncrypted).not.toContain("kigali@example.test");
  });

  it("refuses a duplicate name within the workspace but not across workspaces", async () => {
    expect((await create({ name: "Nyabugogo" })).status).toBe(201);

    const duplicate = await create({ name: "Nyabugogo" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.details.fields).toEqual(["name"]);

    // Another workspace's identical name is not a conflict; it is a different
    // company's shop that happens to share a district.
    const elsewhere = await asOther(request(app).post("/api/branches")).send({ name: "Nyabugogo" });
    expect(elsewhere.status).toBe(201);
  });

  it("cannot read or change another workspace's branch", async () => {
    const mine = await create({ name: "Private Shop" });
    const id = mine.body.data.id;

    expect((await asOther(request(app).get(`/api/branches/${id}`))).status).toBe(404);
    expect((await asOther(request(app).patch(`/api/branches/${id}`)).send({ city: "X" })).status)
      .toBe(404);
    expect((await asOther(request(app).delete(`/api/branches/${id}`))).status).toBe(404);
  });
});

describe("the default branch", () => {
  it("makes the first branch the default even when nobody asked", async () => {
    const first = await create({ name: "Only Shop" });

    expect(first.status).toBe(201);
    expect(first.body.data.is_default).toBe(true);
  });

  it("moves the flag rather than adding a second one", async () => {
    await create({ name: "First" });
    const second = await create({ name: "Second", is_default: true });

    expect(second.body.data.is_default).toBe(true);

    const defaults = await prisma.branch.findMany({
      where: { tenantId: TENANT, isDefault: true },
    });
    expect(defaults).toHaveLength(1);
    expect(defaults[0]!.name).toBe("Second");
  });

  it("promotes on update, and leaves exactly one default", async () => {
    await create({ name: "A" });
    const b = await create({ name: "B" });

    const promoted = await as(request(app).patch(`/api/branches/${b.body.data.id}`))
      .send({ is_default: true });

    expect(promoted.status).toBe(200);
    expect(promoted.body.data.is_default).toBe(true);
    expect(await prisma.branch.count({ where: { tenantId: TENANT, isDefault: true } })).toBe(1);
  });

  /*
   * The reason this module is not built on createCrudModule.
   *
   * Clearing the old default and setting the new one are one transaction here.
   * Done as two statements — which is all a beforeWrite hook can do — these
   * concurrent requests interleave and leave two primary branches. Written
   * against the real database and real HTTP stack, because that interleaving
   * is precisely what a mocked test cannot show.
   */
  it("still leaves exactly one default when several requests race", async () => {
    await create({ name: "Base" });

    const contenders = ["R1", "R2", "R3", "R4", "R5"];
    const results = await Promise.all(contenders.map((name) => create({ name, is_default: true })));

    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);

    const defaults = await prisma.branch.findMany({
      where: { tenantId: TENANT, isDefault: true },
    });
    expect(defaults).toHaveLength(1);
    expect(contenders).toContain(defaults[0]!.name);
  });

  it("does not demote when the flag is simply left off an update", async () => {
    const only = await create({ name: "Solo" });

    const renamed = await as(request(app).patch(`/api/branches/${only.body.data.id}`))
      .send({ city: "Huye" });

    expect(renamed.body.data.is_default).toBe(true);
    expect(renamed.body.data.city).toBe("Huye");
  });

  it("refuses to delete the default while other branches exist", async () => {
    const first = await create({ name: "Head Office" });
    await create({ name: "Branch Two" });

    const refused = await as(request(app).delete(`/api/branches/${first.body.data.id}`));
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("default_branch");

    // Still there, still the default.
    expect(await prisma.branch.count({ where: { tenantId: TENANT, isDefault: true } })).toBe(1);
  });

  it("allows deleting the last branch even though it is the default", async () => {
    const only = await create({ name: "Last One" });

    expect((await as(request(app).delete(`/api/branches/${only.body.data.id}`))).status).toBe(200);
    expect(await prisma.branch.count({ where: { tenantId: TENANT } })).toBe(0);
  });

  it("lists the default first", async () => {
    await create({ name: "Aaa" });
    await create({ name: "Zzz", is_default: true });

    const res = await as(request(app).get("/api/branches"));
    expect(res.body.data.map((b: { name: string }) => b.name)).toEqual(["Zzz", "Aaa"]);
  });
});

describe("who may change branches", () => {
  it("lets a cashier read the list but not create or delete", async () => {
    const branch = await create({ name: "Till Shop" });

    expect((await asCashier(request(app).get("/api/branches"))).status).toBe(200);

    const create403 = await asCashier(request(app).post("/api/branches")).send({ name: "Nope" });
    expect(create403.status).toBe(403);
    expect(create403.body.error.details.missing).toContain("branches.manage");

    expect((await asCashier(request(app).delete(`/api/branches/${branch.body.data.id}`))).status)
      .toBe(403);
  });
});

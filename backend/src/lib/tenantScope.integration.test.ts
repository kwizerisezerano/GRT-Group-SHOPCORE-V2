import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { scopedPrisma, tenantScopedModelNames } from "./tenantScope";
import { encrypt } from "./crypto";

/**
 * Exercises the tenant-scoping extension against a real MySQL database.
 *
 * Isolation is the single control standing in for Postgres RLS, so asserting
 * it in the abstract is not enough — these tests create two tenants with
 * colliding data and prove that one cannot see, change, or delete the
 * other's rows through the scoped client.
 *
 * Requires DATABASE_URL to point at a migrated database. Run with:
 *   npm run test:integration
 */

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

async function cleanup() {
  await prisma.category.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.createMany({
    data: [
      { id: TENANT_A, name: "Tenant A" },
      { id: TENANT_B, name: "Tenant B" },
    ],
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("tenant-scoped model derivation", () => {
  it("matches every model that declares a tenantId field", () => {
    const expected = require("@prisma/client")
      .Prisma.dmmf.datamodel.models.filter((m: { fields: { name: string }[] }) =>
        m.fields.some((f) => f.name === "tenantId")
      )
      .map((m: { name: string }) => m.name)
      .sort();

    expect(tenantScopedModelNames()).toEqual(expected);
  });

  it("covers the models that hold business data", () => {
    const names = tenantScopedModelNames();
    for (const model of ["Product", "Customer", "Sale", "Supplier", "Expense", "Purchase"]) {
      expect(names).toContain(model);
    }
  });

  it("excludes models that are not tenant-owned", () => {
    const names = tenantScopedModelNames();
    // Users are global (one login may belong to several tenants), and the
    // Tenant row itself is keyed by `id`, not `tenantId`.
    expect(names).not.toContain("User");
    expect(names).not.toContain("Tenant");
    expect(names).not.toContain("RefreshToken");
  });
});

describe("scoped client isolation", () => {
  it("stamps tenantId on create without being told", async () => {
    const db = scopedPrisma(TENANT_A);
    const created = await db.category.create({ data: { name: "Beverages" } as never });

    expect(created.tenantId).toBe(TENANT_A);
  });

  it("hides another tenant's rows from findMany", async () => {
    await scopedPrisma(TENANT_B).category.create({ data: { name: "B-only" } as never });

    const fromA = await scopedPrisma(TENANT_A).category.findMany();
    expect(fromA.map((c) => c.name)).not.toContain("B-only");
  });

  it("returns null from findFirst for another tenant's row", async () => {
    const bRow = await scopedPrisma(TENANT_B).category.create({
      data: { name: "B-secret" } as never,
    });

    const seenByA = await scopedPrisma(TENANT_A).category.findFirst({ where: { id: bRow.id } });
    expect(seenByA).toBeNull();
  });

  it("returns null from findUnique for another tenant's row", async () => {
    // findUnique carries an extra non-unique tenantId filter. Prisma 5
    // permits that, but it is worth pinning: if a future version rejects it,
    // this fails loudly rather than silently widening access.
    const bRow = await scopedPrisma(TENANT_B).category.create({
      data: { name: "B-unique" } as never,
    });

    const seenByA = await scopedPrisma(TENANT_A).category.findUnique({ where: { id: bRow.id } });
    expect(seenByA).toBeNull();
  });

  it("scopes count and aggregate", async () => {
    const aCount = await scopedPrisma(TENANT_A).category.count();
    const bCount = await scopedPrisma(TENANT_B).category.count();
    const total = await prisma.category.count({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });

    expect(aCount + bCount).toBe(total);
    expect(aCount).toBeGreaterThan(0);
    expect(bCount).toBeGreaterThan(0);
  });

  it("refuses to update another tenant's row", async () => {
    const bRow = await scopedPrisma(TENANT_B).category.create({
      data: { name: "B-untouchable" } as never,
    });

    await expect(
      scopedPrisma(TENANT_A).category.update({
        where: { id: bRow.id },
        data: { name: "hijacked" },
      })
    ).rejects.toThrow();

    const stillThere = await prisma.category.findUnique({ where: { id: bRow.id } });
    expect(stillThere?.name).toBe("B-untouchable");
  });

  it("affects no rows when updateMany targets another tenant", async () => {
    const result = await scopedPrisma(TENANT_A).category.updateMany({
      where: { name: "B-untouchable" },
      data: { name: "hijacked" },
    });

    expect(result.count).toBe(0);
  });

  it("refuses to delete another tenant's row", async () => {
    const bRow = await scopedPrisma(TENANT_B).category.create({
      data: { name: "B-persistent" } as never,
    });

    await expect(
      scopedPrisma(TENANT_A).category.delete({ where: { id: bRow.id } })
    ).rejects.toThrow();

    expect(await prisma.category.findUnique({ where: { id: bRow.id } })).not.toBeNull();
  });

  it("affects no rows when deleteMany targets another tenant", async () => {
    const result = await scopedPrisma(TENANT_A).category.deleteMany({
      where: { name: "B-persistent" },
    });

    expect(result.count).toBe(0);
  });

  it("stamps every row of an array createMany", async () => {
    await scopedPrisma(TENANT_A).category.createMany({
      data: [{ name: "bulk-1" }, { name: "bulk-2" }] as never,
    });

    const rows = await prisma.category.findMany({
      where: { name: { in: ["bulk-1", "bulk-2"] } },
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.tenantId === TENANT_A)).toBe(true);
  });

  it("stamps a single-object createMany", async () => {
    // Regression: the single-object form used to fall through unstamped,
    // which wrote a row with no tenant.
    await scopedPrisma(TENANT_A).category.createMany({
      data: { name: "single-object" } as never,
    });

    const row = await prisma.category.findFirst({ where: { name: "single-object" } });
    expect(row?.tenantId).toBe(TENANT_A);
  });

  it("does not mutate the caller's args object", async () => {
    // The extension used to write scoping into `args` in place, leaking
    // tenantId into any object a caller reused across requests.
    const args = { where: { name: "shared-args" } };
    await scopedPrisma(TENANT_A).category.findMany(args as never);

    expect(args.where).toEqual({ name: "shared-args" });
  });

  it("leaves non-tenant models unscoped", async () => {
    // Users are global. If the extension wrongly scoped them, a tenant's
    // client could not resolve its own owner.
    const email = `scope-probe-${Date.now()}@shopcore.local`;
    const user = await prisma.user.create({
      data: {
        emailEncrypted: encrypt(email),
        emailHash: `probe${Date.now()}`.padEnd(64, "0").slice(0, 64),
        passwordHash: "x",
      },
    });

    const found = await scopedPrisma(TENANT_A).user.findUnique({ where: { id: user.id } });
    expect(found?.id).toBe(user.id);

    await prisma.user.delete({ where: { id: user.id } });
  });
});

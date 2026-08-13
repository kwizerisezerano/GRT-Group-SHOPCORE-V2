import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { signAccessToken } from "../../lib/jwt";
import { seedWorkspace } from "../../test/workspace";

/**
 * Exercises the catalogue API end to end against real MySQL: HTTP in,
 * database out. Covers the rules that only a real engine can prove —
 * unique constraints, cross-tenant isolation, referential checks — plus the
 * response envelope and snake_case wire format the frontend depends on.
 */

const app = createApp();

const TENANT_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const USER_A = "aaaaaaaa-1111-4111-8111-cccccccccccc";
const USER_B = "bbbbbbbb-2222-4222-8222-dddddddddddd";

const tokenA = signAccessToken({ sub: USER_A, tenantId: TENANT_A, role: "owner" });
const tokenB = signAccessToken({ sub: USER_B, tenantId: TENANT_B, role: "owner" });

const asA = (r: request.Test) => r.set("Authorization", `Bearer ${tokenA}`);
const asB = (r: request.Test) => r.set("Authorization", `Bearer ${tokenB}`);

async function cleanup() {
  const tenants = { in: [TENANT_A, TENANT_B] };
  await prisma.product.deleteMany({ where: { tenantId: tenants } });
  await prisma.category.deleteMany({ where: { tenantId: tenants } });
  await prisma.brand.deleteMany({ where: { tenantId: tenants } });
  await prisma.tenant.deleteMany({ where: { id: tenants } });
}

beforeAll(async () => {
  await cleanup();
  await seedWorkspace({ tenantId: TENANT_A, userId: USER_A, role: "owner" });
  await seedWorkspace({ tenantId: TENANT_B, userId: USER_B, role: "owner" });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("response contract", () => {
  it("wraps success in the standard envelope with a message", async () => {
    const res = await asA(request(app).post("/api/categories")).send({ name: "Envelope" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Category created successfully.");
    expect(res.body.data.name).toBe("Envelope");
  });

  it("translates the message into the requested language", async () => {
    const res = await asA(request(app).post("/api/categories"))
      .set("X-Language", "es")
      .send({ name: "Sobre" });

    expect(res.body.message).toBe("Categoría creada correctamente.");
  });

  it("returns snake_case keys, never camelCase", async () => {
    const res = await asA(request(app).post("/api/products")).send({
      name: "Wire Format",
      cost_price: 100,
      selling_price: 150,
      stock_quantity: 7,
    });

    expect(res.body.data).toHaveProperty("selling_price");
    expect(res.body.data).toHaveProperty("stock_quantity");
    expect(res.body.data).not.toHaveProperty("sellingPrice");
    expect(res.body.data).not.toHaveProperty("stockQuantity");
  });

  it("accepts snake_case input", async () => {
    const res = await asA(request(app).post("/api/products")).send({
      name: "Snake Input",
      min_stock_level: 12,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.min_stock_level).toBe(12);
  });
});

describe("validation", () => {
  it("rejects a blank name with per-field detail", async () => {
    const res = await asA(request(app).post("/api/categories")).send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    expect(res.body.error.details.fieldErrors.name).toBeDefined();
  });

  it("rejects a negative price", async () => {
    const res = await asA(request(app).post("/api/products")).send({
      name: "Negative",
      selling_price: -5,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.sellingPrice).toBeDefined();
  });

  it("rejects a tax rate above 100", async () => {
    const res = await asA(request(app).post("/api/products")).send({
      name: "Overtaxed",
      tax_rate: 101,
    });

    expect(res.status).toBe(400);
  });

  it("normalises an empty optional string to null rather than storing ''", async () => {
    // Critical for SKU: many empty strings would collide under the unique
    // index, where many NULLs do not.
    const res = await asA(request(app).post("/api/products")).send({
      name: "Blank SKU",
      sku: "",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.sku).toBeNull();
  });
});

describe("uniqueness", () => {
  it("rejects a duplicate category name with 409 naming the field", async () => {
    await asA(request(app).post("/api/categories")).send({ name: "Unique Cat" });
    const res = await asA(request(app).post("/api/categories")).send({ name: "Unique Cat" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("duplicate_record");
    expect(res.body.error.details.fields).toContain("name");
  });

  it("rejects a duplicate SKU", async () => {
    await asA(request(app).post("/api/products")).send({ name: "First", sku: "DUP-SKU" });
    const res = await asA(request(app).post("/api/products")).send({ name: "Second", sku: "DUP-SKU" });

    expect(res.status).toBe(409);
    expect(res.body.error.details.fields).toContain("sku");
  });

  it("allows many products with no SKU", async () => {
    const first = await asA(request(app).post("/api/products")).send({ name: "No SKU 1" });
    const second = await asA(request(app).post("/api/products")).send({ name: "No SKU 2" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("scopes uniqueness per tenant, not globally", async () => {
    await asA(request(app).post("/api/categories")).send({ name: "Shared Name" });
    const res = await asB(request(app).post("/api/categories")).send({ name: "Shared Name" });

    // Two businesses may both have a "Beverages" category.
    expect(res.status).toBe(201);
  });
});

describe("tenant isolation", () => {
  it("does not list another tenant's rows", async () => {
    await asB(request(app).post("/api/categories")).send({ name: "B Only Category" });
    const res = await asA(request(app).get("/api/categories"));

    expect(res.body.data.map((c: { name: string }) => c.name)).not.toContain("B Only Category");
  });

  it("returns 404, not 403, for another tenant's row", async () => {
    // 403 would confirm the id exists. 404 reveals nothing.
    const created = await asB(request(app).post("/api/categories")).send({ name: "B Secret" });
    const res = await asA(request(app).get(`/api/categories/${created.body.data.id}`));

    expect(res.status).toBe(404);
  });

  it("refuses to update another tenant's row", async () => {
    const created = await asB(request(app).post("/api/categories")).send({ name: "B Untouchable" });
    const res = await asA(request(app).patch(`/api/categories/${created.body.data.id}`)).send({
      name: "hijacked",
    });

    expect(res.status).toBe(404);
    const still = await prisma.category.findUnique({ where: { id: created.body.data.id } });
    expect(still?.name).toBe("B Untouchable");
  });

  it("rejects a category belonging to another tenant", async () => {
    const foreign = await asB(request(app).post("/api/categories")).send({ name: "B Category" });
    const res = await asA(request(app).post("/api/products")).send({
      name: "Cross-tenant link",
      category_id: foreign.body.data.id,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_category");
  });

  it("requires authentication", async () => {
    expect((await request(app).get("/api/categories")).status).toBe(401);
  });
});

describe("product business rules", () => {
  it("derives category and brand names from their ids", async () => {
    const category = await asA(request(app).post("/api/categories")).send({ name: "Derived Cat" });
    const brand = await asA(request(app).post("/api/brands")).send({ name: "Derived Brand" });

    const res = await asA(request(app).post("/api/products")).send({
      name: "Derived",
      category_id: category.body.data.id,
      brand_id: brand.body.data.id,
    });

    expect(res.body.data.category).toBe("Derived Cat");
    expect(res.body.data.category_name).toBe("Derived Cat");
    expect(res.body.data.brand).toBe("Derived Brand");
  });

  it("keeps the legacy and current stock columns in lockstep", async () => {
    const res = await asA(request(app).post("/api/products")).send({
      name: "Lockstep",
      stock_quantity: 25,
      min_stock_level: 4,
    });

    expect(res.body.data.stock).toBe(25);
    expect(res.body.data.stock_quantity).toBe(25);
    expect(res.body.data.min_stock).toBe(4);
    expect(res.body.data.min_stock_level).toBe(4);
  });

  it("derives status from stock, ignoring what the client claims", async () => {
    const cases: Array<[number, number, string]> = [
      [0, 5, "out_of_stock"],
      [3, 5, "low_stock"],
      [50, 5, "active"],
    ];

    for (const [quantity, threshold, expected] of cases) {
      const res = await asA(request(app).post("/api/products")).send({
        name: `Status ${quantity}-${threshold}`,
        stock_quantity: quantity,
        min_stock_level: threshold,
        status: "active", // deliberately wrong for the first two
      });

      expect(res.body.data.status).toBe(expected);
    }
  });

  it("lets an explicit lifecycle status win over the derived one", async () => {
    const res = await asA(request(app).post("/api/products")).send({
      name: "Discontinued line",
      stock_quantity: 100,
      status: "discontinued",
    });

    expect(res.body.data.status).toBe("discontinued");
  });

  it("recomputes status when only the quantity is patched", async () => {
    const created = await asA(request(app).post("/api/products")).send({
      name: "Patch status",
      stock_quantity: 50,
      min_stock_level: 10,
    });
    expect(created.body.data.status).toBe("active");

    const patched = await asA(request(app).patch(`/api/products/${created.body.data.id}`)).send({
      stock_quantity: 2,
    });

    expect(patched.body.data.status).toBe("low_stock");
  });
});

describe("referential integrity", () => {
  it("refuses to delete a category that products still reference", async () => {
    const category = await asA(request(app).post("/api/categories")).send({ name: "In Use Cat" });
    await asA(request(app).post("/api/products")).send({
      name: "Dependant",
      category_id: category.body.data.id,
    });

    const res = await asA(request(app).delete(`/api/categories/${category.body.data.id}`));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("record_in_use");
    expect(res.body.error.details.products).toBe(1);
  });

  it("allows deleting a category once nothing references it", async () => {
    const category = await asA(request(app).post("/api/categories")).send({ name: "Free Cat" });
    const res = await asA(request(app).delete(`/api/categories/${category.body.data.id}`));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Category deleted successfully.");
  });
});

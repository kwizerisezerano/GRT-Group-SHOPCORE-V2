import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { encrypt } from "../../lib/crypto";
import { signAccessToken } from "../../lib/jwt";
import { seedWorkspace } from "../../test/workspace";

/**
 * A goods receipt is a sale in reverse, and wrong in the same ways: stock that
 * moved without a record, a record without the stock, or the same delivery
 * counted twice. These tests are about those, plus the one thing purchases own
 * that sales do not — what receiving stock does to a product's cost.
 */

const app = createApp();

const TENANT = "dddddddd-2222-4222-8222-dddddddddddd";
const USER = "dddddddd-2222-4222-8222-eeeeeeeeeeee";
const token = signAccessToken({ sub: USER, tenantId: TENANT, role: "owner" });
const as = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

async function cleanup() {
  await prisma.stockMovement.deleteMany({ where: { tenantId: TENANT } });
  await prisma.purchaseItem.deleteMany({ where: { tenantId: TENANT } });
  await prisma.purchase.deleteMany({ where: { tenantId: TENANT } });
  await prisma.product.deleteMany({ where: { tenantId: TENANT } });
  await prisma.supplier.deleteMany({ where: { tenantId: TENANT } });
  await prisma.invoiceCounter.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenant.deleteMany({ where: { id: TENANT } });
}

async function makeProduct(name: string, stock: number, costPrice = 500) {
  return prisma.product.create({
    data: {
      tenantId: TENANT,
      name,
      sellingPrice: costPrice * 2,
      costPrice,
      stockQuantity: stock,
      stock,
      minStockLevel: 0,
    },
  });
}

beforeAll(async () => {
  await cleanup();
  await seedWorkspace({ tenantId: TENANT, userId: USER, role: "owner" });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("receiving goods", () => {
  it("records the receipt and puts the stock on", async () => {
    const product = await makeProduct("Rice 25kg", 10, 20_000);

    const res = await as(request(app).post("/api/purchases")).send({
      items: [{ product_id: product.id, quantity: 5, unit_cost: 20_000 }],
      supplier_name: "Kigali Wholesale",
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Goods receipt recorded successfully.");
    expect(Number(res.body.data.total)).toBe(100_000);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.purchase_no).toMatch(/^PO-\d{8}-\d{4}$/);

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stockQuantity).toBe(15);
    expect(after?.stock).toBe(15);
  });

  it("writes a stock movement showing the increase", async () => {
    const product = await makeProduct("Beans 50kg", 4);

    await as(request(app).post("/api/purchases")).send({
      items: [{ product_id: product.id, quantity: 6 }],
    });

    const movement = await prisma.stockMovement.findFirst({
      where: { productId: product.id },
      orderBy: { createdAt: "desc" },
    });

    expect(movement).toMatchObject({
      tenantId: TENANT,
      movementType: "purchase_receive",
      quantityChange: 6,
      stockBefore: 4,
      stockAfter: 10,
    });
  });

  it("derives the totals rather than believing the client", async () => {
    const product = await makeProduct("Oil 20L", 0, 1_000);

    const res = await as(request(app).post("/api/purchases")).send({
      items: [{ product_id: product.id, quantity: 3, unit_cost: 1_000 }],
      tax: 200,
      discount: 500,
      subtotal: 1,
      total: 1,
    });

    // 3000 subtotal + 200 tax - 500 discount
    expect(Number(res.body.data.subtotal)).toBe(3_000);
    expect(Number(res.body.data.total)).toBe(2_700);
  });

  it("issues sequential receipt numbers, even under concurrency", async () => {
    const product = await makeProduct("Concurrent Receipt", 0);

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        as(request(app).post("/api/purchases")).send({
          items: [{ product_id: product.id, quantity: 1 }],
        })
      )
    );

    expect(results.every((r) => r.status === 201)).toBe(true);

    const numbers = results.map((r) => r.body.data.purchase_no);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("rejects a product belonging to another tenant", async () => {
    const other = "dddddddd-9999-4999-8999-dddddddddddd";
    await prisma.tenant.upsert({ where: { id: other }, create: { id: other, name: "Other" }, update: {} });
    const foreign = await prisma.product.create({
      data: { tenantId: other, name: "Foreign", sellingPrice: 10, stockQuantity: 0, stock: 0 },
    });

    const res = await as(request(app).post("/api/purchases")).send({
      items: [{ product_id: foreign.id, quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("unknown_product");

    await prisma.product.delete({ where: { id: foreign.id } });
    await prisma.tenant.delete({ where: { id: other } });
  });

  it("rejects a supplier belonging to another tenant", async () => {
    const other = "dddddddd-8888-4888-8888-dddddddddddd";
    await prisma.tenant.upsert({ where: { id: other }, create: { id: other, name: "Other" }, update: {} });
    // Supplier names are encrypted at rest, so this has to be written the
    // way the API writes it rather than as plaintext.
    const foreign = await prisma.supplier.create({
      data: { tenantId: other, nameEncrypted: encrypt("Foreign Supplier") },
    });
    const product = await makeProduct("Supplier Probe", 0);

    const res = await as(request(app).post("/api/purchases")).send({
      items: [{ product_id: product.id, quantity: 1 }],
      supplier_id: foreign.id,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("unknown_supplier");

    await prisma.supplier.delete({ where: { id: foreign.id } });
    await prisma.tenant.delete({ where: { id: other } });
  });

  it("requires authentication", async () => {
    expect((await request(app).get("/api/purchases")).status).toBe(401);
  });
});

describe("what receiving does to cost", () => {
  it("averages the new cost over the stock actually held", async () => {
    /*
     * The reason this is a weighted average and not "last cost wins". A shop
     * holding 100 units bought at 500 that receives 10 at 900 has not suddenly
     * paid 900 for everything on the shelf; pricing off that would quietly
     * destroy the margin on the 100 it still holds.
     *
     * (100 x 500 + 10 x 900) / 110 = 536.36
     */
    const product = await makeProduct("Averaged Item", 100, 500);

    const res = await as(request(app).post("/api/purchases")).send({
      items: [{ product_id: product.id, quantity: 10, unit_cost: 900 }],
    });

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(Number(after?.costPrice)).toBeCloseTo(536.36, 2);

    // And the line records what the cost became, so a margin figure can be
    // explained later from the numbers that were true at the time.
    expect(Number(res.body.data.items[0].cost_after)).toBeCloseTo(536.36, 2);
  });

  it("takes the received cost outright when there was no stock", async () => {
    const product = await makeProduct("First Delivery", 0, 0);

    await as(request(app).post("/api/purchases")).send({
      items: [{ product_id: product.id, quantity: 20, unit_cost: 750 }],
    });

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(Number(after?.costPrice)).toBe(750);
  });

  it("falls back to the product's cost when the receipt omits one", async () => {
    // Otherwise a receipt with no cost would silently value the goods at zero
    // and wreck every margin computed afterwards.
    const product = await makeProduct("No Cost Given", 5, 1_200);

    const res = await as(request(app).post("/api/purchases")).send({
      items: [{ product_id: product.id, quantity: 5 }],
    });

    expect(Number(res.body.data.items[0].unit_cost)).toBe(1_200);
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(Number(after?.costPrice)).toBe(1_200);
  });

  it("does not move stock or cost for a receipt that is only intent", async () => {
    // A draft or cancelled purchase records what someone means to buy. Goods
    // have not arrived, so neither number may move.
    const product = await makeProduct("Not Yet Arrived", 7, 300);

    const res = await as(request(app).post("/api/purchases")).send({
      items: [{ product_id: product.id, quantity: 50, unit_cost: 999 }],
      status: "draft",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(1);

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stockQuantity).toBe(7);
    expect(Number(after?.costPrice)).toBe(300);
    expect(await prisma.stockMovement.count({ where: { productId: product.id } })).toBe(0);
  });
});

describe("replay", () => {
  it("records a receipt once, however many times it is sent", async () => {
    // A delivery counted twice inflates stock exactly as surely as a sale
    // counted twice deflates it.
    const product = await makeProduct("Replayed Delivery", 10, 400);
    const key = `po-${Date.now()}-once`;
    const body = {
      items: [{ product_id: product.id, quantity: 25, unit_cost: 400 }],
      client_request_id: key,
    };

    const first = await as(request(app).post("/api/purchases")).send(body);
    const second = await as(request(app).post("/api/purchases")).send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);

    expect(await prisma.purchase.count({ where: { clientRequestId: key } })).toBe(1);

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stockQuantity).toBe(35);
  });

  it("records one receipt when replays arrive together", async () => {
    const product = await makeProduct("Concurrent Delivery", 0);
    const key = `po-${Date.now()}-race`;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        as(request(app).post("/api/purchases")).send({
          items: [{ product_id: product.id, quantity: 4 }],
          client_request_id: key,
        })
      )
    );

    expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stockQuantity).toBe(4);
  });

  it("marks a receipt taken offline, dated when it happened", async () => {
    const product = await makeProduct("Offline Delivery", 0);

    const res = await as(request(app).post("/api/purchases")).send({
      items: [{ product_id: product.id, quantity: 12 }],
      offline: true,
      client_request_id: `po-${Date.now()}-offline`,
      completed_at: "2026-08-02T07:15:00.000Z",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe("offline");
    expect(new Date(res.body.data.completed_at).toISOString()).toBe("2026-08-02T07:15:00.000Z");
  });

  it("leaves nothing behind when a receipt is rejected", async () => {
    const product = await makeProduct("Rollback Probe", 5);
    const before = await prisma.purchase.count({ where: { tenantId: TENANT } });

    const res = await as(request(app).post("/api/purchases")).send({
      items: [
        { product_id: product.id, quantity: 3 },
        { product_id: "11111111-1111-4111-8111-111111111111", quantity: 1 },
      ],
    });

    expect(res.status).toBe(400);
    expect(await prisma.purchase.count({ where: { tenantId: TENANT } })).toBe(before);
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toMatchObject({
      stockQuantity: 5,
    });
  });
});

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { signAccessToken } from "../../lib/jwt";
import { seedWorkspace } from "../../test/workspace";

/**
 * Units and the stock ledger. The ledger is read-only by design — movements
 * are written by the code that moves stock, inside the transaction that moved
 * it — so these are about reading it correctly, and about the filter handling
 * that broke the adjustments screen.
 */

const app = createApp();

const TENANT = "a1a1a1a1-3333-4333-8333-a1a1a1a1a1a1";
const USER = "a1a1a1a1-3333-4333-8333-b1b1b1b1b1b1";
const token = signAccessToken({ sub: USER, tenantId: TENANT, role: "owner" });
const as = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

async function cleanup() {
  await prisma.stockMovement.deleteMany({ where: { tenantId: TENANT } });
  await prisma.saleItem.deleteMany({ where: { tenantId: TENANT } });
  await prisma.sale.deleteMany({ where: { tenantId: TENANT } });
  await prisma.invoiceCounter.deleteMany({ where: { tenantId: TENANT } });
  await prisma.product.deleteMany({ where: { tenantId: TENANT } });
  await prisma.unit.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenant.deleteMany({ where: { id: TENANT } });
  await prisma.user.deleteMany({ where: { id: USER } });
}

beforeAll(async () => {
  await cleanup();
  await seedWorkspace({ tenantId: TENANT, userId: USER, role: "owner" });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("units", () => {
  it("creates a unit and refuses a duplicate name", async () => {
    const created = await as(request(app).post("/api/units")).send({
      name: "Carton",
      abbreviation: "ctn",
    });
    expect(created.status).toBe(201);

    const duplicate = await as(request(app).post("/api/units")).send({ name: "Carton" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toContain("already exists");
  });
});

describe("the stock ledger", () => {
  it("shows the movements a sale produced", async () => {
    const product = await prisma.product.create({
      data: { tenantId: TENANT, name: "Ledger Item", sellingPrice: 500, stockQuantity: 10, stock: 10 },
    });

    await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 2 }],
    });

    const res = await as(request(app).get("/api/stock-movements"));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      movement_type: "sale",
      quantity_change: -2,
      stock_before: 10,
      stock_after: 8,
    });
  });

  it("treats a blank filter as no filter", async () => {
    /*
     * The regression this exists for. A screen with an unselected product
     * dropdown sends `?product_id=`, meaning "all products" — but an empty
     * string is not a uuid, so the request came back 400 and the stock
     * adjustments page showed nothing at all.
     */
    const blankProduct = await as(request(app).get("/api/stock-movements?product_id="));
    expect(blankProduct.status).toBe(200);

    const blankType = await as(request(app).get("/api/stock-movements?movement_type="));
    expect(blankType.status).toBe(200);

    const both = await as(request(app).get("/api/stock-movements?product_id=&movement_type=&limit=1000"));
    expect(both.status).toBe(200);
  });

  it("clamps an oversized limit instead of refusing", async () => {
    /*
     * Two screens ask for 5,000 movements. Capping at 1,000 and rejecting
     * anything larger meant both got a 400 and rendered nothing where the
     * history should have been. Asking for more than the server will give is
     * not a malformed request.
     */
    const big = await as(request(app).get("/api/stock-movements?limit=50000"));
    expect(big.status).toBe(200);

    const five = await as(request(app).get("/api/stock-movements?limit=5000"));
    expect(five.status).toBe(200);
  });

  it("still rejects a filter that is present but malformed", async () => {
    // Blank means "no filter"; nonsense means the caller made a mistake.
    const res = await as(request(app).get("/api/stock-movements?product_id=not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("filters by product when one is chosen", async () => {
    const a = await prisma.product.create({
      data: { tenantId: TENANT, name: "Filter A", sellingPrice: 100, stockQuantity: 5, stock: 5 },
    });
    const b = await prisma.product.create({
      data: { tenantId: TENANT, name: "Filter B", sellingPrice: 100, stockQuantity: 5, stock: 5 },
    });

    await as(request(app).post("/api/sales")).send({ items: [{ product_id: a.id, quantity: 1 }] });
    await as(request(app).post("/api/sales")).send({ items: [{ product_id: b.id, quantity: 1 }] });

    const res = await as(request(app).get(`/api/stock-movements?product_id=${a.id}`));
    expect(res.body.data.every((m: { product_id: string }) => m.product_id === a.id)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it("has no way to write to the ledger", async () => {
    // Movements are written by the code that moves stock, inside the same
    // transaction. A ledger anyone can post to is not a ledger.
    expect((await as(request(app).post("/api/stock-movements")).send({})).status).toBe(404);
  });
});

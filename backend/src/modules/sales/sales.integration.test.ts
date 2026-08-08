import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { phoneBlindIndex } from "../../lib/crypto";
import { signAccessToken } from "../../lib/jwt";

/**
 * The sales module's job is to be atomic and to be right about money and
 * stock. These tests care about exactly that: totals the client cannot
 * influence, stock that cannot go negative even under concurrency, and
 * nothing left behind when a sale fails partway.
 */

const app = createApp();

const TENANT = "eeeeeeee-1111-4111-8111-eeeeeeeeeeee";
const USER = "eeeeeeee-1111-4111-8111-ffffffffffff";
const token = signAccessToken({ sub: USER, tenantId: TENANT, role: "owner" });
const as = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

async function cleanup() {
  await prisma.stockMovement.deleteMany({ where: { tenantId: TENANT } });
  await prisma.saleItem.deleteMany({ where: { tenantId: TENANT } });
  await prisma.sale.deleteMany({ where: { tenantId: TENANT } });
  await prisma.product.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenant.deleteMany({ where: { id: TENANT } });
}

/** Creates a product directly, bypassing the API, with a known stock level. */
async function makeProduct(name: string, stock: number, price = 1000, taxRate = 0) {
  return prisma.product.create({
    data: {
      tenantId: TENANT,
      name,
      sellingPrice: price,
      costPrice: price / 2,
      taxRate,
      stockQuantity: stock,
      stock,
      minStockLevel: 0,
    },
  });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.create({ data: { id: TENANT, name: "Sales Tenant" } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("checkout", () => {
  it("records a sale and takes the stock off", async () => {
    const product = await makeProduct("Milk 1L", 50, 1200);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 3 }],
      payment_method: "cash",
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Sale completed successfully.");
    expect(Number(res.body.data.total)).toBe(3600);
    expect(res.body.data.sale_items).toHaveLength(1);

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stockQuantity).toBe(47);
    expect(after?.stock).toBe(47);
  });

  it("writes a stock movement with before and after", async () => {
    const product = await makeProduct("Sugar 1kg", 20);
    await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 5 }],
    });

    const movement = await prisma.stockMovement.findFirst({
      where: { productId: product.id },
      orderBy: { createdAt: "desc" },
    });

    expect(movement).toMatchObject({
      tenantId: TENANT,
      movementType: "sale",
      quantityChange: -5,
      stockBefore: 20,
      stockAfter: 15,
    });
  });

  it("prices from the catalogue, not from the request", async () => {
    // A client that can name its own price can sell a television for one
    // franc. The product row is the only safe source.
    const product = await makeProduct("Television", 5, 500_000);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
      subtotal: 1,
      total: 1,
      tax: 0,
    });

    expect(Number(res.body.data.total)).toBe(500_000);
  });

  it("computes tax per line from the product's rate", async () => {
    const product = await makeProduct("Taxed Item", 10, 1000, 18);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 2 }],
    });

    // 2000 net, 18% => 360 tax, 2360 total
    expect(Number(res.body.data.subtotal)).toBe(2000);
    expect(Number(res.body.data.tax)).toBe(360);
    expect(Number(res.body.data.total)).toBe(2360);
  });

  it("marks a sale partial when less than the total is paid", async () => {
    const product = await makeProduct("Credit Item", 10, 5000);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
      paid: 2000,
      payment_method: "credit",
    });

    expect(res.body.data.status).toBe("partial");
    expect(Number(res.body.data.due)).toBe(3000);
  });

  it("issues sequential per-tenant invoice numbers", async () => {
    const product = await makeProduct("Invoice Probe", 10);
    const first = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
    });
    const second = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
    });

    expect(first.body.data.invoice_no).toMatch(/^INV-\d{8}-\d{4}$/);
    expect(second.body.data.invoice_no).not.toBe(first.body.data.invoice_no);
  });

  it("never issues the same invoice number twice, even under concurrency", async () => {
    // An invoice number derived from "how many sales exist today" is only
    // correct while requests are serial. Two concurrent checkouts both read
    // the same count and both claim it — two different sales, one number, and
    // an accounting record that cannot be reconciled. Stock is plentiful here
    // so nothing else can mask a collision.
    const product = await makeProduct("Concurrent Invoice", 500);

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        as(request(app).post("/api/sales")).send({
          items: [{ product_id: product.id, quantity: 1 }],
        })
      )
    );

    expect(results.every((r) => r.status === 201)).toBe(true);

    const numbers = results.map((r) => r.body.data.invoice_no);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe("point of sale fields", () => {
  it("stores the customer's phone encrypted and gives it back decrypted", async () => {
    const product = await makeProduct("POS Phone", 10, 2500);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
      customer_name: "Ange Uwase",
      customer_phone: "+250 788 123 456",
      customer_tin: "102938475",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.customer_phone).toBe("+250 788 123 456");
    expect(res.body.data.customer_tin).toBe("102938475");

    // The wire must never carry the storage shape or the lookup fingerprint.
    expect(res.body.data).not.toHaveProperty("customer_phone_encrypted");
    expect(res.body.data).not.toHaveProperty("customer_phone_hash");
    expect(res.body.data).not.toHaveProperty("customer_tin_encrypted");

    const [row] = await prisma.$queryRawUnsafe<Record<string, string | null>[]>(
      "SELECT customer_phone_encrypted, customer_phone_hash, customer_tin_encrypted FROM sales WHERE id = ?",
      res.body.data.id
    );

    // Nothing readable in the column, and a hash that can be searched on.
    expect(row.customer_phone_encrypted).toMatch(/^v1\./);
    expect(JSON.stringify(row)).not.toContain("788");
    expect(row.customer_phone_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("finds a sale by phone number through the blind index", async () => {
    const product = await makeProduct("POS Lookup", 10);
    await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
      customer_phone: "+250 788 999 111",
    });

    // Spacing and punctuation must not defeat the lookup — the index is over
    // the normalised number, not the string the cashier happened to type.
    const found = await prisma.sale.findFirst({
      where: { tenantId: TENANT, customerPhoneHash: phoneBlindIndex("+250-788-999-111") },
    });

    expect(found).not.toBeNull();

    /*
     * Known limitation, asserted so it cannot change unnoticed: a national
     * number and its international form are different hashes. normalizePhone
     * says so, because telling them apart needs a country and this function
     * has none. It means a shop that records "0788999111" one day and
     * "+250788999111" the next has two unlinked records for one buyer.
     *
     * Fixing it is an E.164 normalisation against the tenant's country, and
     * it rewrites every phone hash already stored — customers and suppliers
     * included — so it belongs in its own migration with a backfill, not here.
     */
    const national = await prisma.sale.findFirst({
      where: { tenantId: TENANT, customerPhoneHash: phoneBlindIndex("0788999111") },
    });
    expect(national).toBeNull();
  });

  it("freezes cost and margin onto each line at the time of sale", async () => {
    // costPrice is half of sellingPrice in makeProduct.
    const product = await makeProduct("Margin Item", 10, 4000);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 3 }],
    });

    const line = res.body.data.sale_items[0];
    expect(Number(line.unit_cost)).toBe(2000);
    expect(Number(line.cost_total)).toBe(6000);
    expect(Number(line.gross_profit)).toBe(6000);
    expect(Number(res.body.data.cost_total)).toBe(6000);
    expect(Number(res.body.data.gross_profit)).toBe(6000);

    // Raising the cost price later must not rewrite a sale already made.
    await prisma.product.update({ where: { id: product.id }, data: { costPrice: 3900 } });
    const reread = await as(request(app).get(`/api/sales/${res.body.data.id}`));
    expect(Number(reread.body.data.sale_items[0].unit_cost)).toBe(2000);
  });

  it("records change owed when the customer overpays", async () => {
    const product = await makeProduct("Change Item", 10, 1500);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 2 }],
      paid: 5000,
    });

    expect(Number(res.body.data.total)).toBe(3000);
    expect(Number(res.body.data.change_given)).toBe(2000);
    // Change is money handed back, not an amount still owing.
    expect(Number(res.body.data.due)).toBe(0);
    expect(res.body.data.status).toBe("completed");
  });

  it("encrypts the mobile-money number but keeps the transaction code readable", async () => {
    const product = await makeProduct("MoMo Item", 10, 7000);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
      payment_method: "mobile_money",
      momo_number: "0788555222",
      momo_code: "MP240806.1234.A56789",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.momo_number).toBe("0788555222");
    // The code is not personal data and must stay legible: it is what a shop
    // reconciles against the provider's statement.
    expect(res.body.data.momo_code).toBe("MP240806.1234.A56789");

    const [row] = await prisma.$queryRawUnsafe<Record<string, string | null>[]>(
      "SELECT momo_number_encrypted, momo_code FROM sales WHERE id = ?",
      res.body.data.id
    );
    expect(row.momo_number_encrypted).toMatch(/^v1\./);
    expect(row.momo_code).toBe("MP240806.1234.A56789");
  });

  it("keeps the cashier, branch and receipt number the till sent", async () => {
    const product = await makeProduct("Till Item", 10);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
      cashier: "Claudine",
      branch: "Kigali Main",
      receipt_no: "RCP-000042",
    });

    expect(res.body.data.cashier).toBe("Claudine");
    expect(res.body.data.branch).toBe("Kigali Main");
    expect(res.body.data.receipt_no).toBe("RCP-000042");
  });

  it("accepts the POS payment methods", async () => {
    const product = await makeProduct("Tender Item", 50);

    for (const method of ["cash", "mobile", "mobile_money", "card", "bank_transfer", "split"]) {
      const res = await as(request(app).post("/api/sales")).send({
        items: [{ product_id: product.id, quantity: 1 }],
        payment_method: method,
      });
      expect(res.status, `payment_method=${method}`).toBe(201);
      expect(res.body.data.payment_method).toBe(method);
    }
  });

  it("ignores a client-supplied cost, taking it from the catalogue", async () => {
    // Same reasoning as price: a client that can name its own cost can invent
    // any margin it likes. unitCost is an override for a known landed cost,
    // and it is still bounded by validation — but a missing one must never
    // fall back to whatever the caller wished for.
    const product = await makeProduct("Cost Probe", 10, 1000);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
      cost_total: 1,
      gross_profit: 999_999,
    });

    expect(Number(res.body.data.cost_total)).toBe(500);
    expect(Number(res.body.data.gross_profit)).toBe(500);
  });
});

describe("offline sales and replay", () => {
  /*
   * The offline story only works if sending the same sale twice is safe. A
   * till that loses its connection after the server committed, but before the
   * answer arrived, cannot tell success from failure — so it retries, and the
   * shop must not end up with two sales and twice the stock gone.
   */

  it("records a sale once, however many times it is sent", async () => {
    const product = await makeProduct("Replay Item", 20, 1500);
    const key = `req-${Date.now()}-once`;

    const body = {
      items: [{ product_id: product.id, quantity: 2 }],
      client_request_id: key,
    };

    const first = await as(request(app).post("/api/sales")).send(body);
    const second = await as(request(app).post("/api/sales")).send(body);
    const third = await as(request(app).post("/api/sales")).send(body);

    expect(first.status).toBe(201);
    // 200, not 201: the retry created nothing.
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);

    // Same sale, same invoice number, every time.
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(third.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.invoice_no).toBe(first.body.data.invoice_no);
    expect(second.body.message).toBe(
      "This sale was already recorded. Returning the original receipt."
    );

    expect(await prisma.sale.count({ where: { clientRequestId: key } })).toBe(1);

    // And the stock came off exactly once.
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stockQuantity).toBe(18);
  });

  it("records one sale when replays arrive at the same instant", async () => {
    /*
     * The reason the unique constraint exists rather than just the read-before-
     * write check. Both requests can pass that check; only one can hold the
     * key. This is the case the old sync path — which read back an invoice
     * number before inserting — could not survive.
     */
    const product = await makeProduct("Concurrent Replay", 50, 1000);
    const key = `req-${Date.now()}-race`;

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        as(request(app).post("/api/sales")).send({
          items: [{ product_id: product.id, quantity: 1 }],
          client_request_id: key,
        })
      )
    );

    // Nobody gets an error; everybody gets the same sale.
    expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);

    const ids = new Set(results.map((r) => r.body.data.id));
    expect(ids.size).toBe(1);

    expect(await prisma.sale.count({ where: { clientRequestId: key } })).toBe(1);

    // One unit sold, not six.
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stockQuantity).toBe(49);
  });

  it("treats different keys as different sales", async () => {
    const product = await makeProduct("Distinct Keys", 20);

    const a = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
      client_request_id: `req-${Date.now()}-a`,
    });
    const b = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
      client_request_id: `req-${Date.now()}-b`,
    });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.id).not.toBe(b.body.data.id);
  });

  it("does not deduplicate sales that send no key", async () => {
    // Two genuinely separate walk-in customers buying the same thing must not
    // be collapsed into one sale just because the request bodies match.
    const product = await makeProduct("No Key", 20);
    const body = { items: [{ product_id: product.id, quantity: 1 }] };

    const a = await as(request(app).post("/api/sales")).send(body);
    const b = await as(request(app).post("/api/sales")).send(body);

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.id).not.toBe(b.body.data.id);
  });

  it("records an offline sale even when stock has since run out", async () => {
    /*
     * The goods left the shop while the till was disconnected. By the time it
     * replays, the only question is whether the books will admit it — and
     * refusing would leave the shop with the goods gone, no record of the
     * money, and a stock number that is wrong either way.
     */
    const product = await makeProduct("Sold While Offline", 1, 3000);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 4 }],
      offline: true,
      client_request_id: `req-${Date.now()}-offline`,
      completed_at: "2026-08-01T09:30:00.000Z",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe("offline");

    // Negative stock is the shop being told its count disagrees with what
    // actually left the shelves — a stock take resolves it, silence does not.
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stockQuantity).toBe(-3);

    // The sale is dated when it happened, not when it synced.
    expect(new Date(res.body.data.completed_at).toISOString()).toBe(
      "2026-08-01T09:30:00.000Z"
    );
  });

  it("still refuses an online sale that would oversell", async () => {
    // The licence above is for offline replays only. Online, the server is
    // right there to say no before the goods move.
    const product = await makeProduct("Online Guard", 1);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 4 }],
      client_request_id: `req-${Date.now()}-online-guard`,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("insufficient_stock");

    // A refused sale must leave nothing behind — including its key, so the
    // till can correct the basket and try again.
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toMatchObject({
      stockQuantity: 1,
    });
  });

  it("lets a refused sale be retried with the same key once it is valid", async () => {
    const product = await makeProduct("Retry After Fix", 2, 800);
    const key = `req-${Date.now()}-recover`;

    const tooMany = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 5 }],
      client_request_id: key,
    });
    expect(tooMany.status).toBe(409);

    // Nothing was recorded, so the key is still free.
    const corrected = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 2 }],
      client_request_id: key,
    });

    expect(corrected.status).toBe(201);
    expect(await prisma.sale.count({ where: { clientRequestId: key } })).toBe(1);
  });

  it("defaults a sale to online, completed now", async () => {
    const product = await makeProduct("Default Source", 10);
    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 1 }],
    });

    expect(res.body.data.source).toBe("online");
    expect(res.body.data.completed_at).toBeTruthy();
  });

  it("keeps one tenant's key from colliding with another's", async () => {
    // Keys are generated on the client, so two businesses can pick the same
    // one. Scoping the constraint per tenant is what stops one shop's replay
    // from returning another shop's sale.
    const otherTenant = "eeeeeeee-7777-4777-8777-eeeeeeeeeeee";
    const otherUser = "eeeeeeee-7777-4777-8777-ffffffffffff";
    await prisma.tenant.upsert({
      where: { id: otherTenant },
      create: { id: otherTenant, name: "Other Shop" },
      update: {},
    });
    const otherToken = signAccessToken({ sub: otherUser, tenantId: otherTenant, role: "owner" });

    const mine = await makeProduct("Shared Key Mine", 10);
    const theirs = await prisma.product.create({
      data: { tenantId: otherTenant, name: "Shared Key Theirs", sellingPrice: 10, stockQuantity: 10, stock: 10 },
    });

    const key = `req-${Date.now()}-shared`;

    const a = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: mine.id, quantity: 1 }],
      client_request_id: key,
    });
    const b = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ items: [{ product_id: theirs.id, quantity: 1 }], client_request_id: key });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.id).not.toBe(b.body.data.id);

    await prisma.saleItem.deleteMany({ where: { tenantId: otherTenant } });
    await prisma.stockMovement.deleteMany({ where: { tenantId: otherTenant } });
    await prisma.sale.deleteMany({ where: { tenantId: otherTenant } });
    await prisma.product.deleteMany({ where: { tenantId: otherTenant } });
    await prisma.tenant.delete({ where: { id: otherTenant } });
  });
});

describe("stock safety", () => {
  it("refuses to sell more than is in stock", async () => {
    const product = await makeProduct("Scarce", 2);

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 5 }],
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("insufficient_stock");
    expect(res.body.error.details).toMatchObject({ available: 2, requested: 5 });
    expect(res.body.message).toContain("Scarce");
  });

  it("rolls the whole sale back when one line is short", async () => {
    const plenty = await makeProduct("Plenty", 100);
    const scarce = await makeProduct("Nearly Out", 1);

    const res = await as(request(app).post("/api/sales")).send({
      items: [
        { product_id: plenty.id, quantity: 2 },
        { product_id: scarce.id, quantity: 10 },
      ],
    });

    expect(res.status).toBe(409);

    // Nothing may survive: no sale header, no line items, and the first
    // product's stock must be untouched.
    expect(await prisma.product.findUnique({ where: { id: plenty.id } })).toMatchObject({
      stockQuantity: 100,
    });
    expect(await prisma.saleItem.count({ where: { productId: plenty.id } })).toBe(0);
    expect(await prisma.stockMovement.count({ where: { productId: plenty.id } })).toBe(0);
  });

  it("does not oversell when two checkouts race for the last units", async () => {
    // The reason applyStockMovement takes a FOR UPDATE lock. Without it both
    // requests read the same stock, both compute a valid result, and the shop
    // sells more than it had.
    const product = await makeProduct("Last Units", 10);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        as(request(app).post("/api/sales")).send({
          items: [{ product_id: product.id, quantity: 4 }],
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 201).length;
    const rejected = results.filter((r) => r.status === 409).length;

    // 10 units, 4 per sale: at most two can succeed. Every other request
    // must be a clean 409, never a 500 — a deadlocked checkout is retried
    // (lib/transaction.ts), not surfaced to the cashier as a crash.
    expect(succeeded).toBeLessThanOrEqual(2);
    expect(succeeded + rejected).toBe(5);

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after!.stockQuantity).toBeGreaterThanOrEqual(0);
    expect(after!.stockQuantity).toBe(10 - succeeded * 4);
  });

  it("updates the product's status as stock falls", async () => {
    const product = await prisma.product.create({
      data: {
        tenantId: TENANT,
        name: "Status Tracker",
        sellingPrice: 100,
        stockQuantity: 10,
        stock: 10,
        minStockLevel: 5,
        status: "active",
      },
    });

    await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 6 }],
    });
    expect((await prisma.product.findUnique({ where: { id: product.id } }))?.status).toBe("low_stock");

    await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 4 }],
    });
    expect((await prisma.product.findUnique({ where: { id: product.id } }))?.status).toBe("out_of_stock");
  });
});

describe("validation and isolation", () => {
  it("rejects an empty basket", async () => {
    const res = await as(request(app).post("/api/sales")).send({ items: [] });
    expect(res.status).toBe(400);
  });

  it("rejects a zero or negative quantity", async () => {
    const product = await makeProduct("Qty Probe", 10);
    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: product.id, quantity: 0 }],
    });
    expect(res.status).toBe(400);
  });

  it("rejects a product belonging to another tenant", async () => {
    const otherTenant = "eeeeeeee-9999-4999-8999-eeeeeeeeeeee";
    await prisma.tenant.upsert({
      where: { id: otherTenant },
      create: { id: otherTenant, name: "Other" },
      update: {},
    });
    const foreign = await prisma.product.create({
      data: { tenantId: otherTenant, name: "Foreign", sellingPrice: 10, stockQuantity: 100, stock: 100 },
    });

    const res = await as(request(app).post("/api/sales")).send({
      items: [{ product_id: foreign.id, quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("unknown_product");

    await prisma.product.delete({ where: { id: foreign.id } });
    await prisma.tenant.delete({ where: { id: otherTenant } });
  });

  it("requires authentication", async () => {
    expect((await request(app).get("/api/sales")).status).toBe(401);
  });
});

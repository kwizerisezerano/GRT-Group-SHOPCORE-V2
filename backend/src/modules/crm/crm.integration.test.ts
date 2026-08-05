import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { signAccessToken } from "../../lib/jwt";

/**
 * Customers and suppliers hold real personal data, so these tests care about
 * one thing above all: that the plaintext never reaches a column, and that
 * the API still behaves like an ordinary CRUD resource anyway.
 */

const app = createApp();

const TENANT_A = "cccccccc-1111-4111-8111-cccccccccccc";
const TENANT_B = "dddddddd-2222-4222-8222-dddddddddddd";
const tokenA = signAccessToken({ sub: "cccccccc-1111-4111-8111-eeeeeeeeeeee", tenantId: TENANT_A, role: "owner" });
const tokenB = signAccessToken({ sub: "dddddddd-2222-4222-8222-ffffffffffff", tenantId: TENANT_B, role: "owner" });

const asA = (r: request.Test) => r.set("Authorization", `Bearer ${tokenA}`);
const asB = (r: request.Test) => r.set("Authorization", `Bearer ${tokenB}`);

async function cleanup() {
  const scope = { in: [TENANT_A, TENANT_B] };
  await prisma.expense.deleteMany({ where: { tenantId: scope } });
  await prisma.customer.deleteMany({ where: { tenantId: scope } });
  await prisma.supplier.deleteMany({ where: { tenantId: scope } });
  await prisma.tenant.deleteMany({ where: { id: scope } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.createMany({
    data: [
      { id: TENANT_A, name: "CRM Tenant A" },
      { id: TENANT_B, name: "CRM Tenant B" },
    ],
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("customer PII", () => {
  it("round-trips the plaintext the caller sent", async () => {
    const res = await asA(request(app).post("/api/customers")).send({
      name: "Aline Mukamana",
      phone: "+250 788 111 222",
      email: "aline@example.rw",
      address: "KG 11 Ave, Kigali",
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "Aline Mukamana",
      phone: "+250 788 111 222",
      email: "aline@example.rw",
      address: "KG 11 Ave, Kigali",
    });
  });

  it("stores no plaintext in any column", async () => {
    const created = await asA(request(app).post("/api/customers")).send({
      name: "Jean Habimana",
      phone: "+250788333444",
      email: "jean.h@example.rw",
      address: "Nyarugenge",
    });

    const row = await prisma.customer.findUnique({ where: { id: created.body.data.id } });
    const serialised = JSON.stringify(row);

    for (const secret of ["Jean Habimana", "788333444", "jean.h@example.rw", "Nyarugenge"]) {
      expect(serialised).not.toContain(secret);
    }
    expect(row?.nameEncrypted).toMatch(/^v1\./);
    expect(row?.emailHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never returns the internal lookup hashes", async () => {
    const res = await asA(request(app).get("/api/customers"));

    for (const row of res.body.data) {
      expect(row).not.toHaveProperty("email_hash");
      expect(row).not.toHaveProperty("phone_hash");
      expect(row).not.toHaveProperty("name_encrypted");
    }
  });

  it("rejects a duplicate phone written in a different format", async () => {
    await asA(request(app).post("/api/customers")).send({
      name: "Format One",
      phone: "+250788555666",
    });
    const res = await asA(request(app).post("/api/customers")).send({
      name: "Format Two",
      phone: "+250-788-555-666",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.details.fields).toEqual(["phone"]);
  });

  it("rejects a duplicate email differing only by case", async () => {
    await asA(request(app).post("/api/customers")).send({
      name: "Case One",
      email: "Case@Example.RW",
    });
    const res = await asA(request(app).post("/api/customers")).send({
      name: "Case Two",
      email: "case@example.rw",
    });

    expect(res.status).toBe(409);
  });

  it("scopes that uniqueness per tenant", async () => {
    // The same person may be a customer of two different businesses.
    await asA(request(app).post("/api/customers")).send({ name: "Shared", email: "shared@example.rw" });
    const res = await asB(request(app).post("/api/customers")).send({ name: "Shared", email: "shared@example.rw" });

    expect(res.status).toBe(201);
  });

  it("rejects a malformed email", async () => {
    const res = await asA(request(app).post("/api/customers")).send({
      name: "Bad Email",
      email: "not-an-email",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.email).toBeDefined();
  });

  it("updates one field without blanking the others", async () => {
    const created = await asA(request(app).post("/api/customers")).send({
      name: "Partial Update",
      phone: "+250788777888",
      email: "partial@example.rw",
    });

    const patched = await asA(request(app).patch(`/api/customers/${created.body.data.id}`)).send({
      phone: "+250788999000",
    });

    expect(patched.body.data.phone).toBe("+250788999000");
    expect(patched.body.data.email).toBe("partial@example.rw");
    expect(patched.body.data.name).toBe("Partial Update");
  });

  it("hides another tenant's customers", async () => {
    await asB(request(app).post("/api/customers")).send({ name: "B Private Customer" });
    const res = await asA(request(app).get("/api/customers"));

    expect(res.body.data.map((c: { name: string }) => c.name)).not.toContain("B Private Customer");
  });
});

describe("suppliers", () => {
  it("encrypts the same way customers do", async () => {
    const res = await asA(request(app).post("/api/suppliers")).send({
      name: "Kigali Wholesale",
      email: "sales@kw.rw",
    });

    expect(res.body.data.name).toBe("Kigali Wholesale");

    const row = await prisma.supplier.findUnique({ where: { id: res.body.data.id } });
    expect(JSON.stringify(row)).not.toContain("Kigali Wholesale");
  });

  it("deletes cleanly when nothing references it", async () => {
    const created = await asA(request(app).post("/api/suppliers")).send({ name: "Disposable" });
    const res = await asA(request(app).delete(`/api/suppliers/${created.body.data.id}`));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Supplier deleted successfully.");
  });
});

describe("expenses", () => {
  it("records an expense", async () => {
    const res = await asA(request(app).post("/api/expenses")).send({
      title: "Generator fuel",
      amount: 45000,
      category: "Utilities",
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Expense recorded successfully.");
    expect(Number(res.body.data.amount)).toBe(45000);
  });

  it("rejects a negative amount", async () => {
    const res = await asA(request(app).post("/api/expenses")).send({
      title: "Impossible",
      amount: -100,
    });

    expect(res.status).toBe(400);
  });

  it("requires a title", async () => {
    const res = await asA(request(app).post("/api/expenses")).send({ amount: 100 });
    expect(res.status).toBe(400);
  });

  it("keeps each tenant's expenses separate", async () => {
    await asB(request(app).post("/api/expenses")).send({ title: "B Only Expense", amount: 1 });
    const res = await asA(request(app).get("/api/expenses"));

    expect(res.body.data.map((e: { title: string }) => e.title)).not.toContain("B Only Expense");
  });
});

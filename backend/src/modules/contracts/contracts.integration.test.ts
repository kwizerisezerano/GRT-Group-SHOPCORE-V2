import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { encryptNullable } from "../../lib/crypto";
import { signAccessToken } from "../../lib/jwt";
import { seedWorkspace } from "../../test/workspace";

/**
 * The contract endpoints, against a real app and a real database.
 *
 * ## Why these exist
 *
 * `/contracts/generate` was found hanging in the browser while the same
 * renderer, called directly, finished in 40ms — the sort of gap that is
 * invisible until something exercises the endpoint rather than the function.
 * These run the route through Express the way a request does, so a regression
 * in the wiring cannot hide behind a working renderer.
 *
 * The PDF assertions check bytes, not shape: a renderer that silently produces
 * an empty or truncated document still returns a Buffer.
 */

const app = createApp();

const TENANT = "c0c0c0c0-1111-4111-8111-c0c0c0c0c0c0";
const USER = "c0c0c0c0-2222-4222-8222-c0c0c0c0c0c0";
const TEMPLATE = "c0c0c0c0-3333-4333-8333-c0c0c0c0c0c0";
const PLAN = "contract_test_plan";

/** A 100x50 PNG — a stand-in for a drawn signature. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAA8CAIAAAAiz+n/AAABvUlEQVR4nO2aXU7DMBAGfQQkbsD97wgPlaLKcvyX3dl1+UZ5I11PRqUlDuVXIJRogf+CQkMoNIRCQyg0hEJDKDSEQkMoNIRCQyg0hEJDKDREZOiv75/XEegwyXPVmNCXd3WEyPSx8gwIfVc5W+u+56oqHXpon6T1jOeSKhp60j689bznvCoXeuiXpPWMRt7Q82bhrScFVj2J0KtOgaGXVJdORkO7vuQ5G79M8y9xD72dDG69/ZGVIvSTWPCHtYlq55y8ock39fOFhhMcQ5tkAloznl6hDQN5t7aa359TnC7glNC2wzvTXEKbp/FrbT62F9pjJfMofjOZyy+nvPtO8bybbBz6uM9Tk1HNyXVo7GvXhCO+YJvzi+HCH/M3rwnVKmahT7mLw+7s26GBm31DTlF9X6vc/WBj3MfstBlyrdgO7bEha8vGorGe9V7HUrioytXqSyfzqu3Qfg/NzHkXyK/a3r0bXsP8RbpyiuftNmnl1z9w503VWM/b/egj7F8c4TnY+E9uf5Hfc/yEJa16RebKC4+ysnl3yKmq//iHUGgIhYZQaAiFhlBoCIWGUGgIhYZQaAiFhlBoCIWG+AMH5WnTeGeaBAAAAABJRU5ErkJggg==";

const BODY = `TEST SERVICE AGREEMENT

This agreement is made on {{today}} between ShopCore and {{company_name}},
TIN {{tin_number}}.

1. SUBSCRIPTION
   The Customer subscribes to the {{plan_name}} plan, billed {{billing_cycle}},
   at {{amount}} for {{period_start}} to {{period_end}}.

2. ACCOUNT
   Registered to {{owner_name}} ({{owner_email}}) on {{business_phone}}.`;

const token = signAccessToken({ sub: USER, tenantId: TENANT, role: "owner" });
const auth = { Authorization: `Bearer ${token}` };

/** Templates this suite stood down, restored in afterAll. */
let displaced: string[] = [];

const previewInput = {
  planCode: PLAN,
  billingCycle: "monthly",
  businessName: "Contract Test Shop",
  tinNumber: "102938475",
  businessPhone: "0788123456",
  businessAddress: "Kigali",
};

beforeAll(async () => {
  await seedWorkspace({ tenantId: TENANT, userId: USER, tenantName: "Contract Test Shop" });

  await prisma.subscriptionPlan.upsert({
    where: { code: PLAN },
    update: {},
    create: { code: PLAN, name: "Contract Test", isActive: true, isPublic: false },
  });

  await prisma.subscriptionPlanPrice.upsert({
    where: { plan_price_unique: { planCode: PLAN, billingCycle: "monthly" } },
    update: { finalPrice: 15000, listPrice: 15000, isActive: true },
    create: {
      planCode: PLAN,
      billingCycle: "monthly",
      billingMonths: 1,
      listPrice: 15000,
      finalPrice: 15000,
      currency: "RWF",
      isActive: true,
    },
  });

  /*
   * Stand down whatever else is live for the duration, and remember it.
   *
   * Exactly one template is served at a time, so a seeded template would
   * otherwise be the one these assertions run against. Restoring it in
   * `afterAll` matters more than it looks: leaving the installation with no
   * live contract means every signup afterwards fails at the signing step, and
   * a test suite that quietly breaks the database it ran against is worse than
   * one that fails.
   */
  displaced = (
    await prisma.contractTemplate.findMany({ where: { isActive: true }, select: { id: true } })
  ).map((row) => row.id);

  await prisma.contractTemplate.updateMany({ where: { isActive: true }, data: { isActive: false } });

  await prisma.contractTemplate.upsert({
    where: { id: TEMPLATE },
    update: { body: BODY, isActive: true },
    create: {
      id: TEMPLATE,
      name: "Test agreement",
      body: BODY,
      isActive: true,
      providerSignatureImage: PNG,
      providerStampImage: PNG,
      providerSignerName: "Test Director",
      providerSignerTitle: "Director, ShopCore",
    },
  });
});

afterAll(async () => {
  await prisma.signedContract.deleteMany({ where: { tenantId: TENANT } });
  await prisma.contractTemplate.deleteMany({ where: { id: TEMPLATE } });

  // Put the installation's own live template back.
  if (displaced.length > 0) {
    await prisma.contractTemplate.updateMany({
      where: { id: { in: displaced } },
      data: { isActive: true },
    });
  }
  await prisma.subscriptionPlanPrice.deleteMany({ where: { planCode: PLAN } });
  await prisma.subscriptionPlan.deleteMany({ where: { code: PLAN } });
});

describe("POST /api/contracts/preview", () => {
  it("fills every placeholder from the plan and the business details", async () => {
    const response = await request(app).post("/api/contracts/preview").set(auth).send(previewInput);

    expect(response.status).toBe(200);

    const { body } = response.body.data;
    expect(body).toContain("Contract Test Shop");
    expect(body).toContain("102938475");
    expect(body).toContain("RWF 15,000");
    expect(body.match(/\{\{[^}]+\}\}/g)).toBeNull();
  });

  it("ships the provider's countersignature, so the reader sees both sides", async () => {
    const response = await request(app).post("/api/contracts/preview").set(auth).send(previewInput);

    /*
     * These images were once withheld to save bandwidth, back when the signing
     * screen rendered only the clause text. It now renders the whole document,
     * and a contract shown with the provider's signature block simply absent
     * reads as though ShopCore has not agreed to anything — so the customer
     * sees who is countersigning before they pay, not after.
     */
    expect(response.body.data.template).toEqual({
      id: TEMPLATE,
      name: "Test agreement",
      version: expect.any(Number),
      provider_signature_image: PNG,
      provider_stamp_image: PNG,
      provider_signer_name: "Test Director",
      provider_signer_title: "Director, ShopCore",
    });
  });

  it("names both parties, so neither side is identified by brand alone", async () => {
    const response = await request(app).post("/api/contracts/preview").set(auth).send(previewInput);

    const { provider, customer } = response.body.data;

    // Falls back to the brand name and Kigali when a template carries no
    // registered details — never to an empty provider block.
    expect(provider.legal_name).toBeTruthy();
    expect(provider.governing_law).toBeTruthy();

    expect(customer.legal_name).toBe("Contract Test Shop");
    expect(customer.tin).toBe("102938475");
  });

  it("spells the amount out beside the figure", async () => {
    const response = await request(app).post("/api/contracts/preview").set(auth).send(previewInput);

    // A figure alone can be altered by one keystroke and still look right.
    expect(response.body.data.amount_in_words).toBe("fifteen thousand");
    expect(response.body.data.term_months).toBeGreaterThan(0);
  });

  it("refuses an unauthenticated caller", async () => {
    const response = await request(app).post("/api/contracts/preview").send(previewInput);
    expect(response.status).toBe(401);
  });
});

describe("POST /api/contracts/generate", () => {
  it("returns a real PDF", async () => {
    const response = await request(app)
      .post("/api/contracts/generate")
      .set(auth)
      .send({ ...previewInput, signatureImage: PNG, stampImage: PNG, signerName: "Jean Uwimana" })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.body.subarray(0, 5).toString()).toBe("%PDF-");
    // A header-only PDF is about 700 bytes; a real one with two images is not.
    expect(response.body.length).toBeGreaterThan(2000);
  }, 30_000);

  it("rejects a signature that is not an image", async () => {
    const response = await request(app)
      .post("/api/contracts/generate")
      .set(auth)
      .send({
        ...previewInput,
        signatureImage: "javascript:alert(1)",
        signerName: "Jean Uwimana",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_signature_image");
  });

  it("rejects an image beyond the size ceiling", async () => {
    const response = await request(app)
      .post("/api/contracts/generate")
      .set(auth)
      .send({
        ...previewInput,
        signatureImage: `data:image/png;base64,${"A".repeat(2_000_001)}`,
        signerName: "Jean Uwimana",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("signature_image_too_large");
  }, 20_000);
});

describe("GET /api/contracts/mine", () => {
  it("is a 404 until something has been signed", async () => {
    const response = await request(app).get("/api/contracts/mine").set(auth);
    expect(response.status).toBe(404);
  });

  it("returns both parties once a contract is filed", async () => {
    await prisma.signedContract.create({
      data: {
        tenantId: TENANT,
        templateId: TEMPLATE,
        templateName: "Test agreement",
        templateVersion: 1,
        body: "TEST SERVICE AGREEMENT\n\n1. SUBSCRIPTION\n   Filed copy.",
        signerName: "Jean Uwimana",
        signatureImage: PNG,
        stampImage: PNG,
        providerSignatureImage: PNG,
        providerStampImage: PNG,
        providerSignerName: "Test Director",
        providerSignerTitle: "Director, ShopCore",
        providerLegalName: "GRT Group Ltd",
        providerTin: "102938475",
        providerAddress: "KG 7 Ave, Kacyiru, Kigali",
        governingLaw: "the Republic of Rwanda",
        customerLegalName: "Contract Test Shop",
        customerTin: "887766554",
        customerAddress: "KN 4 Ave, Nyarugenge, Kigali",
        customerPhoneEncrypted: encryptNullable("+250788123456"),
        planCode: PLAN,
        planName: "Contract Test",
        billingCycle: "monthly",
        amount: 15000,
        currency: "RWF",
      },
    });

    const response = await request(app).get("/api/contracts/mine").set(auth);

    expect(response.status).toBe(200);
    expect(response.body.data.signer_name).toBe("Jean Uwimana");
    expect(response.body.data.signature_image).toBe(PNG);
    expect(response.body.data.provider_signature_image).toBe(PNG);
    expect(response.body.data.provider_signer_name).toBe("Test Director");
  });

  it("hands back both parties as they stood on the day it was signed", async () => {
    const response = await request(app).get("/api/contracts/mine").set(auth);
    const { provider, customer } = response.body.data;

    /*
     * Snapshotted, not resolved live. ShopCore moving office, or the customer
     * correcting their address, must not rewrite an agreement already made —
     * so these come off the signature row rather than off the template and the
     * tenant.
     */
    expect(provider.legal_name).toBe("GRT Group Ltd");
    expect(provider.tin).toBe("102938475");
    expect(provider.governing_law).toBe("the Republic of Rwanda");

    expect(customer.legal_name).toBe("Contract Test Shop");
    expect(customer.tin).toBe("887766554");

    // Stored encrypted, handed back readable — a ciphertext envelope on the
    // page would look like a rendering fault rather than a decryption one.
    expect(customer.phone).toBe("+250788123456");
    expect(JSON.stringify(response.body)).not.toContain("customer_phone_encrypted");
  });

  it("renders the filed contract as a PDF", async () => {
    const response = await request(app)
      .get("/api/contracts/mine/pdf")
      .set(auth)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(response.headers["content-disposition"]).toContain("attachment");
  }, 30_000);
});

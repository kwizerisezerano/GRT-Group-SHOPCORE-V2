import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { emailBlindIndex } from "../../lib/crypto";
import { signAccessToken } from "../../lib/jwt";
import { hashPassword } from "../../lib/password";

/**
 * The signing PIN, and the gate it stands in front of.
 *
 * ## Why this is worth an integration test
 *
 * The PIN exists to stop one specific thing: ShopCore's signature being
 * attached to the agreement every future customer signs, by somebody who is not
 * the admin whose session is open. A gate that can be walked around by omitting
 * a field is not a gate, and the way that failure shows up in production is a
 * contract nobody in the company remembers countersigning.
 *
 * So what is proved here is the boundary itself:
 *
 *   - a signature cannot be attached without the PIN, or with a wrong one;
 *   - the same request with the right PIN goes through;
 *   - editing the *wording* never asks for one, because a PIN demanded on
 *     every save is a PIN people type without reading;
 *   - a template that already carries a signature can be renamed without
 *     re-confirming, for the same reason;
 *   - wrong tries are counted and eventually lock, which is the only thing
 *     making four digits defensible.
 */

const app = createApp();

const ADMIN = "aa11bb22-9999-4999-8999-000000000042";
const PASSWORD = "correct-horse-battery-staple";
const PIN = "8261";

const token = signAccessToken({ sub: ADMIN, tenantId: null, role: null });
const as = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

/** A 120x60 PNG standing in for a scanned signature. Genuinely valid. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAA8CAIAAAAiz+n/AAABvUlEQVR4nO2aXU7DMBAGfQQkbsD97wgPlaLKcvyX3dl1+UZ5I11PRqUlDuVXIJRogf+CQkMoNIRCQyg0hEJDKDSEQkMoNIRCQyg0hEJDKDREZOiv75/XEegwyXPVmNCXd3WEyPSx8gwIfVc5W+u+56oqHXpon6T1jOeSKhp60j689bznvCoXeuiXpPWMRt7Q82bhrScFVj2J0KtOgaGXVJdORkO7vuQ5G79M8y9xD72dDG69/ZGVIvSTWPCHtYlq55y8ock39fOFhhMcQ5tkAloznl6hDQN5t7aa359TnC7glNC2wzvTXEKbp/FrbT62F9pjJfMofjOZyy+nvPtO8bybbBz6uM9Tk1HNyXVo7GvXhCO+YJvzi+HCH/M3rwnVKmahT7mLw+7s26GBm31DTlF9X6vc/WBj3MfstBlyrdgO7bEha8vGorGe9V7HUrioytXqSyfzqu3Qfg/NzHkXyK/a3r0bXsP8RbpyiuftNmnl1z9w503VWM/b/egj7F8c4TnY+E9uf5Hfc/yEJa16RebKC4+ysnl3yKmq//iHUGgIhYZQaAiFhlBoCIWGUGgIhYZQaAiFhlBoCIWG+AMH5WnTeGeaBAAAAABJRU5ErkJggg==";

const NAME = "PIN gate test template";

/** Removes only what this file made, by name, so a real template survives. */
async function removeTestTemplates() {
  await prisma.contractTemplate.deleteMany({ where: { name: { startsWith: NAME } } });
}

beforeAll(async () => {
  await removeTestTemplates();
  await prisma.user.deleteMany({ where: { id: ADMIN } });

  await prisma.user.create({
    data: {
      id: ADMIN,
      emailEncrypted: "x",
      emailHash: emailBlindIndex("pin.admin@test.local"),
      passwordHash: await hashPassword(PASSWORD),
      isPlatformAdmin: true,
    },
  });
});

afterAll(async () => {
  await removeTestTemplates();
  await prisma.user.deleteMany({ where: { id: ADMIN } });
});

/** Each test starts from a known PIN with a clean attempt counter. */
beforeEach(async () => {
  await prisma.user.update({
    where: { id: ADMIN },
    data: {
      signingPinHash: await hashPassword(PIN),
      signingPinSetAt: new Date(),
      signingPinFailedAttempts: 0,
      signingPinLockedUntil: null,
    },
  });
});

const draft = (overrides: Record<string, unknown> = {}) => ({
  name: NAME,
  body: "TEST AGREEMENT\n\n1. TERMS\n   The customer agrees.",
  ...overrides,
});

describe("the signing PIN itself", () => {
  it("reports whether one is set without ever handing it back", async () => {
    const response = await as(request(app).get("/api/platform/signing-pin"));

    expect(response.status).toBe(200);
    expect(response.body.data.configured).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(PIN);
  });

  it("refuses to set a PIN without the account password", async () => {
    const response = await as(
      request(app).put("/api/platform/signing-pin").send({ pin: "4917", password: "wrong" }),
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("password_incorrect");
  });

  it("refuses the PINs everybody tries first", async () => {
    for (const weak of ["1111", "1234", "4321", "0000", "123"]) {
      const response = await as(
        request(app).put("/api/platform/signing-pin").send({ pin: weak, password: PASSWORD }),
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("signing_pin_weak");
    }
  });
});

describe("attaching ShopCore's signature", () => {
  it("is refused with no PIN at all", async () => {
    const response = await as(
      request(app)
        .post("/api/platform/contract-templates")
        .send(draft({ providerSignatureImage: PNG })),
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("signing_pin_required");
    expect(await prisma.contractTemplate.count({ where: { name: NAME } })).toBe(0);
  });

  it("is refused with the wrong PIN, and nothing is written", async () => {
    const response = await as(
      request(app)
        .post("/api/platform/contract-templates")
        .send(draft({ providerSignatureImage: PNG, pin: "9999" })),
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("signing_pin_incorrect");
    expect(await prisma.contractTemplate.count({ where: { name: NAME } })).toBe(0);
  });

  it("goes through with the right PIN, and records who attached it", async () => {
    const response = await as(
      request(app)
        .post("/api/platform/contract-templates")
        .send(draft({ providerSignatureImage: PNG, providerSignerName: "A Director", pin: PIN })),
    );

    expect(response.status).toBe(201);
    expect(response.body.data.provider_signature_image).toBe(PNG);
    expect(response.body.data.signature_attached_at).toBeTruthy();

    const stored = await prisma.contractTemplate.findUnique({
      where: { id: response.body.data.id },
      select: { signatureAttachedBy: true },
    });

    expect(stored?.signatureAttachedBy).toBe(ADMIN);
  });
});

describe("editing that is not signing", () => {
  it("never asks for a PIN to change the wording", async () => {
    const response = await as(
      request(app).post("/api/platform/contract-templates").send(draft()),
    );

    expect(response.status).toBe(201);
    expect(response.body.data.provider_signature_image).toBeNull();
  });

  it("lets a signed template be renamed without re-confirming", async () => {
    const created = await as(
      request(app)
        .post("/api/platform/contract-templates")
        .send(draft({ providerSignatureImage: PNG, pin: PIN })),
    );

    /*
     * The console sends the whole draft back on every save, signature
     * included. That must not read as a fresh attach, or the PIN becomes a box
     * you dismiss rather than a confirmation you mean.
     */
    const renamed = await as(
      request(app)
        .put(`/api/platform/contract-templates/${created.body.data.id}`)
        .send({ name: `${NAME} renamed`, providerSignatureImage: PNG }),
    );

    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe(`${NAME} renamed`);
  });
});

describe("guessing", () => {
  it("locks after five wrong tries rather than letting a script walk it", async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await as(
        request(app)
          .post("/api/platform/contract-templates")
          .send(draft({ providerSignatureImage: PNG, pin: "9999" })),
      );

      expect(response.status).toBe(403);
    }

    const fifth = await as(
      request(app)
        .post("/api/platform/contract-templates")
        .send(draft({ providerSignatureImage: PNG, pin: "9999" })),
    );

    expect(fifth.status).toBe(429);
    expect(fifth.body.error.code).toBe("signing_pin_locked");

    // And the correct PIN is refused too while the lockout stands — otherwise
    // the lock would only inconvenience the person who knows it.
    const correct = await as(
      request(app)
        .post("/api/platform/contract-templates")
        .send(draft({ providerSignatureImage: PNG, pin: PIN })),
    );

    expect(correct.status).toBe(429);
  });
});

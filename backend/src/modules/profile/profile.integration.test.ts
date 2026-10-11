import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { phoneBlindIndexNullable } from "../../lib/crypto";
import { signAccessToken } from "../../lib/jwt";
import { seedWorkspace } from "../../test/workspace";

/**
 * A person editing their own profile.
 *
 * Small surface, but it is one of the few places a user writes their own PII,
 * and the properties that matter are the storage ones: the display name and
 * phone number are encrypted at rest, the phone is additionally kept as a
 * keyed blind index so it can be looked up and uniquely constrained without
 * being readable, and neither is ever addressable by anyone but the owner.
 *
 * The endpoint takes no user id — it resolves the profile from the token —
 * so the test that matters is that two accounts editing at the same time
 * cannot land on each other's row.
 */

const app = createApp();

const TENANT = "f6f6f6f6-7777-4777-8777-f6f6f6f6f6f6";
const ALICE = "f6f6f6f6-7777-4777-8777-000000000001";
const BOB = "f6f6f6f6-7777-4777-8777-000000000002";

const tokenFor = (userId: string) =>
  signAccessToken({ sub: userId, tenantId: TENANT, role: "owner" });

const SHARED_PHONE = "+250788000111";

async function cleanup() {
  await prisma.profile.deleteMany({ where: { id: { in: [ALICE, BOB] } } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenant.deleteMany({ where: { id: TENANT } });
  await prisma.user.deleteMany({ where: { id: { in: [ALICE, BOB] } } });
}

beforeAll(async () => {
  await cleanup();
  await seedWorkspace({ tenantId: TENANT, userId: ALICE, role: "owner", tenantName: "Profiles" });
  await seedWorkspace({ tenantId: TENANT, userId: BOB, role: "admin", tenantName: "Profiles" });
});

afterAll(cleanup);

beforeEach(async () => {
  await prisma.profile.deleteMany({ where: { id: { in: [ALICE, BOB] } } });
});

describe("own profile", () => {
  it("requires a session", async () => {
    await request(app).get("/api/profile").expect(401);
    await request(app).patch("/api/profile").send({ displayName: "Nobody" }).expect(401);
  });

  it("saves a display name and reads it back decrypted", async () => {
    await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${tokenFor(ALICE)}`)
      .send({ displayName: "Alice Uwase" })
      .expect(200);

    const response = await request(app)
      .get("/api/profile")
      .set("Authorization", `Bearer ${tokenFor(ALICE)}`)
      .expect(200);

    expect(JSON.stringify(response.body.data)).toContain("Alice Uwase");
  });

  it("stores the name encrypted rather than in the clear", async () => {
    await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${tokenFor(ALICE)}`)
      .send({ displayName: "Alice Uwase" })
      .expect(200);

    const row = await prisma.profile.findUnique({ where: { id: ALICE } });
    expect(row?.displayNameEncrypted).toBeTruthy();
    // Readable only through the decrypting layer — never straight off the column.
    expect(row?.displayNameEncrypted).not.toContain("Alice Uwase");
  });

  it("stores the phone encrypted and indexed, not in the clear", async () => {
    await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${tokenFor(ALICE)}`)
      .send({ phone: SHARED_PHONE })
      .expect(200);

    const row = await prisma.profile.findUnique({ where: { id: ALICE } });
    expect(row?.phoneEncrypted).toBeTruthy();
    expect(row?.phoneEncrypted).not.toContain(SHARED_PHONE);

    // The blind index is what makes the number searchable and unique
    // without being readable, so it has to be the keyed hash, not the value.
    expect(row?.phoneHash).toBe(phoneBlindIndexNullable(SHARED_PHONE));
    expect(row?.phoneHash).not.toContain(SHARED_PHONE);
  });

  it("refuses a phone number another account already holds", async () => {
    await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${tokenFor(ALICE)}`)
      .send({ phone: SHARED_PHONE })
      .expect(200);

    /*
     * The number is a unique blind index across profiles, so this has to be
     * refused as a clean conflict rather than surfacing as a 500 from the
     * database constraint.
     */
    const conflict = await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${tokenFor(BOB)}`)
      .send({ phone: SHARED_PHONE });

    expect(conflict.status).toBeGreaterThanOrEqual(400);
    expect(conflict.status).toBeLessThan(500);

    const bobRow = await prisma.profile.findUnique({ where: { id: BOB } });
    expect(bobRow?.phoneHash ?? null).toBeNull();
  });

  it("lets the same account re-save the number it already has", async () => {
    await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${tokenFor(ALICE)}`)
      .send({ phone: SHARED_PHONE })
      .expect(200);

    // Saving the form again without changing the number must not read as a
    // clash with itself.
    await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${tokenFor(ALICE)}`)
      .send({ phone: SHARED_PHONE })
      .expect(200);
  });

  it("writes only to the caller's own profile", async () => {
    await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${tokenFor(ALICE)}`)
      .send({ displayName: "Alice Uwase" })
      .expect(200);

    await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${tokenFor(BOB)}`)
      .send({ displayName: "Bob Nkurunziza" })
      .expect(200);

    const alice = await prisma.profile.findUnique({ where: { id: ALICE } });
    const bob = await prisma.profile.findUnique({ where: { id: BOB } });

    expect(alice?.displayNameEncrypted).toBeTruthy();
    expect(bob?.displayNameEncrypted).toBeTruthy();
    // Different plaintext, so different ciphertext — neither overwrote the other.
    expect(alice?.displayNameEncrypted).not.toBe(bob?.displayNameEncrypted);
  });
});

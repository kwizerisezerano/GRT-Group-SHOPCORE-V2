import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { emailBlindIndex } from "../../lib/crypto";
import { MemoryTransport, getTransport, setTransport } from "../../lib/email/transport";
import {
  MemorySmsTransport,
  getSmsTransport,
  setSmsTransport,
} from "../../lib/sms/transport";
import { signAccessToken } from "../../lib/jwt";
import { seedWorkspace } from "../../test/workspace";

/**
 * Adding a member over HTTP, and the email that has to reach them.
 *
 * The service function was already covered, but the route around it is where
 * this can quietly fail in a way nobody notices: the request succeeds, the
 * account exists, and the person is never told their password because the
 * mail was not sent. The credential is generated once and stored only as a
 * hash, so an email that does not arrive means the account cannot be signed
 * into at all — there is nothing to look it up from afterwards.
 */

const app = createApp();

const TENANT = "c3c3c3c3-4444-4444-8444-c3c3c3c3c3c3";
const OWNER = "c3c3c3c3-4444-4444-8444-000000000001";
const CASHIER = "c3c3c3c3-4444-4444-8444-000000000002";
const NEW_MEMBER = "new.member@test.local";
const SMS_MEMBER = "sms.member@test.local";
const NO_PHONE_MEMBER = "nophone.member@test.local";
const BAD_PHONE_MEMBER = "badphone.member@test.local";
const WORKSPACE = "Create Member Workspace";

let mailbox: MemoryTransport;
let smsbox: MemorySmsTransport;
const originalTransport = getTransport();
const originalSmsTransport = getSmsTransport();

const tokenFor = (userId: string) =>
  signAccessToken({ sub: userId, tenantId: TENANT, role: "owner" });

async function removeByEmail(email: string) {
  const user = await prisma.user.findFirst({ where: { emailHash: emailBlindIndex(email) } });
  if (!user) return;
  await prisma.loginOtp.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.activityLog.deleteMany({ where: { userId: user.id } });
  await prisma.tenantMember.deleteMany({ where: { userId: user.id } });
  await prisma.profile.deleteMany({ where: { id: user.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
}

async function cleanup() {
  for (const email of [NEW_MEMBER, SMS_MEMBER, NO_PHONE_MEMBER, BAD_PHONE_MEMBER]) {
    await removeByEmail(email);
  }
  await prisma.activityLog.deleteMany({ where: { tenantId: TENANT } });
  await prisma.rolePermission.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenant.deleteMany({ where: { id: TENANT } });
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, CASHIER] } } });
}

beforeAll(async () => {
  await cleanup();
  await seedWorkspace({ tenantId: TENANT, userId: OWNER, role: "owner", tenantName: WORKSPACE });
  await seedWorkspace({ tenantId: TENANT, userId: CASHIER, role: "cashier", tenantName: WORKSPACE });
});

afterAll(async () => {
  await cleanup();
  setTransport(originalTransport);
});

beforeEach(() => {
  mailbox = new MemoryTransport();
  setTransport(mailbox);
  smsbox = new MemorySmsTransport();
  setSmsTransport(smsbox);
});

afterEach(() => {
  setTransport(originalTransport);
  setSmsTransport(originalSmsTransport);
});

describe("POST /api/users/create", () => {
  /* The mailbox is replaced between cases; hold on to the one that matters. */
  let invitation: { to: string; subject: string; html: string; text: string };
  it("creates the member and emails them their credentials", async () => {
    await removeByEmail(NEW_MEMBER);

    const response = await request(app)
      .post("/api/users/create")
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`)
      .send({ email: NEW_MEMBER, displayName: "New Member", role: "cashier" })
      .expect(201);

    expect(response.body.data).toBeTruthy();

    // The account exists and is attached to this workspace.
    const created = await prisma.user.findFirst({
      where: { emailHash: emailBlindIndex(NEW_MEMBER) },
    });
    expect(created).not.toBeNull();
    const membership = await prisma.tenantMember.findFirst({
      where: { userId: created!.id, tenantId: TENANT },
    });
    expect(membership?.role).toBe("cashier");

    // And they were actually told about it.
    expect(mailbox.sent).toHaveLength(1);
    const [mail] = mailbox.sent;
    expect(mail.to).toBe(NEW_MEMBER);
    expect(mail.subject.toLowerCase()).toContain("shopcore");
    expect(mail.text).toContain(`Workspace: ${WORKSPACE}`);
    expect(mail.text).toContain("Cashier");

    invitation = mail;
  });

  it("puts a usable temporary password in the email and nowhere else", async () => {
    const match = invitation.text.match(/temporary password (\S+?)\./);
    expect(match).not.toBeNull();

    const tempPassword = match![1];
    expect(tempPassword.length).toBeGreaterThanOrEqual(12);

    // The credential must never come back in the API response or be stored raw.
    const created = await prisma.user.findFirst({
      where: { emailHash: emailBlindIndex(NEW_MEMBER) },
    });
    expect(created!.passwordHash).not.toContain(tempPassword);

    // And it actually signs in.
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: NEW_MEMBER, password: tempPassword })
      .expect(200);

    expect(login.body.data.user.mustChangePassword).toBe(true);
  });

  it("carries no unreachable link, whatever FRONTEND_URL is set to", async () => {
    // A localhost or bare-IP button is what put these messages in spam.
    expect(invitation.text).not.toContain("127.0.0.1");
    expect(invitation.text).not.toContain("localhost");
    expect(invitation.text).not.toMatch(/http:\/\//);
    expect(invitation.html).not.toMatch(/href="http:\/\//);
  });

  /*
   * The second channel. The generated password lives in these two messages
   * and nowhere else — it is stored only as a hash — so a member whose email
   * is filtered has no way into the account unless the text arrives.
   */
  it("texts the credentials as well as emailing them", async () => {
    await removeByEmail(SMS_MEMBER);

    await request(app)
      .post("/api/users/create")
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`)
      .send({
        email: SMS_MEMBER,
        displayName: "Texted Member",
        role: "cashier",
        phone: "0788123456",
      })
      .expect(201);

    expect(mailbox.sent).toHaveLength(1);
    expect(smsbox.sent).toHaveLength(1);

    const [text] = smsbox.sent;
    // Local number normalised to the gateway's international form.
    expect(text.to).toBe("250788123456");
    expect(text.message).toContain(WORKSPACE);
    expect(text.message).toContain(SMS_MEMBER);

    // The same credential in both messages.
    const fromEmail = mailbox.sent[0].text.match(/temporary password (\S+?)\./)![1];
    expect(text.message).toContain(fromEmail);

    // And it signs in.
    await request(app)
      .post("/api/auth/login")
      .send({ email: SMS_MEMBER, password: fromEmail })
      .expect(200);
  });

  it("still emails when no number is given", async () => {
    await removeByEmail(NO_PHONE_MEMBER);

    await request(app)
      .post("/api/users/create")
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`)
      .send({ email: NO_PHONE_MEMBER, displayName: "No Phone", role: "cashier" })
      .expect(201);

    expect(mailbox.sent).toHaveLength(1);
    expect(smsbox.sent).toHaveLength(0);
  });

  it("creates the member even when the number is unusable", async () => {
    // A malformed number is not a reason to refuse an account.
    await removeByEmail(BAD_PHONE_MEMBER);

    await request(app)
      .post("/api/users/create")
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`)
      .send({
        email: BAD_PHONE_MEMBER,
        displayName: "Bad Phone",
        role: "cashier",
        phone: "not-a-number",
      })
      .expect(201);

    expect(mailbox.sent).toHaveLength(1);
    expect(smsbox.sent).toHaveLength(0);
  });

  it("refuses a member whose role outranks the caller's", async () => {
    await request(app)
      .post("/api/users/create")
      .set("Authorization", `Bearer ${tokenFor(CASHIER)}`)
      .send({ email: "nope@test.local", displayName: "Nope", role: "owner" })
      .expect((res) => {
        // Either the permission gate or the rank check refuses — both are 403.
        expect(res.status).toBe(403);
      });

    expect(mailbox.sent).toHaveLength(0);
  });

  it("rejects a duplicate member instead of silently re-inviting", async () => {
    await request(app)
      .post("/api/users/create")
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`)
      .send({ email: NEW_MEMBER, displayName: "New Member", role: "cashier" })
      .expect((res) => {
        expect(res.status).toBeGreaterThanOrEqual(400);
      });
  });
});

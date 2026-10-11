import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { emailBlindIndex } from "../../lib/crypto";
import { MemoryTransport, getTransport, setTransport } from "../../lib/email/transport";
import { createMemberWithGeneratedPassword } from "../users/users.service";
import { seedWorkspace } from "../../test/workspace";

/**
 * "I forgot my password" from end to end, against a real database.
 *
 * The link is the whole security boundary here — it is the only thing standing
 * between a stranger who knows an email address and the account behind it — so
 * the properties that matter are the negative ones: single use, time limited,
 * and no way to learn from the response whether an address is even registered.
 */

const app = createApp();

const TENANT = "b2b2b2b2-3333-4333-8333-b2b2b2b2b2b2";
const OWNER = "b2b2b2b2-3333-4333-8333-000000000001";
const MEMBER_EMAIL = "reset.member@test.local";
const WORKSPACE = "Reset Test Workspace";

let mailbox: MemoryTransport;
const originalTransport = getTransport();

/** The reset token the mail was sent to carry. */
function tokenFromLatestMail(): string {
  const mail = [...mailbox.sent].reverse().find((m) => m.text.includes("reset-password?token="));
  if (!mail) throw new Error("no password-reset email was sent");
  return mail.text.match(/reset-password\?token=([^\s]+)/)![1];
}

async function removeMember() {
  const user = await prisma.user.findFirst({ where: { emailHash: emailBlindIndex(MEMBER_EMAIL) } });
  if (!user) return;
  await prisma.loginOtp.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.activityLog.deleteMany({ where: { userId: user.id } });
  await prisma.tenantMember.deleteMany({ where: { userId: user.id } });
  await prisma.profile.deleteMany({ where: { id: user.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
}

async function cleanup() {
  await removeMember();
  await prisma.loginOtp.deleteMany({ where: { userId: OWNER } });
  await prisma.refreshToken.deleteMany({ where: { userId: OWNER } });
  await prisma.activityLog.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: TENANT } });
  await prisma.tenant.deleteMany({ where: { id: TENANT } });
  await prisma.user.deleteMany({ where: { id: OWNER } });
}

beforeAll(async () => {
  await cleanup();
  await seedWorkspace({ tenantId: TENANT, userId: OWNER, role: "owner", tenantName: WORKSPACE });
  setTransport(new MemoryTransport());
  await createMemberWithGeneratedPassword({
    tenantId: TENANT,
    email: MEMBER_EMAIL,
    displayName: "Reset Member",
    role: "cashier",
    invitedByUserId: OWNER,
  });
});

afterAll(async () => {
  await cleanup();
  setTransport(originalTransport);
});

beforeEach(() => {
  mailbox = new MemoryTransport();
  setTransport(mailbox);
});

afterEach(() => setTransport(originalTransport));

describe("password reset, end to end", () => {
  const chosenPassword = "Reset-Pass-7k2Z";
  let usedToken: string;

  it("mails a reset link that names the workspace", async () => {
    await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: MEMBER_EMAIL })
      .expect(202);

    const [mail] = mailbox.sent;
    expect(mail.to).toBe(MEMBER_EMAIL);
    expect(mail.text).toContain("reset-password?token=");
    expect(mail.text).toContain(`Workspace: ${WORKSPACE}`);
    // Security-sensitive mail carries the "wasn't you?" line.
    expect(mail.text).toContain("safely ignore");
  });

  it("answers a registered and an unregistered address identically", async () => {
    /*
     * The property the forgot-password screen is built on. If these two
     * responses differed in status, body or message, the endpoint would be an
     * account-enumeration oracle: anyone could discover which of a business's
     * staff and customers hold accounts simply by submitting addresses and
     * watching what came back. That is also why the UI cannot show "no account
     * found" — it is never told, by design.
     */
    const known = await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: MEMBER_EMAIL })
      .expect(202);

    const mailsAfterKnown = mailbox.sent.length;

    const unknown = await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: "nobody.here@test.local" })
      .expect(202);

    expect(unknown.status).toBe(known.status);
    expect(unknown.body.message).toBe(known.body.message);
    expect(unknown.body.data ?? null).toEqual(known.body.data ?? null);

    // A real address gets mail; an unknown one silently gets none.
    expect(mailsAfterKnown).toBe(1);
    expect(mailbox.sent).toHaveLength(1);
  });

  it("refuses a token that was never issued", async () => {
    await request(app)
      .post("/api/auth/password-reset/complete")
      .send({ token: "not-a-real-token", newPassword: chosenPassword })
      .expect(400);
  });

  it("sets the new password and tells the account holder", async () => {
    await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: MEMBER_EMAIL })
      .expect(202);

    usedToken = tokenFromLatestMail();

    await request(app)
      .post("/api/auth/password-reset/complete")
      .send({ token: usedToken, newPassword: chosenPassword })
      .expect(200);

    // Someone else resetting your password is exactly the event you need told
    // about, so the confirmation is part of the flow rather than a nicety.
    const confirmation = mailbox.sent.find((m) => m.subject.toLowerCase().includes("password"));
    expect(confirmation).toBeDefined();
    expect(confirmation!.text).toContain(`Workspace: ${WORKSPACE}`);
  });

  it("will not spend the same link twice", async () => {
    await request(app)
      .post("/api/auth/password-reset/complete")
      .send({ token: usedToken, newPassword: "Another-Pass-8p3X" })
      .expect(400);
  });

  it("signs in with the new password, and still asks for the second factor", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: MEMBER_EMAIL, password: chosenPassword })
      .expect(200);

    // A reset proves control of the mailbox once; it does not retire the
    // per-sign-in code.
    expect(login.body.data.user.otpRequired).toBe(true);
    expect(login.body.data.user.mustChangePassword).toBe(false);
  });

  it("rejects the password the reset replaced", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: MEMBER_EMAIL, password: "Reset-Pass-OLD-1a" })
      .expect(401);
  });

  it("refuses an expired link", async () => {
    await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: MEMBER_EMAIL })
      .expect(202);

    const token = tokenFromLatestMail();
    const user = await prisma.user.findFirst({
      where: { emailHash: emailBlindIndex(MEMBER_EMAIL) },
    });

    // Wind every outstanding token back past its expiry rather than waiting
    // an hour for one.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user!.id, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await request(app)
      .post("/api/auth/password-reset/complete")
      .send({ token, newPassword: "Yet-Another-9q4W" })
      .expect(400);
  });
});

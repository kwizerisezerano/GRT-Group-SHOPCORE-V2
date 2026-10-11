import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../db/prisma";
import { emailBlindIndex } from "../../lib/crypto";
import { MemoryTransport, getTransport, setTransport } from "../../lib/email/transport";
import { createMemberWithGeneratedPassword } from "../users/users.service";
import { seedWorkspace } from "../../test/workspace";

/**
 * The whole sign-in chain, end to end, against a real database.
 *
 * Every one of these steps was individually plausible and the chain was still
 * broken: the second factor is raised on *every* login (auth.service.ts
 * login()), so a flag that fails to clear does not inconvenience first-time
 * members — it locks the entire product. That is worth a test that walks the
 * whole path rather than one per endpoint.
 *
 * The codes are read out of the outbound mail rather than the database, which
 * also pins the thing the mail exists to do: carry a code the person can type,
 * and say which workspace is asking.
 */

const app = createApp();

const TENANT = "a1a1a1a1-2222-4222-8222-a1a1a1a1a1a1";
const OWNER = "a1a1a1a1-2222-4222-8222-000000000001";
const MEMBER_EMAIL = "chain.member@test.local";
const WORKSPACE = "Chain Test Workspace";

let mailbox: MemoryTransport;
const originalTransport = getTransport();

/** The six digits the verification mail was sent to carry. */
function codeFromLatestOtpMail(): string {
  const mail = [...mailbox.sent].reverse().find((m) => /\b\d{6}\b/.test(m.text));
  if (!mail) throw new Error("no verification email was sent");
  return mail.text.match(/\b\d{6}\b/)![0];
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

describe("first sign-in, end to end", () => {
  let tempPassword: string;
  let accessToken: string;
  let spentCode: string;

  const chosenPassword = "Chosen-Pass-9x4Q";

  it("mails a new member a temporary password, naming the workspace", async () => {
    await removeMember();

    await createMemberWithGeneratedPassword({
      tenantId: TENANT,
      email: MEMBER_EMAIL,
      displayName: "Chain Member",
      role: "cashier",
      invitedByUserId: OWNER,
    });

    const [mail] = mailbox.sent;
    expect(mail.to).toBe(MEMBER_EMAIL);
    expect(mail.html).toContain(WORKSPACE);
    expect(mail.text).toContain(`Workspace: ${WORKSPACE}`);

    // The credential is in the body by design — it exists nowhere else.
    const match = mail.text.match(/temporary password (\S+?)\./);
    expect(match).not.toBeNull();
    tempPassword = match![1];
    expect(tempPassword.length).toBeGreaterThanOrEqual(12);
  });

  it("signs in with the temporary password and asks for a new one first", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: MEMBER_EMAIL, password: tempPassword })
      .expect(200);

    const { user, accessToken: token, otp } = response.body.data;
    expect(user.mustChangePassword).toBe(true);
    // The password gate ranks ahead of the second factor, so no code yet:
    // changePassword() raises it at the end of that step instead.
    expect(user.otpRequired).toBe(false);
    expect(otp).toBeNull();

    accessToken = token;
  });

  it("raises the second factor and mails a code once a password is chosen", async () => {
    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: tempPassword, newPassword: chosenPassword })
      .expect(200);

    expect(response.body.data.user.otpRequired).toBe(true);
    expect(response.body.data.otp).not.toBeNull();

    const otpMail = [...mailbox.sent].reverse().find((m) => /\b\d{6}\b/.test(m.text));
    expect(otpMail).toBeDefined();
    // The code says nothing about who is asking — the header has to.
    expect(otpMail!.text).toContain(`Workspace: ${WORKSPACE}`);
  });

  it("holds the account at the verification step until the code is spent", async () => {
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.data.user.otpRequired).toBe(true);
    expect(me.body.data.user.mustChangePassword).toBe(false);
  });

  it("refuses a wrong code without clearing the gate", async () => {
    await request(app)
      .post("/api/auth/otp/verify")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ code: "000000" })
      .expect(400);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.data.user.otpRequired).toBe(true);
  });

  it("clears the gate on the right code, and /auth/me agrees", async () => {
    // Re-send: the wrong attempt above leaves the record with an attempt
    // count, and a resend is the recovery path a person would actually take.
    await request(app)
      .post("/api/auth/otp/request")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const code = codeFromLatestOtpMail();
    spentCode = code;

    const verified = await request(app)
      .post("/api/auth/otp/verify")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ code })
      .expect(200);

    expect(verified.body.data.user.otpRequired).toBe(false);

    /*
     * The assertion the whole chain exists for. The client re-reads /auth/me
     * immediately after verifying and routes on what comes back; if the flag
     * were still set here, the workspace would bounce the person straight
     * back to the verification screen they had just completed.
     */
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.data.user.otpRequired).toBe(false);
    expect(me.body.data.user.mustChangePassword).toBe(false);
    expect(me.body.data.tenant?.name).toBe(WORKSPACE);
  });

  it("will not spend the same code twice", async () => {
    await request(app)
      .post("/api/auth/otp/verify")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ code: spentCode })
      .expect(400);
  });

  it("asks for the factor again on the next sign-in, and clears it again", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: MEMBER_EMAIL, password: chosenPassword })
      .expect(200);

    // Every sign-in, not only the first: the password proves knowledge, the
    // code proves the mailbox.
    expect(login.body.data.user.otpRequired).toBe(true);
    expect(login.body.data.otp).not.toBeNull();

    const token = login.body.data.accessToken;
    const code = codeFromLatestOtpMail();

    await request(app)
      .post("/api/auth/otp/verify")
      .set("Authorization", `Bearer ${token}`)
      .send({ code })
      .expect(200);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(me.body.data.user.otpRequired).toBe(false);
  });

  /*
   * Every password change ends at the verification step, not just the first.
   * The gate the client relies on is otpRequired coming back true from the
   * change itself, together with a code already sent — so the screen has
   * something to check the moment it loads.
   */
  it("raises the factor again when the password is changed a second time", async () => {
    const secondPassword = "Second-Pass-4t7B";

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: MEMBER_EMAIL, password: chosenPassword })
      .expect(200);

    const token = login.body.data.accessToken;
    const code = codeFromLatestOtpMail();

    await request(app)
      .post("/api/auth/otp/verify")
      .set("Authorization", `Bearer ${token}`)
      .send({ code })
      .expect(200);

    // Now change the password again — this account is long past first sign-in.
    const changed = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: chosenPassword, newPassword: secondPassword })
      .expect(200);

    expect(changed.body.data.user.otpRequired).toBe(true);
    expect(changed.body.data.otp).not.toBeNull();
    expect(changed.body.data.wasFirstSignIn).toBe(false);

    // The workspace is out of reach until the new code is spent.
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(me.body.data.user.otpRequired).toBe(true);

    // And the code that was emailed works.
    await request(app)
      .post("/api/auth/otp/verify")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: codeFromLatestOtpMail() })
      .expect(200);
  });

  it("rejects the old temporary password once it has been replaced", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: MEMBER_EMAIL, password: tempPassword })
      .expect(401);
  });
});

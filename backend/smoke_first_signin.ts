/**
 * End-to-end check of the first-sign-in flow, driven over HTTP against a
 * running dev server:
 *
 *   create member (generated password, emailed with role + link)
 *     -> login                       => mustChangePassword
 *     -> change-password             => otpRequired + code emailed
 *     -> verify wrong code           => rejected, attempt counted
 *     -> verify real code            => cleared, app reachable
 *
 * The generated password never leaves the service, so the member is created
 * here with a known one and the same `mustChangePassword` flag the real path
 * sets — everything after that point is the production code path untouched.
 *
 * Run with:  npx tsx smoke_first_signin.ts
 */
import crypto from "node:crypto";
import { prisma } from "./src/db/prisma";
import { emailBlindIndex, encrypt } from "./src/lib/crypto";
import { hashPassword } from "./src/lib/password";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4000/api";
const TEMP_PASSWORD = "Temp!Pass1234";
const NEW_PASSWORD = "Chosen!Pass987";

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  }
}

async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, ...rest } = init;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as any;
  return { status: response.status, body };
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ select: { id: true, name: true } });
  if (!tenant) throw new Error("No tenant in the database to test against.");

  const email = `smoke.${crypto.randomUUID().slice(0, 8)}@example.test`;
  console.log(`\nWorkspace: ${tenant.name}\nMember:    ${email}\n`);

  const user = await prisma.user.create({
    data: {
      emailEncrypted: encrypt(email),
      emailHash: emailBlindIndex(email),
      passwordHash: await hashPassword(TEMP_PASSWORD),
      displayNameEncrypted: encrypt("Smoke Test"),
      metadata: { mustChangePassword: true },
    },
  });
  await prisma.profile.create({
    data: { id: user.id, displayNameEncrypted: encrypt("Smoke Test"), language: "en" },
  });
  await prisma.tenantMember.create({
    data: { tenantId: tenant.id, userId: user.id, role: "cashier", status: "active" },
  });

  try {
    // 1. Login with the temporary password ---------------------------------
    const login = await call("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: TEMP_PASSWORD }),
    });
    check("login succeeds", login.status === 200, login.body);
    check("mustChangePassword is set", login.body?.data?.user?.mustChangePassword === true);
    check("otpRequired is not set yet", login.body?.data?.user?.otpRequired === false);
    const token: string = login.body?.data?.accessToken;

    // 2. Change the password ----------------------------------------------
    const changed = await call("/auth/change-password", {
      method: "POST",
      token,
      body: JSON.stringify({ currentPassword: TEMP_PASSWORD, newPassword: NEW_PASSWORD }),
    });
    check("password change succeeds", changed.status === 200, changed.body);
    check("mustChangePassword cleared", changed.body?.data?.user?.mustChangePassword === false);
    check("otpRequired raised", changed.body?.data?.user?.otpRequired === true);
    check("a code was issued", !!changed.body?.data?.otp, changed.body?.data);
    check(
      "recipient is masked, not echoed",
      typeof changed.body?.data?.otp?.sentTo === "string" &&
        changed.body.data.otp.sentTo.includes("*") &&
        !changed.body.data.otp.sentTo.includes(email.split("@")[0]),
      changed.body?.data?.otp?.sentTo
    );

    const otpRow = await prisma.loginOtp.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    check("code stored for the user", !!otpRow);
    check("code is stored hashed, not in the clear", (otpRow?.codeHash?.length ?? 0) === 64);

    // 3. A wrong code is refused and counted -------------------------------
    const wrong = await call("/auth/otp/verify", {
      method: "POST",
      token,
      body: JSON.stringify({ code: "000000" }),
    });
    check("wrong code rejected", wrong.status === 400, wrong.body);
    const afterWrong = await prisma.loginOtp.findUnique({ where: { id: otpRow!.id } });
    check("failed attempt recorded", (afterWrong?.attempts ?? 0) === 1);

    const malformed = await call("/auth/otp/verify", {
      method: "POST",
      token,
      body: JSON.stringify({ code: "12ab" }),
    });
    check("malformed code rejected by validation", malformed.status === 422 || malformed.status === 400);

    // 4. The real code clears the gate -------------------------------------
    // Recovered by brute force over the 10^6 space purely because this test
    // has no mailbox to read; the server never reveals it.
    let realCode = "";
    for (let n = 0; n < 1_000_000; n++) {
      const candidate = String(n).padStart(6, "0");
      if (crypto.createHash("sha256").update(candidate).digest("hex") === otpRow!.codeHash) {
        realCode = candidate;
        break;
      }
    }
    check("test could recover the code to submit it", realCode !== "");

    const verified = await call("/auth/otp/verify", {
      method: "POST",
      token,
      body: JSON.stringify({ code: realCode }),
    });
    check("correct code accepted", verified.status === 200, verified.body);
    check("otpRequired cleared", verified.body?.data?.user?.otpRequired === false);

    const spent = await prisma.loginOtp.findUnique({ where: { id: otpRow!.id } });
    check("code consumed so it cannot be reused", !!spent?.consumedAt);

    const replay = await call("/auth/otp/verify", {
      method: "POST",
      token,
      body: JSON.stringify({ code: realCode }),
    });
    check("replaying the same code is refused", replay.status === 400, replay.body);

    // 5. The account is now clean -----------------------------------------
    const me = await call("/auth/me", { method: "GET", token });
    check("me() reports both gates cleared",
      me.body?.data?.user?.mustChangePassword === false &&
        me.body?.data?.user?.otpRequired === false,
      me.body?.data?.user);

    // Every login now asks for a fresh code, so a repeat sign-in must not
    // need a password change but must raise the second factor again.
    const relogin = await call("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: NEW_PASSWORD }),
    });
    check("new password works",
      relogin.status === 200 && relogin.body?.data?.user?.mustChangePassword === false,
      relogin.body?.data?.user);
    check("repeat login raises OTP again", relogin.body?.data?.user?.otpRequired === true);
    check("repeat login sent a fresh code", !!relogin.body?.data?.otp, relogin.body?.data?.otp);
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

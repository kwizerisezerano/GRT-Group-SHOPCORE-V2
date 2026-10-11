import { writeFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../src/db/prisma";
import { emailBlindIndex, encrypt } from "../src/lib/crypto";
import { generateRefreshToken, signAccessToken } from "../src/lib/jwt";
import { hashPassword } from "../src/lib/password";

/**
 * Fixtures for the contract end-to-end tests.
 *
 * ## Why this exists rather than the tests signing in
 *
 * Signing in raises an emailed one-time code, and the code is stored hashed —
 * by design, and rightly so. A browser test cannot read it back, and weakening
 * the second factor so a test can log in would be trading a real protection for
 * a convenience.
 *
 * So the session is minted here instead, the same way the login route mints it,
 * and the tests drop the tokens into local storage before their first
 * navigation. What is being tested is the contract flow, not the OTP — which
 * has its own tests.
 *
 * ## What it makes
 *
 *   - a platform admin with a known password and a known signing PIN;
 *   - a customer with no workspace yet, which is the state the signing screen
 *     is reached in;
 *   - a plan with a price, so the contract has an amount to state.
 *
 * Idempotent, and it writes nothing outside its own three accounts. Run with
 *
 *   npx tsx scripts/seed_e2e_contract_fixtures.ts
 */

const ADMIN_ID = "e2e0a000-0000-4000-8000-000000000001";
const CUSTOMER_ID = "e2e0c000-0000-4000-8000-000000000002";

const ADMIN_EMAIL = "e2e.contract.admin@shopcore.test";
const CUSTOMER_EMAIL = "e2e.contract.customer@shopcore.test";

const PASSWORD = "E2e@Contract2026";
const SIGNING_PIN = "8261";

const PLAN_CODE = "e2e_contract_plan";

/** Where the Playwright specs read the minted session from. */
const OUT = path.join(__dirname, "..", "..", "frontend", "tests", ".fixtures.json");

async function session(userId: string) {
  const accessToken = signAccessToken({ sub: userId, tenantId: null, role: null });
  const refresh = generateRefreshToken();

  await prisma.refreshToken.create({
    data: { userId, tokenHash: refresh.hash, expiresAt: refresh.expiresAt },
  });

  return { accessToken, refreshToken: refresh.token };
}

async function upsertUser(input: {
  id: string;
  email: string;
  displayName: string;
  platformAdmin: boolean;
  passwordHash: string;
}) {
  const emailHash = emailBlindIndex(input.email);

  /*
   * Matched on the blind index rather than the id: a previous run under a
   * different id would otherwise collide on the unique email hash and fail.
   */
  const existing = await prisma.user.findUnique({ where: { emailHash } });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: input.passwordHash,
        displayNameEncrypted: encrypt(input.displayName),
        isPlatformAdmin: input.platformAdmin,
        emailVerifiedAt: new Date(),
      },
    });
  }

  return prisma.user.create({
    data: {
      id: input.id,
      emailEncrypted: encrypt(input.email),
      emailHash,
      passwordHash: input.passwordHash,
      displayNameEncrypted: encrypt(input.displayName),
      isPlatformAdmin: input.platformAdmin,
      emailVerifiedAt: new Date(),
    },
  });
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  const admin = await upsertUser({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    displayName: "E2E Contract Admin",
    platformAdmin: true,
    passwordHash,
  });

  /* A known PIN, so the test can prove both the wrong one and the right one. */
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      signingPinHash: await hashPassword(SIGNING_PIN),
      signingPinSetAt: new Date(),
      signingPinFailedAttempts: 0,
      signingPinLockedUntil: null,
    },
  });

  const customer = await upsertUser({
    id: CUSTOMER_ID,
    email: CUSTOMER_EMAIL,
    displayName: "Aline Mukamana",
    platformAdmin: false,
    passwordHash,
  });

  /*
   * The customer must have no workspace: the signing screen sends anybody who
   * already has one to their billing page, which is correct behaviour and would
   * make the test navigate away from what it came to look at.
   */
  await prisma.tenantMember.deleteMany({ where: { userId: customer.id } });
  await prisma.signedContract.deleteMany({
    where: { tenant: { ownerId: customer.id } },
  });

  await prisma.subscriptionPlan.upsert({
    where: { code: PLAN_CODE },
    update: { name: "E2E Growth", isActive: true },
    create: {
      code: PLAN_CODE,
      name: "E2E Growth",
      description: "Plan used by the contract end-to-end tests.",
      isActive: true,
    },
  });

  const price = await prisma.subscriptionPlanPrice.findFirst({
    where: { planCode: PLAN_CODE, billingCycle: "six_months" },
  });

  if (price) {
    await prisma.subscriptionPlanPrice.update({
      where: { id: price.id },
      data: { listPrice: 180000, finalPrice: 180000, isActive: true },
    });
  } else {
    await prisma.subscriptionPlanPrice.create({
      data: {
        planCode: PLAN_CODE,
        billingCycle: "six_months",
        billingMonths: 6,
        listPrice: 180000,
        finalPrice: 180000,
        currency: "RWF",
        isActive: true,
      },
    });
  }

  const fixtures = {
    admin: { id: admin.id, email: ADMIN_EMAIL, ...(await session(admin.id)) },
    customer: { id: customer.id, email: CUSTOMER_EMAIL, ...(await session(customer.id)) },
    password: PASSWORD,
    signingPin: SIGNING_PIN,
    planCode: PLAN_CODE,
  };

  writeFileSync(OUT, `${JSON.stringify(fixtures, null, 2)}\n`);

  console.log(`Seeded contract e2e fixtures.`);
  console.log(`  admin:    ${ADMIN_EMAIL}`);
  console.log(`  customer: ${CUSTOMER_EMAIL}`);
  console.log(`  plan:     ${PLAN_CODE} (RWF 180,000 / 6 months)`);
  console.log(`  written:  ${OUT}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

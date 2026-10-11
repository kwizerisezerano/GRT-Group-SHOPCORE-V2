/**
 * Prints the pending sign-in code for an account, for local development.
 *
 *   npm run admin:code                      # the platform owner
 *   npm run admin:code -- someone@shop.rw   # anyone else
 *
 * ## Why this exists
 *
 * Every login raises a 6-digit code by email. That is correct for a real
 * deployment and wrong as a development dependency: it makes getting into your
 * own local database contingent on a mail provider, a domain's DNS, and a spam
 * filter. When any of those is having a bad day, the workspace is unreachable
 * and nothing about the failure says why.
 *
 * ## Why printing it is not a weakening
 *
 * The code is stored only as a SHA-256, so this recovers it the same way
 * anything could — by hashing all million candidates, which takes about a
 * second. Running it already requires the database credentials, and anyone
 * holding those can mint a session directly. It reveals nothing that access
 * did not already confer.
 *
 * Refuses to run against NODE_ENV=production regardless.
 */
import { createHash } from "node:crypto";

import { prisma } from "../src/db/prisma";
import { env } from "../src/config/env";
import { emailBlindIndex } from "../src/lib/crypto";

const DEFAULT_EMAIL = "yumvagusengapatrick14@gmail.com";

async function main() {
  if (env.NODE_ENV === "production") {
    console.error("\nRefusing to run in production.\n");
    process.exit(1);
  }

  const email = (process.argv[2] ?? DEFAULT_EMAIL).trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { emailHash: emailBlindIndex(email) },
    select: { id: true, isPlatformAdmin: true },
  });

  if (!user) {
    console.error(`\nNo account for ${email}.\n`);
    console.error("Run `npm run seed:admins` to create the standing admin accounts.\n");
    process.exit(1);
  }

  const otp = await prisma.loginOtp.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    console.log(`\nNo code is waiting for ${email}.`);
    console.log("Enter the password on the sign-in screen first — that is what issues one.\n");
    return;
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    console.log(`\nThe last code for ${email} expired at ${otp.expiresAt.toLocaleTimeString()}.`);
    console.log("Sign in again to get a fresh one.\n");
    return;
  }

  let code: string | null = null;
  for (let candidate = 0; candidate < 1_000_000; candidate += 1) {
    const guess = String(candidate).padStart(6, "0");
    if (createHash("sha256").update(guess).digest("hex") === otp.codeHash) {
      code = guess;
      break;
    }
  }

  const minutesLeft = Math.max(0, Math.round((otp.expiresAt.getTime() - Date.now()) / 60000));

  console.log(`\n  account   ${email}${user.isPlatformAdmin ? "  (platform admin)" : ""}`);
  console.log(`  code      ${code ?? "(could not be recovered)"}`);
  console.log(`  expires   in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}\n`);
}

main()
  .catch((error) => {
    console.error("\nfailed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

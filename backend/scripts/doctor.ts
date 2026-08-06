/* eslint-disable no-console */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

/**
 * Preflight check: answers "why isn't this working" without needing anyone to
 * guess.
 *
 * Written to run standalone — it deliberately does NOT import src/config/env,
 * because that module exits the process when configuration is incomplete,
 * which is the very failure this is here to explain. It reads .env itself,
 * reports every problem it finds, and prints the exact command to fix each
 * one.
 *
 *   npm run doctor
 */

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

type Level = "ok" | "warn" | "fail";
const findings: { level: Level; title: string; detail?: string; fix?: string }[] = [];

const record = (level: Level, title: string, detail?: string, fix?: string) =>
  findings.push({ level, title, detail, fix });

// ------------------------------------------------------------------ .env ---
if (!fs.existsSync(envPath)) {
  record(
    "fail",
    "backend/.env is missing",
    "The server cannot start without it.",
    "./scripts/dev-up.sh   (generates one with fresh secrets)"
  );
} else {
  record("ok", "backend/.env exists");
}

loadEnv({ path: envPath });

/**
 * Variables the server refuses to boot without. Keeping this list beside the
 * check means a newly required secret shows up here as a named problem rather
 * than as a server that exits with no explanation.
 */
const REQUIRED: { name: string; validate?: (v: string) => string | null }[] = [
  { name: "DATABASE_URL" },
  { name: "JWT_ACCESS_SECRET", validate: (v) => (v.length >= 16 ? null : "must be at least 16 characters") },
  { name: "JWT_REFRESH_SECRET", validate: (v) => (v.length >= 16 ? null : "must be at least 16 characters") },
  {
    name: "ENCRYPTION_KEY",
    validate: (v) => (/^[0-9a-fA-F]{64}$/.test(v) ? null : "must be 64 hex characters"),
  },
  {
    name: "BLIND_INDEX_KEY",
    validate: (v) => (/^[0-9a-fA-F]{64}$/.test(v) ? null : "must be 64 hex characters"),
  },
];

const missing: string[] = [];

for (const { name, validate } of REQUIRED) {
  const value = process.env[name];

  if (!value) {
    missing.push(name);
    continue;
  }

  const problem = validate?.(value);
  if (problem) {
    record("fail", `${name} is invalid`, problem, `Regenerate it: openssl rand -hex 32`);
  }
}

if (missing.length > 0) {
  const generated = missing
    .filter((n) => n === "ENCRYPTION_KEY" || n === "BLIND_INDEX_KEY" || n.startsWith("JWT_"))
    .map((n) => `${n}="${crypto.randomBytes(32).toString("hex")}"`);

  record(
    "fail",
    `backend/.env is missing ${missing.join(", ")}`,
    "The server exits at boot when a required variable is absent, so the API never comes up and every request — including login — fails with no response.\n" +
      "  This is what happens to a .env written before these variables were introduced.",
    generated.length > 0
      ? `Append to backend/.env:\n\n    ${generated.join("\n    ")}\n\n  Or run ./scripts/dev-up.sh, which now repairs an existing .env.`
      : "./scripts/dev-up.sh"
  );
}

if (
  process.env.ENCRYPTION_KEY &&
  process.env.ENCRYPTION_KEY === process.env.BLIND_INDEX_KEY
) {
  record(
    "fail",
    "ENCRYPTION_KEY and BLIND_INDEX_KEY are identical",
    "Reusing one key as both a cipher key and a MAC key weakens both.",
    "Generate a second, different key: openssl rand -hex 32"
  );
}

// Surface anything in .env.example that .env has not caught up with.
if (fs.existsSync(examplePath) && fs.existsSync(envPath)) {
  const keysOf = (file: string) =>
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1])
      .filter((k): k is string => Boolean(k));

  const behind = keysOf(examplePath).filter((k) => !keysOf(envPath).includes(k));
  if (behind.length > 0) {
    record(
      "warn",
      `.env has no entry for ${behind.join(", ")}`,
      "Present in .env.example. Optional today, but worth adding so the two stay aligned."
    );
  }
}

// -------------------------------------------------------------- database ---
async function checkDatabase() {
  if (!process.env.DATABASE_URL) return;

  // Imported lazily: @prisma/client throws if the client has not been
  // generated, and that is itself a finding worth reporting cleanly.
  let prisma: import("@prisma/client").PrismaClient;
  try {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
  } catch {
    record("fail", "Prisma client has not been generated", undefined, "npx prisma generate");
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    record("ok", "MySQL is reachable");
  } catch (error) {
    record(
      "fail",
      "Cannot reach the database",
      String(error).split("\n")[0],
      "Check that MySQL is running and DATABASE_URL is correct.\n" +
        "  On Linux, root uses auth_socket and cannot connect over TCP — see docs/LOCAL-DEV.md."
    );
    await prisma.$disconnect();
    return;
  }

  try {
    const pending = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
      "SELECT COUNT(*) AS c FROM _prisma_migrations WHERE finished_at IS NULL"
    );
    if (Number(pending[0]?.c ?? 0) > 0) {
      record("fail", "A migration is unfinished", undefined, "npx prisma migrate deploy");
    } else {
      record("ok", "Migrations are applied");
    }
  } catch {
    record("fail", "No migration history in this database", undefined, "npx prisma migrate deploy");
    await prisma.$disconnect();
    return;
  }

  /*
   * Accounts created before the encryption migration have no blind index, so
   * login can never find them: the lookup is by email_hash, and theirs is
   * empty. They are unreachable rather than merely broken, which is the kind
   * of thing worth saying out loud.
   */
  try {
    const [{ total, orphaned }] = await prisma.$queryRawUnsafe<
      { total: bigint; orphaned: bigint }[]
    >(
      "SELECT COUNT(*) AS total, SUM(email_hash IS NULL OR email_hash = '') AS orphaned FROM users"
    );

    if (Number(orphaned ?? 0) > 0) {
      record(
        "fail",
        `${orphaned} of ${total} accounts predate the encryption migration`,
        "Login looks users up by their email blind index. These rows have none, so no password will ever match them.",
        "In development, reset and start clean:\n" +
          "    ./scripts/dev-up.sh --reset\n" +
          "  Then register again."
      );
    } else if (Number(total) === 0) {
      record("warn", "No accounts exist yet", "Register one at /signup.");
    } else {
      record("ok", `${total} account(s), all with a usable email index`);
    }
  } catch {
    record("warn", "Could not inspect the users table");
  }

  const plans = await prisma.subscriptionPlan.count().catch(() => 0);
  if (plans === 0) {
    record(
      "fail",
      "No subscription plans are seeded",
      "Registration cannot complete without them — the signup wizard has nothing to choose from.",
      "npx prisma db seed"
    );
  } else {
    record("ok", `${plans} subscription plans seeded`);
  }

  await prisma.$disconnect();
}

// ----------------------------------------------------------------- report ---
async function main() {
  await checkDatabase();

  const mark = { ok: "\x1b[32m  ok\x1b[0m", warn: "\x1b[33mwarn\x1b[0m", fail: "\x1b[31mFAIL\x1b[0m" };

  console.log("\n\x1b[1mShopCore preflight\x1b[0m\n");

  for (const f of findings) {
    console.log(`${mark[f.level]}  ${f.title}`);
    if (f.detail) console.log(`      ${f.detail.replace(/\n/g, "\n      ")}`);
    if (f.fix) console.log(`      \x1b[36mfix:\x1b[0m ${f.fix.replace(/\n/g, "\n      ")}`);
    if (f.detail || f.fix) console.log();
  }

  const failures = findings.filter((f) => f.level === "fail").length;

  console.log(
    failures === 0
      ? "\x1b[32mNo blocking problems found.\x1b[0m If login still fails, the frontend may be serving a\ncached bundle — remove frontend/node_modules/.vite and reload.\n"
      : `\x1b[31m${failures} blocking problem(s).\x1b[0m Fix the items above and try again.\n`
  );

  process.exit(failures === 0 ? 0 : 1);
}

void main();

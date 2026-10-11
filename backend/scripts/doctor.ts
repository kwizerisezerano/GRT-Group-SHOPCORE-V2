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
    const [version] = await prisma.$queryRawUnsafe<{ v: string }[]>("SELECT VERSION() AS v");
    const banner = String(version?.v ?? "unknown");
    // XAMPP ships MariaDB, not MySQL. Worth naming, because "MySQL" in the
    // XAMPP control panel is MariaDB and the two behave differently enough
    // that knowing which one is in front of you saves an hour.
    const flavour = /maria/i.test(banner) ? "MariaDB" : "MySQL";
    record("ok", `${flavour} reachable (${banner})`);
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
    const stuck = await prisma.$queryRawUnsafe<{ name: string; rolled_back_at: Date | null }[]>(
      "SELECT migration_name AS name, rolled_back_at FROM _prisma_migrations WHERE finished_at IS NULL"
    );

    if (stuck.length > 0) {
      /*
       * A migration that died partway leaves this row behind, and every later
       * `migrate deploy` refuses with P3009 rather than retrying. The second
       * failure is caused by the first, which makes it easy to chase the
       * wrong thing.
       */
      record(
        "fail",
        `Migration "${stuck[0].name}" failed partway and is blocking all others`,
        "Prisma will not apply new migrations while a failed one is recorded (P3009). " +
          "The migrations themselves are verified against MySQL 8 and MariaDB 10.11, so this is " +
          "almost always the database having dropped the connection mid-run, not bad SQL.",
        "Rebuild the database (development only — this destroys its data):\n" +
          "    .\\scripts\\dev-up.ps1 -Reset        (Windows)\n" +
          "    ./scripts/dev-up.sh --reset          (Linux/macOS)"
      );
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
/**
 * The visible sender.
 *
 * This is worth a preflight check because it fails silently and expensively:
 * mail still sends, so nothing errors, but it arrives wearing the wrong name
 * and lands in spam. That is exactly what happened here — the address was
 * left pointing at another product's brand, so every ShopCore verification
 * code and password reset went out as that company. To a person it reads as
 * phishing; to a filter, brand text that disagrees with the sending domain
 * scores like phishing too.
 */
/**
 * The base URL that goes into every email link.
 *
 * Left at the development default, every message carried a button pointing at
 * `http://127.0.0.1:5173` — plain HTTP, to a loopback address. Filters treat
 * that as a phishing link and the recipient could not follow it in any case,
 * so the mailer now leaves links out entirely rather than send them. That
 * keeps the mail deliverable but costs the call-to-action, which is worth
 * saying out loud rather than discovering from a button-less email.
 */
/**
 * The SMS gateway.
 *
 * Worth reporting because it fails quietly: with no credentials the sender
 * falls back to logging, so invitations and sign-in codes go out by email
 * only and nothing anywhere says so. For an invitation that matters — the
 * temporary password exists in that message and nowhere else.
 */
function checkSmsGateway() {
  const id = (process.env.HDEV_API_ID ?? "").trim();
  const key = (process.env.HDEV_API_KEY ?? "").trim();
  const sender = (process.env.HDEV_SENDER_ID ?? "").trim();

  if (!id || !key) {
    record(
      "warn",
      "SMS is not configured",
      "Invitations and sign-in codes will be emailed only; texts are written to the log instead of sent.",
      'Set HDEV_API_ID and HDEV_API_KEY in backend/.env'
    );
    return;
  }

  record("ok", `SMS sends as "${sender || "(gateway default)"}" via HDev`);

  if (!sender) {
    record(
      "warn",
      "No SMS sender id is set",
      "Recipients will see whatever default the gateway applies.",
      'HDEV_SENDER_ID="N-SMS"'
    );
  }

  /*
   * The endpoint was wrong for a while — a guessed REST path that answered
   * 200 and delivered nothing. Worth checking by name rather than trusting
   * the default, because a .env written before the fix keeps the old value
   * and every send goes on silently succeeding.
   */
  const url = (process.env.HDEV_SMS_URL ?? "").trim();
  if (url && !url.includes("/api_pay/api")) {
    record(
      "fail",
      "HDEV_SMS_URL does not look like the gateway endpoint",
      `Set to "${url}". The gateway takes the api id and key as path segments, so anything else accepts the request and sends nothing.`,
      'HDEV_SMS_URL="https://sms-api.hdev.rw/api_pay/api"'
    );
  }
}

function checkEmailLinkBase() {
  const raw = (process.env.FRONTEND_URL ?? "").trim();
  const hasKey = Boolean((process.env.RESEND_API_KEY ?? "").trim());

  let usable = false;
  let reason = "not set";

  if (raw) {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== "https:") {
        reason = `${url.protocol}// is not TLS`;
      } else if (host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost")) {
        reason = `${host} is only reachable on this machine`;
      } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
        reason = `${host} is a bare IP address`;
      } else if (!host.includes(".")) {
        reason = `${host} is not a public hostname`;
      } else {
        usable = true;
      }
    } catch {
      reason = `"${raw}" is not a valid URL`;
    }
  }

  if (usable) {
    record("ok", `Email links point at ${raw}`);
  } else {
    record(
      hasKey ? "fail" : "warn",
      "Outbound email cannot carry working links",
      `FRONTEND_URL ${reason}. Verification, reset and invitation emails are being sent without their buttons, because a link to localhost or a bare IP reads as phishing and lands the message in spam.`,
      'FRONTEND_URL="https://your-workspace-domain"'
    );
  }
}

function checkSenderIdentity() {
  const from = (process.env.RESEND_FROM_EMAIL ?? "").trim();
  const hasKey = Boolean((process.env.RESEND_API_KEY ?? "").trim());

  if (!from) {
    record(
      hasKey ? "fail" : "warn",
      "RESEND_FROM_EMAIL is not set",
      "Outbound mail has no sender identity.",
      'RESEND_FROM_EMAIL="ShopCore <no-reply@yourdomain.com>"'
    );
    return;
  }

  const named = from.match(/^s*(.+?)s*<([^>]+)>s*$/);
  if (!named) {
    record(
      "warn",
      "RESEND_FROM_EMAIL has no display name",
      `Currently: ${from}. Recipients will see a bare address.`,
      'Use the form: "ShopCore <no-reply@yourdomain.com>"'
    );
    return;
  }

  const [, displayName, mailbox] = named;
  const domain = mailbox.split("@")[1] ?? "";

  if (!/shopcore/i.test(displayName)) {
    record(
      "fail",
      "Outbound mail is branded as something other than ShopCore",
      `Display name is "${displayName}". Every account email — verification codes, password resets, invitations — arrives under that name.`,
      `RESEND_FROM_EMAIL="ShopCore <${mailbox}>"`
    );
  } else if (!/shopcore/i.test(domain)) {
    record(
      "warn",
      "Sending domain does not match the ShopCore brand",
      `Mail is branded ShopCore but sent from ${domain}. Delivery works, but the mismatch costs inbox placement.`,
      `Verify a ShopCore domain in Resend (SPF + DKIM), then point RESEND_FROM_EMAIL at it.`
    );
  } else {
    record("ok", `Mail sends as "${displayName}" via ${domain}`);
  }

  if (hasKey && !(process.env.RESEND_REPLY_TO ?? "").trim()) {
    record(
      "warn",
      "No Reply-To is configured",
      "Transactional mail that bounces replies scores worse with spam filters.",
      'RESEND_REPLY_TO="support@yourdomain.com"'
    );
  }
}

async function main() {
  await checkDatabase();
  checkSenderIdentity();
  checkEmailLinkBase();
  checkSmsGateway();

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

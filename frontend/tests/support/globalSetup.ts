import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Mints the fixtures before every run.
 *
 * ## Why it cannot be seeded once by hand
 *
 * Access tokens live fifteen minutes. A fixtures file written this morning is a
 * signed-out session by lunchtime — and the failure is not obvious: the app
 * falls back to its refresh token, spends it, rotates it, and every load after
 * that is redirected to the sign-in page. The suite then reports seven failures
 * about missing headings, which says nothing at all about what went wrong.
 *
 * Re-seeding on each run costs a couple of seconds and removes the whole class
 * of "it passed yesterday".
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.join(HERE, "..", "..", "..", "backend");

export default function globalSetup(): void {
  execFileSync("npx", ["tsx", "scripts/seed_e2e_contract_fixtures.ts"], {
    cwd: BACKEND,
    stdio: "inherit",
    // npx is a .cmd on Windows, which execFile cannot launch without a shell.
    shell: process.platform === "win32",
  });
}

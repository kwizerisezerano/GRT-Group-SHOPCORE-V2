import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

/**
 * Putting a signed-in session into the browser before the first navigation.
 *
 * ## Why not drive the login form
 *
 * Signing in raises an emailed one-time code, stored hashed. A browser test
 * cannot read it back, and loosening that so a test could would trade a real
 * protection for a convenience. So `scripts/seed_e2e_contract_fixtures.ts`
 * mints a session the same way the login route does, and this drops the tokens
 * where the app keeps them.
 *
 * `addInitScript` rather than an `evaluate` after load: local storage has to be
 * populated *before* the app's first render, or AuthContext boots as signed out
 * and the route guard has already redirected by the time the tokens arrive.
 */

export type Fixtures = {
  admin: { id: string; email: string; accessToken: string; refreshToken: string };
  customer: { id: string; email: string; accessToken: string; refreshToken: string };
  password: string;
  signingPin: string;
  planCode: string;
};

/* The package is ESM, so `__dirname` does not exist — derive it from the URL. */
const HERE = path.dirname(fileURLToPath(import.meta.url));

const FIXTURES = path.join(HERE, "..", ".fixtures.json");

export function fixtures(): Fixtures {
  try {
    return JSON.parse(readFileSync(FIXTURES, "utf8")) as Fixtures;
  } catch {
    throw new Error(
      "Missing tests/.fixtures.json — run:\n" +
        "  cd backend && npx tsx scripts/seed_e2e_contract_fixtures.ts",
    );
  }
}

const TOKENS_KEY = "shopcore_auth_tokens";

/** Signs the page in as one of the seeded accounts. */
export async function signInAs(
  page: Page,
  who: { accessToken: string; refreshToken: string },
): Promise<void> {
  await page.addInitScript(
    ([key, tokens]) => {
      window.localStorage.setItem(key as string, tokens as string);
    },
    [TOKENS_KEY, JSON.stringify(who)] as const,
  );
}

/**
 * The state the signing screen is legitimately reached in: a business captured
 * at signup and a plan chosen, both already in the browser's draft.
 *
 * Seeded rather than clicked through, because the three screens before this one
 * have their own tests and re-driving them here would mean a failure in the
 * plan picker reported as a contract failure.
 */
export async function seedOnboardingDraft(
  page: Page,
  planCode: string,
  overrides: { contract?: unknown } = {},
): Promise<void> {
  const business = {
    businessName: "Kigali Fresh Market Ltd",
    businessPhone: "+250788123456",
    businessLocation: "KN 4 Ave, Nyarugenge, Kigali",
    businessType: "retail",
    teamSize: "1-5",
    tinNumber: "102938475",
  };

  const choice = { planCode, billingCycle: "six_months" };

  await page.addInitScript(
    ([b, c, contract]) => {
      window.localStorage.setItem("shopcore_onboarding_business", b as string);
      window.localStorage.setItem("shopcore_onboarding_plan_choice", c as string);

      if (contract) {
        window.localStorage.setItem("shopcore_onboarding_contract", contract as string);
      }
    },
    [
      JSON.stringify(business),
      JSON.stringify(choice),
      overrides.contract ? JSON.stringify(overrides.contract) : null,
    ] as const,
  );
}

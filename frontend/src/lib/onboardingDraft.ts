/**
 * What signing up has collected so far, held between the steps that collect it.
 *
 * Signup creates the account; the plan screen creates the workspace; the
 * contract screen takes the signature; checkout spends all three. They are
 * separate routes, and the account row does not hand the details back in a
 * shape the later screens can use.
 *
 * ## Why local storage rather than session storage
 *
 * Router state does not survive a refresh, so this was always stored. It used
 * to be `sessionStorage`, which survives a refresh and a tab switch but dies
 * the moment the tab is closed — and closing the tab is exactly what people do
 * mid-signup. They go and find their TIN, or their card, or someone who knows
 * the business address, and come back an hour later to a signing screen that
 * had forgotten they ever signed. Being made to draw a signature a second time
 * is indistinguishable from the first one having failed.
 *
 * So the draft is kept in `localStorage`, and every read falls back to
 * `sessionStorage` so a person who was mid-signup when this shipped keeps what
 * they had. Everything here is cleared the moment the workspace exists.
 *
 * ## Why the signature is tied to an account id
 *
 * Local storage outlives a sign-out and is shared by everyone who uses the
 * browser. A signature left behind by one person must never be picked up and
 * submitted as the next person's, so the stored record carries the id of the
 * account that made it, and a read for a different account returns nothing.
 */

/**
 * Reads from local storage, then session storage.
 *
 * The fallback is for drafts written by the previous build, which used session
 * storage exclusively. It costs one lookup on a miss and means an upgrade
 * mid-signup does not lose somebody's work.
 */
function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    // Private browsing, or storage disabled entirely.
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked. Callers all degrade to asking again rather than
    // failing, so there is nothing useful to do here.
  }
}

/** Clears both stores — a value written by the old build must go too. */
function removeRaw(key: string): void {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const KEY = "shopcore_onboarding_business";

export type OnboardingBusiness = {
  businessName: string;
  businessPhone: string;
  businessLocation: string;
  businessType: string;
  teamSize: string;
  /** RRA tax identification number, printed on the contract and on invoices. */
  tinNumber: string;
};

export function rememberOnboardingBusiness(draft: OnboardingBusiness): void {
  writeRaw(KEY, JSON.stringify(draft));
}

export function readOnboardingBusiness(): OnboardingBusiness | null {
  try {
    const raw = readRaw(KEY);
    return raw ? (JSON.parse(raw) as OnboardingBusiness) : null;
  } catch {
    return null;
  }
}

export function clearOnboardingBusiness(): void {
  removeRaw(KEY);
}

/**
 * The plan and cycle chosen on /onboarding/plan, read by /onboarding/checkout.
 * Same reasoning as above: it has to survive a refresh on the payment screen,
 * and a closed tab between choosing and paying.
 */
const CHOICE_KEY = "shopcore_onboarding_plan_choice";

export type OnboardingPlanChoice = {
  planCode: string;
  billingCycle: "monthly" | "six_months" | "annual";
};

export function rememberPlanChoice(choice: OnboardingPlanChoice): void {
  writeRaw(CHOICE_KEY, JSON.stringify(choice));
}

export function readPlanChoice(): OnboardingPlanChoice | null {
  try {
    const raw = readRaw(CHOICE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingPlanChoice) : null;
  } catch {
    return null;
  }
}

export function clearPlanChoice(): void {
  removeRaw(CHOICE_KEY);
}

/**
 * The agreement, signed on /onboarding/contract and spent at checkout.
 *
 * Only the signature is kept — never the contract text. The server renders the
 * wording again when it stores the signature, so carrying the body through the
 * browser would achieve nothing except giving a tampered client something to
 * tamper with.
 *
 * Kept until the workspace exists, so a refresh, a closed tab or a return the
 * next morning all find the signature already there and offer to carry on
 * rather than asking for it again.
 */
const CONTRACT_KEY = "shopcore_onboarding_contract";

export type OnboardingContract = {
  templateId: string;
  /** PNG data URL of the drawn or uploaded signature. */
  signatureImage: string;
  /** PNG or JPEG data URL of the company stamp, if they have one. */
  stampImage: string | null;
  signerName: string;
  agreedAt: string;
  /**
   * The account that signed.
   *
   * Local storage is shared by everyone who uses this browser and outlives a
   * sign-out. Without this, the next person to sign up on a shared laptop —
   * the common case in a shop — would be handed the previous person's
   * signature, already ticked, ready to submit under their own name. A read
   * for a different account returns nothing instead.
   */
  accountId?: string | null;
};

export function rememberSignedContract(contract: OnboardingContract): void {
  writeRaw(CONTRACT_KEY, JSON.stringify(contract));
}

/**
 * The stored signature, if it belongs to the account asking for it.
 *
 * `accountId` is optional so a caller that has no user in hand still works;
 * passing one is what makes the check meaningful, and every caller here does.
 * A record written before this field existed has no owner, so it is accepted —
 * the alternative is silently discarding a signature somebody had just made.
 */
export function readSignedContract(accountId?: string | null): OnboardingContract | null {
  try {
    const raw = readRaw(CONTRACT_KEY);
    if (!raw) return null;

    const contract = JSON.parse(raw) as OnboardingContract;

    if (accountId && contract.accountId && contract.accountId !== accountId) return null;

    return contract;
  } catch {
    return null;
  }
}

export function clearSignedContract(): void {
  removeRaw(CONTRACT_KEY);
}

/**
 * Whether the contract screen has been completed and by whom.
 *
 * Separate from the signature itself only in that it is what the *page* reads
 * to decide whether to greet a returning signer with "you have already signed
 * this" rather than an empty pad.
 */
export function hasSignedContract(accountId?: string | null): boolean {
  return readSignedContract(accountId) !== null;
}

/**
 * How signing up finished, read once by the sign-in screen.
 *
 * Not a query parameter. The last onboarding step signs the session out, and
 * that makes `ProtectedRoute` — which wraps the route from the outside, where
 * the page cannot reach it — redirect to a bare `/auth`. Whether that lands
 * before or after the page's own navigation is a race, and losing it means the
 * customer who just paid is greeted with a generic "welcome back".
 *
 * Session storage survives both redirects and a refresh. Read-and-clear, so
 * the message appears exactly once.
 */
const OUTCOME_KEY = "shopcore_signup_outcome";

export type SignupOutcome = "paid" | "trial";

export function rememberSignupOutcome(outcome: SignupOutcome): void {
  try {
    sessionStorage.setItem(OUTCOME_KEY, outcome);
  } catch {
    // Private browsing. The sign-in screen simply shows its usual copy.
  }
}

/**
 * Reads the flag without consuming it.
 *
 * Split from the clear deliberately. A `useState(initializer)` that also
 * removed the value would be an impure initializer, and React's StrictMode
 * double-invokes those on purpose to surface exactly that mistake: the second
 * call found the flag already gone and the freshly-paid customer got the
 * generic "welcome back" instead. The reader peeks here and clears in an
 * effect once it has been shown.
 */
export function peekSignupOutcome(): SignupOutcome | null {
  try {
    const value = sessionStorage.getItem(OUTCOME_KEY);
    return value === "paid" || value === "trial" ? value : null;
  } catch {
    return null;
  }
}

/** Safe to call more than once — StrictMode runs effects twice in dev. */
export function clearSignupOutcome(): void {
  try {
    sessionStorage.removeItem(OUTCOME_KEY);
  } catch {
    // ignore
  }
}

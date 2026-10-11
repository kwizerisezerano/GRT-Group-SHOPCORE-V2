import { expect, test, type Page } from "@playwright/test";

import { fixtures, seedOnboardingDraft, signInAs } from "./support/session";

/**
 * The customer's side: reading the agreement and signing it.
 *
 * ## What this is for
 *
 * Two behaviours that only exist in a browser and that a person would notice
 * immediately if either broke.
 *
 * The first is that the contract on screen is a whole contract. It used to be
 * clause text and nothing else — no parties, no amount set out as a term, no
 * execution sentence, no signature blocks — and everything missing appeared for
 * the first time in the PDF, after the customer had agreed. So what is asserted
 * here is that the figures and the parties and both places to sign are all on
 * the page *before* anybody commits.
 *
 * The second is that a signature survives leaving. Somebody signing up stops to
 * find their TIN, or their card, or the person who knows the business address,
 * and comes back later. Being asked to sign a second time is indistinguishable
 * from the first attempt having failed, and it is the point in the flow where
 * people give up.
 */

const { customer, planCode } = fixtures();

/** Cleared between tests so each starts from a genuinely unsigned page. */
test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await signInAs(page, customer);
  await seedOnboardingDraft(page, planCode);
});

/** Draws a short stroke on the signature pad, the way a person would. */
async function drawSignature(page: Page) {
  const pad = page.locator("canvas").first();
  await expect(pad).toBeVisible();

  const box = await pad.boundingBox();
  if (!box) throw new Error("The signature pad has no box to draw in.");

  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + box.height / 2 - 20, { steps: 8 });
  await page.mouse.move(box.x + 150, box.y + box.height / 2 + 14, { steps: 8 });
  await page.mouse.move(box.x + 210, box.y + box.height / 2 - 8, { steps: 8 });
  await page.mouse.up();
}

/**
 * The rendered document itself.
 *
 * `ContractPaper` is an `<article>`, and it nests a second one for the clause
 * body — so the outer, which is the first in document order, is the whole
 * contract. Scoping to it keeps assertions off the page furniture: "the
 * agreement" also appears in the card header, in a clause heading, and in the
 * acceptance checkbox's own sentence.
 */
const document_ = (page: Page) => page.locator("article").first();

/** Opens the signing screen and waits for the server-rendered agreement. */
async function openContract(page: Page) {
  await page.goto("/onboarding/contract");
  await expect(page.getByRole("heading", { name: "Your service agreement" })).toBeVisible();
  await expect(document_(page).getByText("Service agreement", { exact: true })).toBeVisible();
}

test.describe("the contract a customer reads", () => {
  test("is a whole document, not just the clauses", async ({ page }) => {
    await openContract(page);
    const doc = document_(page);

    // Both parties, named — the provider's side used to be missing entirely.
    await expect(doc.getByText("Between", { exact: true })).toBeVisible();
    await expect(doc.getByText("And", { exact: true })).toBeVisible();
    await expect(doc.getByText('referred to as "the Provider"')).toBeVisible();
    await expect(doc.getByText('referred to as "the Customer"')).toBeVisible();

    // The customer's own registered details, from what they typed at signup.
    await expect(doc.getByText("Kigali Fresh Market Ltd").first()).toBeVisible();
    await expect(doc.getByText("TIN: 102938475").first()).toBeVisible();

    // The commercial terms, and the money written twice.
    await expect(doc.getByText("RWF 180,000").first()).toBeVisible();
    await expect(
      doc.getByText("one hundred and eighty thousand RWF", { exact: false }).first(),
    ).toBeVisible();

    // Executed, and governed by somebody's law.
    await expect(doc.getByText(/IN WITNESS WHEREOF/)).toBeVisible();

    // Nothing the server could not fill.
    await expect(doc.getByText(/\{\{/)).toHaveCount(0);
  });

  test("shows where the signature goes before there is one", async ({ page }) => {
    await openContract(page);
    const doc = document_(page);

    await expect(doc.getByText(/Your signature goes here/)).toBeVisible();
    await expect(doc.getByText("For the Customer")).toBeVisible();
    await expect(doc.getByText("For the Provider")).toBeVisible();
  });

  test("will not let anybody pay before they have signed", async ({ page }) => {
    await openContract(page);

    const submit = page.getByRole("button", { name: /Continue to payment/ });
    await expect(submit).toBeDisabled();
    await expect(page.getByText("Tick the box above to accept the agreement.")).toBeVisible();
  });
});

test.describe("signing", () => {
  test("puts the mark on the document and produces the contract", async ({ page }) => {
    await openContract(page);

    await page.getByRole("checkbox").first().check();
    await drawSignature(page);

    // The mark lands on the document itself, in the customer's block.
    await expect(page.getByText(/Your signature goes here/)).toBeHidden();
    await expect(page.locator("img[alt*='Signature of']")).toHaveCount(2);

    // And the finished PDF exists before payment is offered, not after.
    await expect(page.getByText("Your contract is ready")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Continue to payment/ })).toBeEnabled();
  });

  test("is still there after a reload, and offers to carry on", async ({ page }) => {
    await openContract(page);

    await page.getByRole("checkbox").first().check();
    await drawSignature(page);
    await expect(page.getByText("Your contract is ready")).toBeVisible({ timeout: 30_000 });

    /*
     * The whole point. Somebody refreshes, or closes the tab and comes back
     * tomorrow — and the page knows what they already did rather than handing
     * them an empty pad and a fresh set of terms.
     */
    await page.reload();

    await expect(page.getByText("You already signed this")).toBeVisible();
    await expect(page.locator("img[alt*='Signature of']")).toHaveCount(2);
    await expect(page.getByRole("checkbox").first()).toBeChecked();
    await expect(page.getByRole("button", { name: /Continue to payment/ })).toBeEnabled({
      timeout: 30_000,
    });
  });

  test("lets a returning signer start over instead", async ({ page }) => {
    await openContract(page);

    await page.getByRole("checkbox").first().check();
    await drawSignature(page);
    await expect(page.getByText("Your contract is ready")).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(page.getByText("You already signed this")).toBeVisible();

    await page.getByRole("button", { name: "Sign again" }).click();

    // Back to an unsigned page: the notice, the mark and the acceptance all go.
    await expect(page.getByText("You already signed this")).toBeHidden();
    await expect(page.getByText(/Your signature goes here/)).toBeVisible();
    await expect(page.getByRole("checkbox").first()).not.toBeChecked();
    await expect(page.getByRole("button", { name: /Continue to payment/ })).toBeDisabled();
  });

  test("never hands one account's signature to another", async ({ page, context }) => {
    await openContract(page);

    await page.getByRole("checkbox").first().check();
    await drawSignature(page);
    await expect(page.getByText("Your contract is ready")).toBeVisible({ timeout: 30_000 });

    /*
     * A shared shop laptop, which is the normal case here. The draft outlives
     * a sign-out, so it is stamped with the account that made it — and a
     * different account must be shown an empty pad, not somebody else's
     * signature already ticked and ready to submit under their name.
     */
    const stolen = await context.newPage();
    await signInAs(stolen, fixtures().admin);
    await seedOnboardingDraft(stolen, planCode);

    await stolen.goto("/onboarding/contract");

    await expect(stolen.getByText("You already signed this")).toBeHidden();
    await expect(stolen.getByText(/Your signature goes here/)).toBeVisible();

    await stolen.close();
  });
});

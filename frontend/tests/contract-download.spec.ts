import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { fixtures, seedOnboardingDraft, signInAs } from "./support/session";

/**
 * The contract the customer actually receives.
 *
 * ## Why this is a test and not a script
 *
 * The document is produced by the signing flow, from a real signature drawn in
 * a real browser, and handed over by a download the page starts on its own. The
 * only way to get the genuine artifact — rather than something a script
 * rendered with plausible-looking arguments — is to sign and catch what falls
 * out.
 *
 * It also proves the handover itself, which has failed silently before: the
 * download is started by a synthetic click on a blob URL, and tearing the
 * anchor or the URL down a tick too early cancels it with no error anywhere
 * (see `downloadContractPdf` in apiClient). A test that waits for the download
 * event is the only thing that notices.
 *
 * The file is written to `artifacts/` so it can be opened and looked at.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(HERE, "artifacts");

const { customer, planCode } = fixtures();

async function drawSignature(page: Page) {
  const pad = page.locator("canvas").first();
  await expect(pad).toBeVisible();

  const box = await pad.boundingBox();
  if (!box) throw new Error("The signature pad has no box to draw in.");

  // A rounder, more signature-like stroke than the other specs use — this one
  // ends up in a document somebody is going to look at.
  await page.mouse.move(box.x + 40, box.y + box.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + box.height * 0.3, { steps: 10 });
  await page.mouse.move(box.x + 100, box.y + box.height * 0.7, { steps: 10 });
  await page.mouse.move(box.x + 130, box.y + box.height * 0.32, { steps: 10 });
  await page.mouse.move(box.x + 175, box.y + box.height * 0.66, { steps: 10 });
  await page.mouse.move(box.x + 230, box.y + box.height * 0.45, { steps: 12 });
  await page.mouse.up();
}

test("signing hands the customer the finished PDF", async ({ page }) => {
  mkdirSync(ARTIFACTS, { recursive: true });

  await signInAs(page, customer);
  await seedOnboardingDraft(page, planCode);

  /*
   * `domcontentloaded`, not the default `load`. The page keeps a dev websocket
   * and a long-lived connectivity probe open, so "every resource has settled"
   * is a condition it never reaches — and waiting for it times out on a page
   * that is fully rendered and interactive. What the test needs is the app
   * mounted, which the assertion below establishes properly.
   */
  await page.goto("/onboarding/contract", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Your service agreement" })).toBeVisible();

  /*
   * Armed before the signature, not after. The page starts the download the
   * moment the document exists, and a listener attached afterwards would race
   * it — which is exactly the kind of flake that gets a real regression marked
   * as "just the test".
   */
  const downloaded = page.waitForEvent("download", { timeout: 45_000 });

  await page.getByRole("checkbox").first().check();
  await drawSignature(page);

  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("shopcore-service-agreement.pdf");

  const pdf = path.join(ARTIFACTS, "signed-contract.pdf");
  await download.saveAs(pdf);

  await expect(page.getByText("Your contract is ready")).toBeVisible();

  // And the same document as it looked on screen, for comparison.
  await page.locator("article").first().screenshot({
    path: path.join(ARTIFACTS, "signed-contract-on-screen.png"),
    scale: "device",
  });

  console.log(`PDF:    ${pdf}`);
  console.log(`SCREEN: ${path.join(ARTIFACTS, "signed-contract-on-screen.png")}`);
});

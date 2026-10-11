import { expect, test, type Page } from "@playwright/test";

import { fixtures, signInAs } from "./support/session";

/**
 * The platform console's contract template editor.
 *
 * ## What is worth driving a browser for
 *
 * The server-side rules — that a PIN is demanded, that a wrong one writes
 * nothing, that five wrong ones lock — are proved directly against the API in
 * `platform.signingPin.integration.test.ts`, which is faster and more precise
 * than a browser. What cannot be proved there is the part that only exists on
 * screen:
 *
 *   - the preview really renders a finished contract, with the sample amount
 *     substituted into the clause an author wrote as `{{amount}}`;
 *   - it updates as the author types, so the document is what is being edited
 *     rather than a template about a document;
 *   - the empty signature blocks say where the marks go;
 *   - drawing a signature is what raises the PIN field, and only that;
 *   - a wrong PIN keeps the editor open with the work still in it, rather than
 *     discarding twenty minutes of drafting.
 */

const { admin, signingPin } = fixtures();

/** Named so the cleanup can find it, and never made live. */
const NAME = "E2E editor template";

test.beforeEach(async ({ page }) => {
  await signInAs(page, admin);
});

test.afterAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:5173",
    extraHTTPHeaders: { Authorization: `Bearer ${admin.accessToken}` },
  });

  const list = await api.get("/api/platform/contract-templates");
  const body = await list.json();

  for (const template of body.data.templates as { id: string; name: string }[]) {
    if (template.name.startsWith(NAME)) {
      await api.delete(`/api/platform/contract-templates/${template.id}`);
    }
  }

  await api.dispose();
});

/** Opens the editor on a brand new template. */
async function openNewTemplate(page: Page) {
  await page.goto("/platform-admin/contract-templates");
  await page.getByRole("button", { name: "New template" }).click();

  await expect(page.getByText("New contract template")).toBeVisible();
}

/** Draws a short stroke on the signature pad, the way a person would. */
async function drawSignature(page: Page) {
  const pad = page.locator("canvas").first();
  await expect(pad).toBeVisible();

  const box = await pad.boundingBox();
  if (!box) throw new Error("The signature pad has no box to draw in.");

  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + box.height / 2 - 18, { steps: 8 });
  await page.mouse.move(box.x + 130, box.y + box.height / 2 + 12, { steps: 8 });
  await page.mouse.move(box.x + 180, box.y + box.height / 2 - 6, { steps: 8 });
  await page.mouse.up();
}

test.describe("the editor's live preview", () => {
  test("shows a finished contract, with the placeholders filled in", async ({ page }) => {
    await openNewTemplate(page);

    const preview = page.getByText("What the customer sees").locator("..").locator("..");

    // The specimen customer, so the author reads sentences rather than tokens.
    await expect(preview.getByText("Kigali Fresh Market Ltd").first()).toBeVisible();
    await expect(preview.getByText("TIN: 102938475").first()).toBeVisible();

    // The commercial terms, lifted out of the prose.
    await expect(preview.getByText("RWF 180,000").first()).toBeVisible();
    await expect(
      preview.getByText("one hundred and eighty thousand RWF", { exact: false }).first(),
    ).toBeVisible();

    // The clause an author wrote as {{amount}} reads as money, not as a token.
    await expect(preview.getByText(/\{\{/)).toHaveCount(0);

    // And the document is executed, not merely written.
    await expect(preview.getByText(/IN WITNESS WHEREOF/)).toBeVisible();
  });

  test("says where each mark goes, before either exists", async ({ page }) => {
    await openNewTemplate(page);

    await expect(page.getByText(/ShopCore's signature goes here/)).toBeVisible();
    await expect(page.getByText(/The customer signs here when they accept/)).toBeVisible();
  });

  test("follows what the author types", async ({ page }) => {
    await openNewTemplate(page);

    await page.getByRole("tab", { name: "Parties" }).click();
    await page.getByLabel("Registered name").fill("GRT Group Ltd");
    await page.getByLabel("TIN", { exact: true }).fill("999888777");

    const preview = page.getByText("What the customer sees").locator("..").locator("..");

    await expect(preview.getByText("GRT Group Ltd").first()).toBeVisible();
    await expect(preview.getByText("TIN: 999888777").first()).toBeVisible();
  });
});

test.describe("attaching ShopCore's signature", () => {
  test("asks for the PIN only once a mark has actually been made", async ({ page }) => {
    await openNewTemplate(page);
    await page.getByRole("tab", { name: "Signature" }).click();

    // Nothing has moved yet, so nothing is asked for.
    await expect(page.getByLabel("Signing PIN")).toBeHidden();

    await drawSignature(page);

    await expect(page.getByText("Confirm it is you")).toBeVisible();
    await expect(page.getByLabel("Signing PIN")).toBeVisible();
    await expect(page.getByText("PIN required")).toBeVisible();
  });

  test("puts the drawn signature onto the document immediately", async ({ page }) => {
    await openNewTemplate(page);
    await page.getByRole("tab", { name: "Signature" }).click();
    await drawSignature(page);

    const preview = page.getByText("What the customer sees").locator("..").locator("..");

    // The hint is replaced by the mark itself — that is the whole point of the
    // preview: you see the contract, not a description of one.
    await expect(preview.getByText(/ShopCore's signature goes here/)).toBeHidden();
    await expect(preview.locator("img[alt*='Signature of']")).toBeVisible();
  });

  test("keeps the draft on screen when the PIN is wrong", async ({ page }) => {
    await openNewTemplate(page);

    await page.getByLabel("Name").fill(`${NAME} wrong pin`);
    await page.getByRole("tab", { name: "Signature" }).click();
    await drawSignature(page);

    await page.getByLabel("Signing PIN").fill("9999");
    await page.getByRole("button", { name: "Create template" }).click();

    // The message names the failure rather than blaming the save.
    await expect(page.getByText(/PIN is not correct/i)).toBeVisible();

    /*
     * And the editor is still open with the work in it. A dialog that closed
     * on a rejected PIN would throw away the drafting as punishment for a
     * typo.
     *
     * The name is checked from the Agreement tab rather than in place: the
     * inactive tab panels are unmounted, so a field on another tab is
     * genuinely absent from the page rather than merely hidden.
     */
    await expect(page.getByLabel("Signing PIN")).toBeVisible();

    await page.getByRole("tab", { name: "Agreement" }).click();
    await expect(page.getByLabel("Name")).toHaveValue(`${NAME} wrong pin`);
  });

  test("saves with the right PIN, and the list says so", async ({ page }) => {
    await openNewTemplate(page);

    await page.getByLabel("Name").fill(NAME);
    await page.getByRole("tab", { name: "Parties" }).click();
    await page.getByLabel("Registered name").fill("GRT Group Ltd");

    await page.getByRole("tab", { name: "Signature" }).click();
    await drawSignature(page);
    await page.getByLabel("Signed by").fill("Patrick Yumvagusenga");
    await page.getByLabel("Title").fill("Director");

    await page.getByLabel("Signing PIN").fill(signingPin);
    await page.getByRole("button", { name: "Create template" }).click();

    await expect(page.getByText("Template created.")).toBeVisible();

    const row = page.getByRole("listitem").filter({ hasText: NAME });
    await expect(row).toBeVisible();
    await expect(row.getByText("Countersigned")).toBeVisible();

    // It was never made live, so the real agreement is untouched.
    await expect(row.getByText("Draft")).toBeVisible();
  });
});

import { describe, expect, it } from "vitest";

import { renderContractPdf } from "./contracts.pdf";

/**
 * The contract renderer, on its own.
 *
 * Written because the endpoint that calls it was found hanging while the same
 * function, invoked directly from a script, finished in milliseconds. Testing
 * the renderer separately from the route is what tells those two apart.
 *
 * The assertions are on bytes and page counts rather than on "a Buffer came
 * back": a renderer that silently produces an empty document, or one that
 * multiplies pages because a footer crossed a margin, still returns a Buffer.
 */

/** A 120x60 RGB PNG standing in for a drawn signature. Genuinely valid. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAA8CAIAAAAiz+n/AAABvUlEQVR4nO2aXU7DMBAGfQQkbsD97wgPlaLKcvyX3dl1+UZ5I11PRqUlDuVXIJRogf+CQkMoNIRCQyg0hEJDKDSEQkMoNIRCQyg0hEJDKDREZOiv75/XEegwyXPVmNCXd3WEyPSx8gwIfVc5W+u+56oqHXpon6T1jOeSKhp60j689bznvCoXeuiXpPWMRt7Q82bhrScFVj2J0KtOgaGXVJdORkO7vuQ5G79M8y9xD72dDG69/ZGVIvSTWPCHtYlq55y8ock39fOFhhMcQ5tkAloznl6hDQN5t7aa359TnC7glNC2wzvTXEKbp/FrbT62F9pjJfMofjOZyy+nvPtO8bybbBz6uM9Tk1HNyXVo7GvXhCO+YJvzi+HCH/M3rwnVKmahT7mLw+7s26GBm31DTlF9X6vc/WBj3MfstBlyrdgO7bEha8vGorGe9V7HUrioytXqSyfzqu3Qfg/NzHkXyK/a3r0bXsP8RbpyiuftNmnl1z9w503VWM/b/egj7F8c4TnY+E9uf5Hfc/yEJa16RebKC4+ysnl3yKmq//iHUGgIhYZQaAiFhlBoCIWGUGgIhYZQaAiFhlBoCIWG+AMH5WnTeGeaBAAAAABJRU5ErkJggg==";

const base = {
  templateName: "Standard service agreement",
  templateVersion: 3,
  signerName: "Jean Uwimana",
  signatureImage: PNG,
  stampImage: null,
  planName: "Starter",
  billingCycle: "monthly",
  amount: 15000,
  currency: "RWF",
  signedAt: new Date("2026-08-29T10:00:00Z"),
  companyName: "Kigali Fresh Market",
  reference: "SC-TEST0001",
};

const SHORT = `SERVICE AGREEMENT

This agreement is made on 29 August 2026.

1. SUBSCRIPTION
   The Customer subscribes to the Starter plan.`;

/** Long enough to need a second page, so pagination is actually exercised. */
const LONG = `SERVICE AGREEMENT

${Array.from({ length: 24 }, (_, i) => `${i + 1}. CLAUSE ${i + 1}\n   ${"This clause exists to push the document onto more than one page. ".repeat(3)}`).join("\n\n")}`;

/** Counts "N 0 obj" page objects the cheap way: the /Type /Page markers. */
const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe("renderContractPdf", () => {
  it("renders a real PDF", async () => {
    const pdf = await renderContractPdf({ ...base, body: SHORT });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
  }, 20_000);

  it("does not multiply pages for a document that fits on two", async () => {
    /*
     * The footer is drawn below the bottom margin, which pdfkit reads as an
     * overflow and answers by starting a new page — which gets a footer of its
     * own. A two-page agreement came out as six before the margin was zeroed
     * for the duration of the footer.
     */
    const pdf = await renderContractPdf({ ...base, body: SHORT });
    expect(pageCount(pdf)).toBeLessThanOrEqual(2);
  }, 20_000);

  it("paginates a long agreement instead of overflowing one page", async () => {
    const pdf = await renderContractPdf({ ...base, body: LONG });

    const pages = pageCount(pdf);
    expect(pages).toBeGreaterThan(1);
    // Generous, but far below the runaway the footer bug produced.
    expect(pages).toBeLessThan(8);
  }, 20_000);

  it("draws both parties when the provider has countersigned", async () => {
    const one = await renderContractPdf({ ...base, body: SHORT });
    const both = await renderContractPdf({
      ...base,
      body: SHORT,
      providerSignatureImage: PNG,
      providerStampImage: PNG,
      providerSignerName: "Patrick Yumvagusenga",
      providerSignerTitle: "Director, ShopCore",
    });

    // Text is inside compressed streams, so this compares documents rather
    // than grepping for a name: two more images and two more lines of type.
    expect(both.length).toBeGreaterThan(one.length);
  }, 20_000);

  it("still produces a document when an image is unreadable", async () => {
    /*
     * A contract that cannot be downloaded because one image is corrupt is
     * worse than one that downloads with a blank signature line — the typed
     * name underneath still identifies who signed.
     */
    const pdf = await renderContractPdf({
      ...base,
      body: SHORT,
      signatureImage: "data:image/png;base64,not-actually-an-image",
    });

    const withImage = await renderContractPdf({ ...base, body: SHORT });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // The document is still whole — it simply has no signature drawn on it.
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.length).toBeLessThan(withImage.length);
  }, 20_000);

  /*
   * The regression that started all of this.
   *
   * A truncated PNG — the kind a browser displays without complaint — reached
   * pdfkit, png-js threw from inside `doc.image()`, and from that point the
   * process was poisoned: the *next* image parse hung instead of throwing, so
   * the request never answered and every render queued behind it stalled too.
   *
   * Two documents in a row, each with two truncated images, is the exact shape
   * that hung. It has to finish.
   */
  it("survives repeated renders with truncated images", async () => {
    const truncated = `data:image/png;base64,${PNG.slice(PNG.indexOf(",") + 1, PNG.indexOf(",") + 120)}`;

    for (let i = 0; i < 2; i += 1) {
      const pdf = await renderContractPdf({
        ...base,
        body: SHORT,
        signatureImage: truncated,
        stampImage: truncated,
        providerSignatureImage: truncated,
        providerStampImage: truncated,
      });

      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    }

    // And a good image still embeds afterwards — the process is not poisoned.
    const after = await renderContractPdf({ ...base, body: SHORT, stampImage: PNG });
    expect(after.length).toBeGreaterThan(1500);
  }, 30_000);
});

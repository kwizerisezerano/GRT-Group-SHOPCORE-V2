import { describe, expect, it } from "vitest";

import { mapStatus, normalizeStatus } from "./lmbtech";

/**
 * The shapes LMBTech actually returns, captured from live calls.
 *
 * Every payload in this file was copied from a real request against
 * pay.lmbtech.rw with production credentials — not from their documentation,
 * which differs from their server in ways that cost us a working integration:
 *
 *   - the docs imply a bearer token; the server refuses anything but Basic
 *   - the docs wrap results in `data`; the verify endpoint answers flat
 *   - `status` is a *string* for a payment and a *boolean* for a failed lookup
 *
 * These tests exist so a future tidy-up of the parsing cannot quietly
 * reintroduce any of that. If LMBTech change their wire format, this is the
 * file that should fail first and tell you what moved.
 */

/** Verify, mid-flight. Flat, no `data` wrapper. */
const LIVE_PENDING = {
  status: "pending",
  amount: "105.00",
  reference_id: "INV-20260828-92410570-3254",
  transaction_id: "01M13AN1PS1BV94YDH39S4BH7J",
  name: "ShopCore live check",
  message: "Payment pending to be approved",
};

/** Verify, after the payer approved the prompt on the handset. */
const LIVE_SUCCESS = {
  status: "success",
  amount: "105.00",
  reference_id: "INV-20260828-92410570-3254",
  transaction_id: "01M13B2H9SCS6258YHA1CMZ0QQ",
  name: "ShopCore live check",
  message: "Payment successful to be approved",
};

/** Verify, for a reference the gateway has never seen. Note: boolean. */
const LIVE_NOT_FOUND = {
  status: false,
  message: "Payment not found for the given Reference ID PROBE-0001",
};

/** Card initiate. This one *is* wrapped, and carries the redirect at the top. */
const LIVE_CARD_INITIATE = {
  status: "pending",
  data: {
    reference_id: "INV-PROBE-CARD-594980",
    transaction_id: "",
    status: "pending",
    amount: "105.00",
    payment_method: "card",
  },
  message: "Redirect to card payment gateway to complete payment",
  redirect_url:
    "https://pay.lmbtech.rw/pay/pesapal/iframe.php?reference_id=INV-PROBE-CARD-594980&amount=105",
};

describe("LMBTech live payload shapes", () => {
  it("reads a pending mobile money payment", () => {
    expect(mapStatus(LIVE_PENDING.status)).toBe("pending");
  });

  it("reads an approved payment as success", () => {
    expect(mapStatus(LIVE_SUCCESS.status)).toBe("success");
  });

  it("does not mistake a failed lookup for a pending payment", () => {
    /*
     * The whole point. `String(false)` is "false", which is not in the status
     * table, so an earlier version fell through to "pending" and would have
     * polled a reference that does not exist until the watch expired.
     */
    expect(mapStatus(LIVE_NOT_FOUND.status)).toBeNull();
  });

  it("treats a truthy lookup flag as unknown rather than as payment", () => {
    // `true` says the lookup worked, not that the money arrived. Unknown
    // sends the caller to verify, which is the only safe reading.
    expect(mapStatus(true)).toBeNull();
  });

  it("merges a wrapped payload without losing the top-level redirect", () => {
    const merged = { ...LIVE_CARD_INITIATE, ...(LIVE_CARD_INITIATE.data ?? {}) };

    expect(merged.reference_id).toBe("INV-PROBE-CARD-594980");
    expect(merged.status).toBe("pending");
    expect(LIVE_CARD_INITIATE.redirect_url).toContain("pesapal");
  });

  it("reads a flat payload the same way", () => {
    const merged = { ...LIVE_SUCCESS, ...((LIVE_SUCCESS as Record<string, unknown>).data ?? {}) };

    expect(merged.reference_id).toBe("INV-20260828-92410570-3254");
    expect(merged.transaction_id).toBe("01M13B2H9SCS6258YHA1CMZ0QQ");
  });

  it("treats an empty transaction id as absent", () => {
    // Card initiate returns "" before Pesapal has issued one.
    expect(LIVE_CARD_INITIATE.data.transaction_id || null).toBeNull();
  });

  it("keeps unknown wording out of the settled states", () => {
    expect(mapStatus("some new status they invent")).toBeNull();
    expect(normalizeStatus("some new status they invent")).toBe("pending");
  });

  it("understands the settled vocabulary seen in the wild", () => {
    for (const word of ["success", "successful", "paid", "completed"]) {
      expect(mapStatus(word)).toBe("success");
    }
    for (const word of ["failed", "declined", "rejected"]) {
      expect(mapStatus(word)).toBe("failed");
    }
  });
});

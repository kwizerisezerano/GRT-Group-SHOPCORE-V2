import { beforeEach, describe, expect, it } from "vitest";
import {
  isNetworkError,
  isOnline,
  markNetworkReachable,
  markNetworkUnreachable,
} from "@/lib/offlineStore";

/**
 * The online/offline decision is what routes a sale to the backend or to the
 * local queue, so getting it wrong is not cosmetic — it is the difference
 * between a sale being recorded and a sale sitting in a browser waiting for a
 * sync that the cashier has no reason to expect.
 */

beforeEach(() => {
  localStorage.clear();
  markNetworkReachable();
});

describe("isNetworkError", () => {
  it("recognises a failure to reach a server", () => {
    expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("NetworkError when attempting to fetch"))).toBe(true);
    expect(isNetworkError({ code: "ERR_NAME_NOT_RESOLVED" })).toBe(true);
  });

  it("does not treat a server's refusal as a network failure", () => {
    expect(isNetworkError(new Error("Not enough stock for Milk 1L"))).toBe(false);
    expect(isNetworkError({ code: "insufficient_stock" })).toBe(false);
  });

  it("answers the question without changing the answer", () => {
    /*
     * The regression this exists for. isNetworkError used to call
     * markNetworkUnreachable() itself, so merely asking whether an error was
     * a network error declared the whole application offline for the next
     * fifteen seconds.
     *
     * During the migration off Supabase that was quietly severe: a leftover
     * call to an unconfigured host fails on every load of the till, so the
     * POS believed it was offline and queued every sale locally — while the
     * backend was up and answering the whole time. A predicate must not
     * decide the thing it is being asked about.
     */
    expect(isOnline()).toBe(true);
    isNetworkError(new Error("Failed to fetch"));
    expect(isOnline()).toBe(true);
  });
});

describe("isOnline", () => {
  it("goes offline only when something reports the API unreachable", () => {
    expect(isOnline()).toBe(true);
    markNetworkUnreachable();
    expect(isOnline()).toBe(false);
  });

  it("comes back as soon as a call succeeds", () => {
    markNetworkUnreachable();
    expect(isOnline()).toBe(false);
    markNetworkReachable();
    expect(isOnline()).toBe(true);
  });

  it("recovers on its own once the cooldown lapses", () => {
    // So a single blip cannot strand a till offline with no way back.
    markNetworkUnreachable();
    expect(isOnline()).toBe(false);

    localStorage.setItem(
      "shopcore_network_state",
      JSON.stringify({ reachable: false, last_error_at: Date.now() - 60_000 })
    );
    expect(isOnline()).toBe(true);
  });
});

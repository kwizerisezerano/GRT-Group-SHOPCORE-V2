import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetConnectivityForTests,
  checkConnectivityNow,
  connectivityState,
  onConnectivityChange,
  reportApiReachable,
  reportApiUnreachable,
} from "@/lib/connectivity";
import { markNetworkReachable } from "@/lib/offlineStore";

/**
 * The switch between online and offline decides whether a sale is recorded in
 * the database or parked in a browser. These tests are about getting that
 * decision right in the two ways it can be wrong: flipping to offline when the
 * connection is fine, and staying offline after it comes back.
 */

function mockHealth(ok: boolean) {
  return vi.fn().mockImplementation(() =>
    ok
      ? Promise.resolve({ ok: true, status: 200 } as Response)
      : Promise.reject(new TypeError("Failed to fetch"))
  );
}

beforeEach(() => {
  localStorage.clear();
  __resetConnectivityForTests();
  markNetworkReachable();
  vi.useFakeTimers();
});

afterEach(() => {
  __resetConnectivityForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("deciding the state", () => {
  it("starts online — the app is online by default", () => {
    expect(connectivityState()).toBe("online");
  });

  it("does not go offline on a single failed request", () => {
    /*
     * One dropped request happens on a perfectly healthy network. Flipping a
     * till into offline mode over it would queue sales that could have been
     * recorded, so it takes two in a row.
     */
    reportApiUnreachable();
    expect(connectivityState()).toBe("online");
  });

  it("goes offline on the second consecutive failure", () => {
    reportApiUnreachable();
    reportApiUnreachable();
    expect(connectivityState()).toBe("offline");
  });

  it("forgets earlier failures as soon as something succeeds", () => {
    // One failure, then a success, then one more failure is not two in a row.
    reportApiUnreachable();
    reportApiReachable();
    reportApiUnreachable();

    expect(connectivityState()).toBe("online");
  });

  it("comes back online on the first success", () => {
    // Asymmetric on purpose: slow to give up, quick to recover. A shop should
    // be recording sales normally again the moment it can.
    reportApiUnreachable();
    reportApiUnreachable();
    expect(connectivityState()).toBe("offline");

    reportApiReachable();
    expect(connectivityState()).toBe("online");
  });
});

describe("announcing the change", () => {
  it("tells listeners when the connection goes and when it returns", () => {
    const seen: string[] = [];
    onConnectivityChange((state, previous) => seen.push(`${previous}->${state}`));

    reportApiUnreachable();
    reportApiUnreachable();
    reportApiReachable();

    expect(seen).toEqual(["online->offline", "offline->online"]);
  });

  it("only announces transitions, not every check", () => {
    // The auto-sync hangs off this. Firing on every successful probe would
    // replay the queue every thirty seconds forever.
    const listener = vi.fn();
    onConnectivityChange(listener);

    reportApiReachable();
    reportApiReachable();
    reportApiReachable();

    expect(listener).not.toHaveBeenCalled();
  });

  it("still announces recovery after the shared marker has gone stale", () => {
    /*
     * The regression that made the automatic sync unreliable.
     *
     * `isOnline()` treats a failure older than fifteen seconds as stale and
     * starts reporting online again on its own, whether or not anything
     * recovered. While this module derived its answer from that, a connection
     * returning after a long outage found the previous state already reading
     * "online" — so no transition was emitted and the sync that hangs off it
     * never ran. The till came back online and silently kept its queue.
     */
    const listener = vi.fn();
    onConnectivityChange(listener);

    reportApiUnreachable();
    reportApiUnreachable();
    expect(connectivityState()).toBe("offline");

    // Age the stored failure past the staleness window, exactly as a real
    // outage lasting longer than that would.
    localStorage.setItem(
      "shopcore_network_state",
      JSON.stringify({ reachable: false, last_error_at: Date.now() - 60_000 })
    );

    reportApiReachable();

    expect(connectivityState()).toBe("online");
    expect(listener).toHaveBeenCalledWith("online", "offline");
  });

  it("keeps working when a listener throws", () => {
    const good = vi.fn();
    onConnectivityChange(() => {
      throw new Error("listener exploded");
    });
    onConnectivityChange(good);

    vi.spyOn(console, "error").mockImplementation(() => {});

    reportApiUnreachable();
    reportApiUnreachable();

    // A broken subscriber must not take the monitor — or the auto-sync — down.
    expect(good).toHaveBeenCalledWith("offline", "online");
    expect(connectivityState()).toBe("offline");
  });

  it("also emits a DOM event, for code that cannot subscribe", () => {
    const handler = vi.fn();
    window.addEventListener("shopcore-connectivity-changed", handler);

    reportApiUnreachable();
    reportApiUnreachable();

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({
      state: "offline",
      previous: "online",
    });

    window.removeEventListener("shopcore-connectivity-changed", handler);
  });
});

describe("probing the API", () => {
  it("treats an unreachable API as a failure", async () => {
    vi.stubGlobal("fetch", mockHealth(false));

    await checkConnectivityNow();
    await checkConnectivityNow();

    expect(connectivityState()).toBe("offline");
  });

  it("treats an answering API as reachable", async () => {
    vi.stubGlobal("fetch", mockHealth(false));
    await checkConnectivityNow();
    await checkConnectivityNow();
    expect(connectivityState()).toBe("offline");

    vi.stubGlobal("fetch", mockHealth(true));
    await checkConnectivityNow();

    expect(connectivityState()).toBe("online");
  });

  it("asks the API, not the browser", async () => {
    /*
     * The reason this module exists. A till on a shop's wifi with the line
     * down is reported online by the browser and always has been, so being
     * online is defined as "the API answered".
     */
    const fetchMock = mockHealth(true);
    vi.stubGlobal("fetch", fetchMock);

    await checkConnectivityNow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/health");
    // A cached 200 would report a dead network as healthy indefinitely.
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it("does not send a second probe while one is in flight", async () => {
    let release: (value: Response) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise<Response>((resolve) => { release = resolve; })
    );
    vi.stubGlobal("fetch", fetchMock);

    const a = checkConnectivityNow();
    const b = checkConnectivityNow();

    release({ ok: true, status: 200 } as Response);
    await Promise.all([a, b]);

    // A timer tick and a visibility change landing together is one question,
    // not two.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

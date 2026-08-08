import { apiBaseUrl } from "@/lib/apiBase";
import { isOnline, markNetworkReachable, markNetworkUnreachable } from "@/lib/offlineStore";

/**
 * Decides whether the application is online, and says so when that changes.
 *
 * The app is online by default and drops to offline only when it has evidence,
 * because the cost of the two mistakes is not symmetric: believing you are
 * offline when you are not queues sales that could have been recorded, while
 * believing you are online when you are not costs one failed request that the
 * offline path catches anyway.
 *
 * ## Why a probe, and not just the browser's own events
 *
 * `navigator.onLine` and the `online`/`offline` events describe the network
 * interface, not the internet. A till connected to a shop's router with the
 * line down is reported as online and always has been. That is the ordinary
 * case this system has to survive, not an edge case — so being online is
 * defined here as "the API answered", which is the only thing the app actually
 * needs to be true.
 *
 * Browser events are still used, as hints that something changed: `offline` is
 * conclusive (no interface, no internet) and takes effect immediately; `online`
 * only means it is worth probing again, right now rather than at the next tick.
 *
 * ## Hysteresis
 *
 * Going offline needs two consecutive failures. A single dropped request
 * happens on a healthy network, and flipping a till into offline mode over one
 * is how you end up with sales queued for no reason. Coming back needs one
 * success: the sooner a shop is recording sales normally again, the better, and
 * a false positive there is self-correcting on the next request.
 */

export type ConnectivityState = "online" | "offline";

/** Long enough not to call a slow network dead; short enough to feel prompt. */
const PROBE_TIMEOUT_MS = 4_000;

/**
 * While healthy, how long the app can go without checking.
 *
 * This is the *idle* cadence and nothing more. Any real request the app makes
 * reports its own outcome, so an active till learns the connection has gone
 * the moment it tries to do anything. The heartbeat only covers a screen that
 * is sitting untouched — where the cost of being wrong is that the status tile
 * lies to a cashier about to start a sale. Fifteen seconds keeps that honest
 * for four requests a minute to an endpoint that touches no database.
 */
const ONLINE_INTERVAL_MS = 15_000;

/**
 * While down, check often — a shop that has just got its connection back
 * should not wait to find out. Backs off so a long outage is not a request
 * every five seconds for an hour, but not far: getting back to recording
 * sales normally matters more than the handful of requests saved.
 */
const OFFLINE_INTERVAL_MS = 5_000;
const OFFLINE_INTERVAL_MAX_MS = 15_000;
const BACKOFF_FACTOR = 1.5;

/** Consecutive failures before believing it. See "Hysteresis" above. */
const FAILURES_BEFORE_OFFLINE = 2;

type Listener = (state: ConnectivityState, previous: ConnectivityState) => void;

const listeners = new Set<Listener>();

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let consecutiveFailures = 0;
let offlineInterval = OFFLINE_INTERVAL_MS;
let probeInFlight: Promise<boolean> | null = null;

/**
 * What this module believes, held here rather than read back from storage.
 *
 * It used to derive the answer from `isOnline()`, which was wrong in a way
 * that defeated the whole point: `isOnline()` treats an old failure as stale
 * and starts reporting online again after fifteen seconds, whether or not
 * anything has actually recovered. So by the time a probe finally succeeded,
 * the "previous" state already read online, no transition was emitted, and
 * the automatic sync that hangs off that transition never ran. A till would
 * come back online and quietly keep its queue.
 *
 * The monitor still *writes* to that shared storage, so every existing caller
 * of `isOnline()` keeps working — it simply no longer asks storage what it
 * itself last decided.
 */
let currentState: ConnectivityState = "online";

export function connectivityState(): ConnectivityState {
  return currentState;
}

/**
 * Called on every transition, with the new state and the one it replaced.
 * Returns an unsubscribe function.
 */
export function onConnectivityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(next: ConnectivityState, previous: ConnectivityState) {
  for (const listener of listeners) {
    try {
      listener(next, previous);
    } catch (error) {
      // One bad listener must not stop the others, or stop the monitor.
      console.error("[connectivity] listener failed:", error);
    }
  }

  // A DOM event as well, so code that is not React — and code that has not
  // been migrated yet — can react without importing this module.
  window.dispatchEvent(
    new CustomEvent("shopcore-connectivity-changed", { detail: { state: next, previous } })
  );
}

/**
 * Records the outcome of any attempt to reach the API, whether that was this
 * module's probe or an ordinary request made by the app.
 *
 * Real traffic is the better signal — it proves the API answered a request
 * that mattered — so `lib/apiClient.ts` reports through here on every call and
 * the probe is only what runs when the app is otherwise idle.
 */
export function reportApiReachable() {
  consecutiveFailures = 0;
  offlineInterval = OFFLINE_INTERVAL_MS;

  // Always refresh the shared marker, even with no transition — `isOnline()`
  // is what the rest of the app reads.
  markNetworkReachable();

  const previous = currentState;
  currentState = "online";

  if (previous === "offline") emit("online", previous);
}

export function reportApiUnreachable() {
  consecutiveFailures += 1;

  // Not convinced yet — one dropped request is not an outage. nextDelay()
  // shortens the next check so the second opinion arrives in about a second
  // rather than at the end of the idle cadence.
  if (consecutiveFailures < FAILURES_BEFORE_OFFLINE) return;

  // Re-stamped on every failed check while down, which also keeps `isOnline()`
  // from deciding the failure is stale and reporting online underneath us.
  markNetworkUnreachable();

  const previous = currentState;
  currentState = "offline";

  if (previous === "online") emit("offline", previous);
}

/**
 * How long to wait before looking again.
 *
 * Deliberately the only place that answers this. When reporting and the timer
 * loop both scheduled, they raced: a report would ask for a fast re-check and
 * the loop would immediately overwrite it with the idle cadence, so the second
 * opinion that confirms an outage arrived a full interval late instead of a
 * second later.
 */
function nextDelay(): number {
  if (connectivityState() === "offline") return offlineInterval;

  // A failure seen but not yet confirmed. Settle it quickly.
  if (consecutiveFailures > 0) return 1_000;

  return ONLINE_INTERVAL_MS;
}

/**
 * Asks the API whether it is there.
 *
 * `/api/health` is unauthenticated and does no database work, so this stays
 * cheap enough to run on a timer. `cache: "no-store"` matters: a cached 200
 * would report a dead network as healthy indefinitely.
 */
async function probe(): Promise<boolean> {
  // Collapse concurrent probes — a visibility change and a timer tick landing
  // together should not produce two requests.
  if (probeInFlight) return probeInFlight;

  probeInFlight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(`${apiBaseUrl()}/api/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      // Any answer proves it was reached. A 503 from a backend that is up but
      // unhealthy is still a backend the offline queue cannot help with.
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
      probeInFlight = null;
    }
  })();

  return probeInFlight;
}

/** Probes now and applies the result. Exported for the manual sync button. */
export async function checkConnectivityNow(): Promise<ConnectivityState> {
  const reachable = await probe();

  if (reachable) {
    reportApiReachable();
  } else {
    reportApiUnreachable();
    // Lengthen the gap while it stays down.
    offlineInterval = Math.min(offlineInterval * BACKOFF_FACTOR, OFFLINE_INTERVAL_MAX_MS);
  }

  return connectivityState();
}

function schedule(delayMs: number) {
  if (timer) clearTimeout(timer);
  if (typeof document !== "undefined" && document.hidden) return;

  timer = setTimeout(() => {
    void checkConnectivityNow().then(() => schedule(nextDelay()));
  }, delayMs);
}

/**
 * Starts monitoring. Safe to call more than once.
 *
 * Returns a stop function, which exists mainly so tests can shut the timer off
 * — in the app this runs for the life of the tab.
 */
export function startConnectivityMonitor(): () => void {
  if (started) return stopConnectivityMonitor;
  started = true;

  // Inherit the last session's answer as a starting point only; the probe
  // below settles it for real within a moment.
  currentState = isOnline() ? "online" : "offline";

  const handleBrowserOffline = () => {
    /*
     * Conclusive. There is no interface, so there is no point probing to
     * confirm it, and no reason to wait for two failures first — the usual
     * argument against trusting one signal does not apply to this one.
     */
    consecutiveFailures = FAILURES_BEFORE_OFFLINE;
    reportApiUnreachable();
  };

  const handleBrowserOnline = () => {
    // An interface came back. That is not the same as the internet coming
    // back, so this only means "worth asking again, now".
    consecutiveFailures = 0;
    void checkConnectivityNow();
  };

  const handleVisibility = () => {
    if (document.hidden) {
      if (timer) clearTimeout(timer);
      timer = null;
      return;
    }

    // A tab that has been in the background for an hour knows nothing about
    // the current state. Ask before letting anyone act on the stale answer.
    void checkConnectivityNow().then(() => schedule(nextDelay()));
  };

  window.addEventListener("online", handleBrowserOnline);
  window.addEventListener("offline", handleBrowserOffline);
  document.addEventListener("visibilitychange", handleVisibility);

  cleanup = () => {
    window.removeEventListener("online", handleBrowserOnline);
    window.removeEventListener("offline", handleBrowserOffline);
    document.removeEventListener("visibilitychange", handleVisibility);
    if (timer) clearTimeout(timer);
    timer = null;
    started = false;
  };

  // Establish the truth at startup rather than inheriting whatever the last
  // session left in storage.
  void checkConnectivityNow().then(() => schedule(nextDelay()));

  return stopConnectivityMonitor;
}

let cleanup: (() => void) | null = null;

export function stopConnectivityMonitor() {
  cleanup?.();
  cleanup = null;
}

/** Test seam: forget everything the monitor has learned. */
export function __resetConnectivityForTests() {
  stopConnectivityMonitor();
  listeners.clear();
  consecutiveFailures = 0;
  offlineInterval = OFFLINE_INTERVAL_MS;
  probeInFlight = null;
  currentState = "online";
}

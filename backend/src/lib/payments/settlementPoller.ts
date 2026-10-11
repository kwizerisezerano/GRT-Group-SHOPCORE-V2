import { env } from "../../config/env";
import { fetchRemoteStatus, type PaymentStatus } from "./lmbtech";
import { writePaymentLog } from "./logger";

/**
 * Asks the gateway what happened, until it says something final.
 *
 * ## Why this exists
 *
 * A payment must not depend on the customer keeping their tab open, and it
 * cannot depend on the callback either. The gateway posts results to
 * `API_PUBLIC_URL`, so on a laptop — or any deployment behind NAT, or before
 * DNS is pointed — that callback is posted into the void. Without this, a
 * customer approves the prompt on their phone, sees the money leave, and the
 * workspace never opens because nothing told the server.
 *
 * Polling closes that hole. It is not a replacement for the callback, which
 * stays the fast path in a correctly deployed environment; it is the
 * guarantee that a paid subscription eventually activates regardless.
 *
 * ## The schedule
 *
 * Dense while the payer is most likely acting, backing off after that, and
 * giving up at `MAX_WATCH_MS`. Mobile money prompts expire on the gateway's
 * side well inside that window, so a payment still pending at the end is
 * genuinely unanswered rather than slow — and because settlement always goes
 * through `applyPaymentResult`, a callback arriving after we stop watching is
 * still honoured.
 *
 * ## Why the caller passes `settle`
 *
 * Settling lives in `service.ts`, which is what starts the watch — importing
 * it here would close an import cycle. The same shape as
 * `scheduleMockSettlement`, for the same reason.
 */

/** Gaps between polls, in seconds. */
const SCHEDULE = [5, 5, 5, 10, 10, 15, 15, 20, 30, 30, 45, 60, 60, 60];

const MAX_WATCH_MS = 6 * 60 * 1000;

const watching = new Map<string, NodeJS.Timeout>();

export type SettleFn = (outcome: {
  status: PaymentStatus;
  providerTxnId: string | null;
  message: string;
}) => Promise<void>;

export function isWatching(referenceId: string): boolean {
  return watching.has(referenceId);
}

/**
 * Starts watching a pending reference. Safe to call twice — a reference
 * already being watched is left alone rather than polled at double the rate.
 */
export function watchPendingPayment(
  referenceId: string,
  context: { tenantId?: string | null; transactionId?: string | null },
  settle: SettleFn
): void {
  // The mock driver settles itself; there is nobody to ask.
  if (env.PAYMENTS_DRIVER === "mock") return;
  if (watching.has(referenceId)) return;

  const startedAt = Date.now();
  let attempt = 0;

  const schedule = () => {
    const seconds = SCHEDULE[Math.min(attempt, SCHEDULE.length - 1)];
    attempt += 1;

    const timer = setTimeout(() => void tick(), seconds * 1000);
    // Never hold the process open for a payment nobody is waiting on.
    timer.unref?.();
    watching.set(referenceId, timer);
  };

  const tick = async () => {
    watching.delete(referenceId);

    if (Date.now() - startedAt > MAX_WATCH_MS) {
      await writePaymentLog({
        ...context,
        referenceId,
        direction: "status_check",
        event: "status.watch_expired",
        message: "Stopped watching this payment; it was never approved",
      }).catch(() => undefined);
      return;
    }

    let settled = false;

    try {
      const remote = await fetchRemoteStatus(referenceId, context);

      if (remote && remote.status !== "pending") {
        await settle({
          status: remote.status,
          providerTxnId: remote.providerTxnId,
          message: remote.message,
        });
        settled = true;
      }
    } catch (error) {
      /*
       * A failed poll is not a failed payment — the gateway may just be
       * unreachable for a moment. Log it and try again on the next tick.
       */
      await writePaymentLog({
        ...context,
        referenceId,
        direction: "error",
        event: "status.watch",
        errorMessage: error instanceof Error ? error.message : String(error),
        message: "A scheduled status check failed; will retry",
      }).catch(() => undefined);
    }

    if (!settled) schedule();
  };

  schedule();
}

/** Stops watching a reference. Used on shutdown and by the tests. */
export function stopWatchingPayment(referenceId: string): void {
  const timer = watching.get(referenceId);
  if (timer) clearTimeout(timer);
  watching.delete(referenceId);
}

/** Clears every watch, so timers do not leak between tests. */
export function clearPaymentWatches(): void {
  for (const timer of watching.values()) clearTimeout(timer);
  watching.clear();
}

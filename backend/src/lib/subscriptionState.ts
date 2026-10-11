/**
 * What a subscription is *actually* worth right now.
 *
 * The stored `subscription_status` is what somebody last wrote to the row. It
 * says "active" for as long as nobody touches it, including six months after
 * the period it paid for ended — nothing in this system runs a nightly job to
 * age subscriptions out. So every read path that decides whether a workspace
 * is open resolves the state here instead, from the dates, at the moment the
 * question is asked.
 *
 * That makes expiry self-enforcing: the workspace closes the second the period
 * ends, with no scheduler to fail, and reopens the second a renewal payment
 * lands (which moves `currentPeriodEnd` forward).
 */

export type SubscriptionState =
  | "active"
  | "trial"
  | "trial_expired"
  | "expired"
  | "pending_payment"
  | "suspended"
  | "cancelled";

export type SubscriptionLike = {
  subscriptionStatus: string | null;
  paymentStatus: string | null;
  currentPeriodEnd: Date | null;
  expiresAt: Date | null;
  trialEndsAt: Date | null;
  activatedAt: Date | null;
};

/** Days a lapsed workspace keeps read access before it is fully closed. */
export const GRACE_PERIOD_DAYS = 0;

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function resolveSubscriptionState(
  subscription: SubscriptionLike | null,
  now: Date = new Date()
): SubscriptionState {
  if (!subscription) return "pending_payment";

  const status = normalize(subscription.subscriptionStatus);
  const payment = normalize(subscription.paymentStatus);

  // An administrative decision outranks any date.
  if (status === "suspended" || status === "blocked") return "suspended";
  if (status === "cancelled" || status === "terminated") return "cancelled";

  /*
   * A trial is live until its own end date, whatever the payment says.
   *
   * Recognised two ways: the row says so, or it has a trial end date and has
   * never been activated by a payment. Either is sufficient — relying on the
   * second alone meant one stray `activatedAt` turned every trial into an
   * unpaid subscription.
   */
  if (subscription.trialEndsAt && (status === "trial" || !subscription.activatedAt)) {
    return subscription.trialEndsAt.getTime() > now.getTime() ? "trial" : "trial_expired";
  }

  const paid = ["paid", "confirmed", "completed", "verified", "successful"].includes(payment);
  if (!paid) return "pending_payment";

  /*
   * Paid, and the question is only whether the term has run out. Falls back to
   * `expiresAt` for rows written before `currentPeriodEnd` was populated; a
   * paid subscription with neither date is treated as active rather than
   * expired, because refusing a customer over a missing column is the worse
   * failure.
   */
  const periodEnd = subscription.currentPeriodEnd ?? subscription.expiresAt;
  if (!periodEnd) return "active";

  const graceEnd = periodEnd.getTime() + GRACE_PERIOD_DAYS * 86_400_000;

  return graceEnd > now.getTime() ? "active" : "expired";
}

/** Whether the workspace behind this subscription should be reachable. */
export function isSubscriptionOpen(state: SubscriptionState): boolean {
  return state === "active" || state === "trial";
}

/** Whole days left, negative once the term has run out. Null when open-ended. */
export function daysRemaining(
  subscription: SubscriptionLike | null,
  now: Date = new Date()
): number | null {
  if (!subscription) return null;

  const end =
    subscription.trialEndsAt && !subscription.activatedAt
      ? subscription.trialEndsAt
      : subscription.currentPeriodEnd ?? subscription.expiresAt;

  if (!end) return null;

  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

/**
 * How long a billing term runs.
 *
 * A subscription row carries `billingMonths` copied from the price it was
 * bought at; this is the fallback for rows written before that column was
 * populated, and the single place the mapping lives so the approval queue and
 * the payment gateway cannot disagree about when a period ends.
 */
export const BILLING_CYCLE_MONTHS: Record<string, number> = {
  monthly: 1,
  six_months: 6,
  annual: 12,
};

export function monthsForCycle(billingCycle: string, billingMonths?: number | null): number {
  return billingMonths ?? BILLING_CYCLE_MONTHS[billingCycle] ?? 1;
}

/**
 * Adds whole calendar months.
 *
 * `setMonth` overflows rather than clamping — 31 January plus one month is 3
 * March — which would quietly give a workspace two extra days every time it
 * renewed from a long month. Clamping to the last day of the target month is
 * what a person means by "a month later".
 */
export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const targetMonth = next.getMonth() + months;

  next.setDate(1);
  next.setMonth(targetMonth);

  const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(date.getDate(), lastDayOfTargetMonth));

  return next;
}

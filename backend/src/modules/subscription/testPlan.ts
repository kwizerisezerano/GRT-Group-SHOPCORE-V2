/**
 * The RWF 100 plan used to put a real payment through the gateway.
 *
 * ## Why it exists
 *
 * A mobile money integration cannot be fully trusted until money has actually
 * moved: the prompt, the approval, the callback, and the subscription opening
 * as a result. Doing that against a RWF 35,000 plan makes every rehearsal
 * expensive, so people stop rehearsing.
 *
 * ## Why it is hidden by default
 *
 * It is a real, active plan — a platform admin can assign it, and it charges
 * for real. What it must never do is appear on the pricing page next to the
 * plans customers are meant to buy. `listPublicPlans` filters it out unless
 * `SHOW_TEST_PLAN` is set, which is the single switch between "available for
 * testing" and "on sale by accident".
 *
 * The code lives here, in one place, because the seed and the query that
 * hides it have to agree exactly — two copies of the string is precisely how
 * a plan like this ends up on a customer's screen.
 */
export const TEST_PLAN_CODE = "test_100";

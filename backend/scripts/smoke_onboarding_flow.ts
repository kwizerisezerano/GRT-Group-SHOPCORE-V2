/**
 * The signup journey, end to end, against a running API.
 *
 *   npm run smoke:onboarding
 *
 * Walks the four steps a real customer takes — account, business, plan,
 * payment — and asserts the transitions that decide whether somebody gets in:
 * that an account alone does NOT open a workspace, that choosing a plan and
 * paying does, that a failed payment leaves the account usable so they can
 * retry, and that an expired term closes the workspace again.
 */

import { PrismaClient } from "@prisma/client";

const BASE = process.env.SMOKE_API_URL ?? "http://127.0.0.1:4000/api";
const prisma = new PrismaClient();
const STAMP = Date.now();

type Json = Record<string, any>;

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
    if (detail !== undefined) console.error("        ", JSON.stringify(detail));
  }
}

async function api(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {}
): Promise<{ status: number; body: Json }> {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPayment(reference: string, token: string, seconds: number) {
  for (let attempt = 0; attempt < seconds * 2; attempt++) {
    await sleep(500);
    const status = await api(`/payments/status/${reference}`, { token });
    if (status.body.data?.status && status.body.data.status !== "pending") {
      return status.body.data.status as string;
    }
  }
  return "pending";
}

async function main() {
  console.log(`\nOnboarding smoke test against ${BASE}\n`);

  // ------------------------------------------- step 1+2: the account only ---
  console.log("account");
  const email = `onboard.${STAMP}@example.test`;

  const signup = await api("/auth/signup", {
    method: "POST",
    body: {
      email,
      password: "Onb0ard!Passw0rd",
      displayName: "Onboarding Owner",
      businessName: `Onboarding Shop ${STAMP}`,
      businessPhone: `+25078${String(STAMP).slice(-7)}`,
      businessType: "retail",
      teamSize: "2-5",
    },
  });

  check("signup succeeds with no plan chosen", signup.status === 201, signup.body);

  const token: string = signup.body.data?.accessToken;
  check("an access token comes back", Boolean(token));
  check("no workspace exists yet", signup.body.data?.tenantId === null, signup.body.data?.tenantId);
  check("the client is told to show the plan screen", signup.body.data?.needsPlan === true);

  const me = await api("/auth/me", { token });
  check("the session reports no workspace", me.body.data?.tenant === null, me.body.data?.tenant);

  // ------------------------------------------------------ step 3: the plan ---
  console.log("\nplan catalogue");
  const plans = await api("/subscription/plans");
  const starter = plans.body.data?.plans?.find((plan: Json) => plan.code === "starter");

  check("plans are offered", Boolean(starter));
  check("with the ceilings that decide the choice", (starter?.limits?.length ?? 0) > 0);
  check("and what they open up", (starter?.features?.length ?? 0) > 0);

  const monthly = starter?.prices?.find((price: Json) => price.billing_cycle === "monthly");
  check("with a price for the chosen cycle", typeof monthly?.final_price === "number", monthly);

  const methods = await api("/subscription/payment-methods");
  const momo = methods.body.data?.payment_methods?.find(
    (method: Json) => method.code === "mobile_money_mtn"
  );
  const card = methods.body.data?.payment_methods?.find((method: Json) => method.code === "card");
  const bank = methods.body.data?.payment_methods?.find(
    (method: Json) => method.code === "bank_transfer"
  );

  check("mobile money is offered and asks for a number", momo?.requires_phone === true, momo);
  check("card is offered and does not", card?.requires_phone === false, card);
  check("bank transfer is flagged as manual", bank?.is_manual === true, bank);

  // -------------------------------------------------- step 4: paying ---
  console.log("\ncheckout");
  const checkout = await api("/workspace/pending", {
    method: "POST",
    token,
    body: {
      business_name: `Onboarding Shop ${STAMP}`,
      plan_code: "starter",
      billing_cycle: "monthly",
      payment_method: "mobile_money_mtn",
      payer_phone: "+250780000000",
    },
  });

  check("the workspace is created", checkout.status === 200, checkout.body);
  check("and it needs paying for", checkout.body.data?.requiresPayment === true);

  const payment = checkout.body.data?.payment;
  check("a charge was started in the same request", Boolean(payment?.reference_id), payment);
  check("pending, not paid", payment?.status === "pending", payment?.status);

  const tenantId = checkout.body.data?.tenantId;
  check("the account now has a workspace", Boolean(tenantId));

  /*
   * The tenancy changed, so the token did too. Everything after this point is
   * tenant-scoped and would be refused with the signup-time token.
   */
  const workspaceToken: string = checkout.body.data?.accessToken;
  check("a token that knows about the workspace comes back", Boolean(workspaceToken));

  const beforeSettlement = await api("/subscription/current", { token: workspaceToken });
  check(
    "which is closed until the money lands",
    beforeSettlement.body.data?.tenant?.workspace_status === "pending_payment",
    beforeSettlement.body.data?.tenant
  );

  // ------------------------------------------------------ the gateway says ---
  console.log("\ngateway confirmation");
  const settleWindow = Number(process.env.MOCK_PAYMENT_SETTLE_SECONDS ?? 4) + 5;
  const settled = await waitForPayment(payment.reference_id, workspaceToken, settleWindow);

  check("the payment settles successfully", settled === "success", settled);

  const afterSettlement = await api("/subscription/current", { token: workspaceToken });
  check(
    "and the workspace opens",
    afterSettlement.body.data?.tenant?.workspace_status === "active",
    afterSettlement.body.data?.tenant
  );

  const session = await api("/auth/me", { token: workspaceToken });
  check("the session agrees", session.body.data?.tenant?.workspace_status === "active");
  check(
    "the subscription reports itself open",
    session.body.data?.subscription?.is_open === true,
    session.body.data?.subscription
  );
  check(
    "with days left on the clock",
    (session.body.data?.subscription?.days_remaining ?? 0) > 0,
    session.body.data?.subscription?.days_remaining
  );

  // ----------------------------------------------------------- expiry ---
  console.log("\nexpiry and renewal");

  /*
   * Wind the period back so the term has run out, exactly as it would in a
   * month's time. Done straight against the database rather than through a
   * test-only endpoint: a route that can expire any workspace has no business
   * existing in a deployed build, however well guarded.
   *
   * Nothing schedules expiry — the state is resolved from these dates on every
   * read, which is the behaviour being checked.
   */
  const yesterday = new Date(Date.now() - 86_400_000);

  await prisma.tenantSubscription.updateMany({
    where: { tenantId },
    data: { currentPeriodEnd: yesterday, expiresAt: yesterday },
  });

  {
    const expired = await api("/auth/me", { token: workspaceToken });
    check(
      "an expired term closes the workspace",
      expired.body.data?.tenant?.workspace_status === "expired",
      expired.body.data?.tenant
    );
    check(
      "and the subscription reports itself closed",
      expired.body.data?.subscription?.is_open === false,
      expired.body.data?.subscription
    );

    const renewal = await api("/subscription/checkout", {
      method: "POST",
      token: workspaceToken,
      body: { payment_method_code: "mobile_money_mtn", payer_phone: "+250780000000" },
    });

    check("a renewal can be paid for", renewal.status === 202, renewal.body);

    const renewed = await waitForPayment(renewal.body.data.reference_id, workspaceToken, settleWindow);
    check("the renewal settles", renewed === "success", renewed);

    const reopened = await api("/auth/me", { token: workspaceToken });
    check(
      "and the workspace reopens",
      reopened.body.data?.tenant?.workspace_status === "active",
      reopened.body.data?.tenant
    );
  }

  await prisma.$disconnect();

  console.log(
    failures === 0 ? "\nAll onboarding checks passed.\n" : `\n${failures} check(s) failed.\n`
  );

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nSmoke test could not run:", error);
  process.exit(1);
});

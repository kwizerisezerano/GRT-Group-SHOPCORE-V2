/**
 * End-to-end check of the subscription pipeline against a running API.
 *
 *   npm run smoke:subscription
 *
 * Walks the path a real customer takes and asserts the parts that are easy to
 * break and hard to notice: that a workspace does NOT open until the gateway
 * confirms, that the callback opens it, and that the plan's seat ceiling is
 * refused by the server rather than merely hidden by the browser.
 *
 * Safe to run repeatedly — every run signs up a fresh throwaway workspace.
 * Expects PAYMENTS_DRIVER=mock, which settles a collection locally a few
 * seconds after it is started.
 */

const BASE = process.env.SMOKE_API_URL ?? "http://127.0.0.1:4000/api";
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

async function main() {
  console.log(`\nSubscription smoke test against ${BASE}\n`);

  // ------------------------------------------------------ plan catalogue ---
  console.log("plan catalogue");
  const plans = await api("/subscription/plans");
  check("plans are served", plans.status === 200 && Array.isArray(plans.body.data?.plans));

  const starter = plans.body.data?.plans?.find((plan: Json) => plan.code === "starter");
  check("starter plan is published", Boolean(starter));
  check(
    "starter carries limits a super admin can edit",
    Array.isArray(starter?.limits) && starter.limits.length > 0,
    starter?.limits
  );

  const seatLimit = starter?.limits?.find((limit: Json) => limit.limit_key === "users");
  check("starter caps team members", typeof seatLimit?.value === "number", seatLimit);

  // -------------------------------------------------------------- signup ---
  console.log("\nsignup with MTN Mobile Money");
  const email = `smoke.owner.${STAMP}@example.com`;

  const signup = await api("/auth/signup", {
    method: "POST",
    body: {
      email,
      password: "Sm0ke!Passw0rd",
      displayName: "Smoke Owner",
      businessName: `Smoke Retail ${STAMP}`,
      businessPhone: `+25078${String(STAMP).slice(-7)}`,
      planCode: "starter",
      billingCycle: "monthly",
      paymentMethod: "mobile_money_mtn",
      payerPhone: "+250780000000",
    },
  });

  check("signup succeeds", signup.status === 201, signup.body);
  const token: string = signup.body.data?.accessToken;
  check("an access token comes back", Boolean(token));
  check(
    "the workspace is not opened by signing up alone",
    signup.body.data?.workspace?.requiresPayment === true,
    signup.body.data?.workspace
  );

  const payment = signup.body.data?.payment;
  check("a payment was started at the gateway", Boolean(payment?.reference_id), payment);
  check("it starts pending, not paid", payment?.status === "pending", payment?.status);

  // ------------------------------------------------- gateway settlement ---
  console.log("\ngateway settlement");
  const beforeSettlement = await api("/subscription/current", { token });
  check(
    "the subscription is awaiting payment",
    beforeSettlement.body.data?.subscription?.payment_status === "pending",
    beforeSettlement.body.data?.subscription
  );

  // The mock driver posts its own callback a few seconds after the charge.
  const settleWindow = Number(process.env.MOCK_PAYMENT_SETTLE_SECONDS ?? 4) + 4;
  let settled = false;

  for (let attempt = 0; attempt < settleWindow * 2; attempt++) {
    await sleep(500);
    const status = await api(`/payments/status/${payment.reference_id}`, { token });
    if (status.body.data?.status === "success") {
      settled = true;
      break;
    }
  }

  check("the payment settles", settled);

  const afterSettlement = await api("/subscription/current", { token });
  check(
    "the workspace opens once the gateway confirms",
    afterSettlement.body.data?.tenant?.workspace_status === "active",
    afterSettlement.body.data?.tenant
  );
  check(
    "a billing period is set",
    Boolean(afterSettlement.body.data?.subscription?.current_period_end),
    afterSettlement.body.data?.subscription
  );

  // ------------------------------------------------------- payment logs ---
  console.log("\npayment logs");
  const logs = await api(`/payments/transactions/${payment.reference_id}/logs`, { token });
  check("the gateway conversation is on record", (logs.body.data?.logs?.length ?? 0) > 0);
  check(
    "the callback is in it",
    logs.body.data?.logs?.some((log: Json) => log.direction === "callback"),
    logs.body.data?.logs?.map((log: Json) => log.event)
  );

  const phoneInLogs = JSON.stringify(logs.body.data?.logs ?? []).includes("+250780000000");
  check("the payer's number is masked in the logs", !phoneInLogs);

  // ---------------------------------------------------- capacity ceiling ---
  console.log("\nseat ceiling");
  const usage = await api("/subscription/usage", { token });
  const seats = usage.body.data?.capacities?.find((row: Json) => row.limit_key === "users");
  check("usage reports the seat ceiling", seats?.limit === seatLimit?.value, seats);
  check("the owner already occupies a seat", seats?.usage === 1, seats);

  const limit: number = seatLimit?.value ?? 3;
  let refusedAt: number | null = null;

  for (let seat = 2; seat <= limit + 1; seat++) {
    const created = await api("/users/create", {
      method: "POST",
      token,
      body: {
        email: `smoke.member${seat}.${STAMP}@example.com`,
        displayName: `Smoke Member ${seat}`,
        role: "cashier",
      },
    });

    if (created.status === 201) continue;

    refusedAt = seat;
    check(
      `creating member ${seat} is refused past the ceiling`,
      created.status === 403 && created.body.error?.code === "capacity_reached",
      created.body
    );
    check(
      "the refusal explains the ceiling",
      typeof created.body.message === "string" && created.body.message.includes(String(limit)),
      created.body.message
    );
    break;
  }

  check(`the ceiling bites at seat ${limit + 1}`, refusedAt === limit + 1, { refusedAt, limit });

  const finalUsage = await api("/subscription/usage", { token });
  const finalSeats = finalUsage.body.data?.capacities?.find((row: Json) => row.limit_key === "users");
  check("no seats are left", finalSeats?.remaining === 0, finalSeats);
  check("the workspace reports itself at its limit", finalSeats?.at_limit === true, finalSeats);

  console.log(
    failures === 0
      ? "\nAll subscription checks passed.\n"
      : `\n${failures} check(s) failed.\n`
  );

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nSmoke test could not run:", error);
  process.exit(1);
});

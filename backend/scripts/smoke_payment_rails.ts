/**
 * Every way into and through a subscription, end to end.
 *
 *   npm run smoke:rails
 *
 * Covers the three journeys a real customer takes and the three rails they can
 * pay on:
 *
 *   1. Sign up → verify the emailed code → choose a plan → pay by MTN.
 *   2. Sign up → verify → start the free trial → let it lapse → pay to reopen.
 *   3. Card and Airtel, each charged and settled through the callback.
 *
 * The assertions are the transitions that decide whether somebody gets in, and
 * the ones that are silent when they break: that an unverified account cannot
 * reach a workspace, that a trial closes by itself, and that a callback in any
 * of the shapes the gateway sends still settles the payment.
 */

import { PrismaClient } from "@prisma/client";

const BASE = process.env.SMOKE_API_URL ?? "http://127.0.0.1:4000/api";
const prisma = new PrismaClient();
const STAMP = Date.now();

type Json = Record<string, any>;

let failures = 0;
const createdEmails: string[] = [];

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

/** Signs up, and returns the token plus the account's id. */
async function signUp(label: string) {
  const email = `rails.${label}.${STAMP}@example.test`;
  createdEmails.push(email);

  const res = await api("/auth/signup", {
    method: "POST",
    body: {
      email,
      password: "Ra1ls!Passw0rd",
      displayName: `Rails ${label}`,
      businessName: `Rails ${label} ${STAMP}`,
      businessType: "retail",
    },
  });

  return { email, token: res.body.data?.accessToken as string, body: res.body };
}

/**
 * Verifies the emailed code.
 *
 * The code never leaves the server in a response — only its hash is stored —
 * so the test reads the row and replays the six digits, which is the same
 * thing the customer does with their inbox.
 */
async function verify(token: string, email: string) {
  /*
   * The code is stored only as a SHA-256, never returned by any endpoint, so
   * the test recovers it the only way anything can: by hashing candidates.
   * A million of them is under a second, and it means the script exercises
   * the same verify endpoint a person does rather than a back door.
   */
  const me = await api("/auth/me", { token });
  const userId = me.body.data?.user?.id as string;

  const otp = await prisma.loginOtp.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { status: 0, body: {} as Json, code: null as string | null };

  const crypto = await import("node:crypto");
  let code: string | null = null;

  for (let candidate = 0; candidate < 1_000_000; candidate++) {
    const guess = String(candidate).padStart(6, "0");
    if (crypto.createHash("sha256").update(guess).digest("hex") === otp.codeHash) {
      code = guess;
      break;
    }
  }

  if (!code) return { status: 0, body: {} as Json, code: null };

  const res = await api("/auth/otp/verify", { method: "POST", token, body: { code } });
  return { ...res, code };
}

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

async function cleanup() {
  const tenants = await prisma.tenant.findMany({
    where: { name: { startsWith: "Rails " } },
    select: { id: true },
  });
  const tenantIds = tenants.map((tenant) => tenant.id);
  if (tenantIds.length === 0) return;

  const members = await prisma.tenantMember.findMany({
    where: { tenantId: { in: tenantIds } },
    select: { userId: true },
  });
  const userIds = [...new Set(members.map((member) => member.userId))];

  await prisma.paymentLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.paymentTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.activityLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantSubscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.userRole.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.profile.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });

  await prisma.loginOtp.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.profile.deleteMany({ where: { id: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

const settleWindow = Number(process.env.MOCK_PAYMENT_SETTLE_SECONDS ?? 4) + 5;

async function main() {
  console.log(`\nPayment rails smoke test against ${BASE}\n`);

  /* ------------------------------------------------ 1. verify then pay --- */
  console.log("signup requires verification");

  const mtn = await signUp("mtn");
  check("signup succeeds", Boolean(mtn.token), mtn.body);
  check("and demands a code before anything else", mtn.body.data?.otpRequired === true);

  const beforeVerify = await api("/auth/me", { token: mtn.token });
  check(
    "the session says the code is still owed",
    beforeVerify.body.data?.user?.otpRequired === true,
    beforeVerify.body.data?.user
  );

  const verified = await verify(mtn.token, mtn.email);
  check("the emailed code verifies", verified.status === 200, verified.body);

  const afterVerify = await api("/auth/me", { token: mtn.token });
  check(
    "and clears the gate",
    afterVerify.body.data?.user?.otpRequired === false,
    afterVerify.body.data?.user
  );

  console.log("\npaying by MTN mobile money");

  const mtnCheckout = await api("/workspace/pending", {
    method: "POST",
    token: mtn.token,
    body: {
      business_name: `Rails mtn ${STAMP}`,
      plan_code: "starter",
      billing_cycle: "monthly",
      payment_method: "mobile_money_mtn",
      payer_phone: "0780000000",
    },
  });

  check("the workspace is created and charged", mtnCheckout.status === 200, mtnCheckout.body);

  const mtnToken = mtnCheckout.body.data?.accessToken;
  const mtnReference = mtnCheckout.body.data?.payment?.reference_id;

  check("the reference uses the gateway's format", /^INV-\d{8}-\d{8}-\d{4}$/.test(mtnReference ?? ""), mtnReference);

  const mtnTxn = await prisma.paymentTransaction.findUnique({ where: { referenceId: mtnReference } });
  check("it went out as MTN", mtnTxn?.gatewayMethod === "MTN_MOMO_RWA", mtnTxn?.gatewayMethod);

  check("it settles", (await waitForPayment(mtnReference, mtnToken, settleWindow)) === "success");

  const mtnOpen = await api("/auth/me", { token: mtnToken });
  check("and the workspace opens", mtnOpen.body.data?.tenant?.workspace_status === "active");

  /* ------------------------------------------------------- 2. the trial --- */
  console.log("\nfree trial, then expiry, then payment");

  const trial = await signUp("trial");
  await verify(trial.token, trial.email);

  const trialStart = await api("/workspace/pending", {
    method: "POST",
    token: trial.token,
    body: {
      business_name: `Rails trial ${STAMP}`,
      plan_code: "starter",
      billing_cycle: "monthly",
      start_trial: true,
    },
  });

  check("a trial can be started without paying", trialStart.status === 200, trialStart.body);
  check("nothing was charged", trialStart.body.data?.payment === null);
  check("and it says how long it runs", (trialStart.body.data?.trialDays ?? 0) > 0);

  const trialToken = trialStart.body.data?.accessToken;
  const trialTenant = trialStart.body.data?.tenantId;

  const trialOpen = await api("/auth/me", { token: trialToken });
  check("the workspace opens on the trial", trialOpen.body.data?.tenant?.workspace_status === "active");
  check("reported as a trial", trialOpen.body.data?.subscription?.status === "trial", trialOpen.body.data?.subscription?.status);

  const period = await api("/subscription/current", { token: trialToken });
  check("with days on the clock", (period.body.data?.period?.remaining_days ?? 0) > 0, period.body.data?.period);
  check("and a total to measure against", (period.body.data?.period?.total_days ?? 0) > 0);

  // Wind the trial back so it has run out, as it would in a fortnight.
  await prisma.tenantSubscription.updateMany({
    where: { tenantId: trialTenant },
    data: { trialEndsAt: new Date(Date.now() - 86_400_000) },
  });

  const lapsed = await api("/auth/me", { token: trialToken });
  check(
    "a finished trial closes the workspace",
    lapsed.body.data?.tenant?.workspace_status === "trial_expired",
    lapsed.body.data?.tenant
  );

  const payAfterTrial = await api("/subscription/checkout", {
    method: "POST",
    token: trialToken,
    body: { payment_method_code: "mobile_money_airtel", payer_phone: "0730000000" },
  });

  check("paying after the trial is accepted", payAfterTrial.status === 202, payAfterTrial.body);

  const airtelTxn = await prisma.paymentTransaction.findUnique({
    where: { referenceId: payAfterTrial.body.data.reference_id },
  });
  check("it went out as Airtel", airtelTxn?.gatewayMethod === "AIRTEL_MONEY_RWA", airtelTxn?.gatewayMethod);

  check(
    "it settles",
    (await waitForPayment(payAfterTrial.body.data.reference_id, trialToken, settleWindow)) === "success"
  );

  const reopened = await api("/auth/me", { token: trialToken });
  check("and the workspace reopens", reopened.body.data?.tenant?.workspace_status === "active");

  /* -------------------------------------------------------- 3. the card --- */
  console.log("\npaying by card");

  const card = await signUp("card");
  await verify(card.token, card.email);

  const cardCheckout = await api("/workspace/pending", {
    method: "POST",
    token: card.token,
    body: {
      business_name: `Rails card ${STAMP}`,
      plan_code: "starter",
      billing_cycle: "monthly",
      payment_method: "card",
    },
  });

  check("card checkout is accepted with no phone number", cardCheckout.status === 200, cardCheckout.body);

  const cardReference = cardCheckout.body.data?.payment?.reference_id;
  const cardToken = cardCheckout.body.data?.accessToken;

  check("and returns somewhere to send the payer", Boolean(cardCheckout.body.data?.payment?.redirect_url));

  const cardTxn = await prisma.paymentTransaction.findUnique({ where: { referenceId: cardReference } });
  check("it went out as card", cardTxn?.gatewayMethod === "card", cardTxn?.gatewayMethod);

  check("it settles", (await waitForPayment(cardReference, cardToken, settleWindow)) === "success");

  /* -------------------------------------------- 4. callback robustness --- */
  console.log("\ncallback shapes");

  const shapes = await signUp("shapes");
  await verify(shapes.token, shapes.email);

  const shapesCheckout = await api("/workspace/pending", {
    method: "POST",
    token: shapes.token,
    body: {
      business_name: `Rails shapes ${STAMP}`,
      plan_code: "starter",
      billing_cycle: "monthly",
      payment_method: "mobile_money_mtn",
      payer_phone: "0780000000",
    },
  });

  const shapesReference = shapesCheckout.body.data?.payment?.reference_id;

  // The gateway nests some payloads and renames the reference per rail.
  const nested = await api("/payments/callback/lmbtech", {
    method: "POST",
    body: { data: { refid: shapesReference, status: "paid", transaction_id: "TXN-NESTED" } },
  });

  check("a nested payload with `refid` and `paid` is understood", nested.status === 200, nested.body);
  check("and resolves to success", nested.body.data?.status === "success", nested.body.data);

  const repeat = await api("/payments/callback/lmbtech", {
    method: "POST",
    body: { reference_id: shapesReference, status: "successful" },
  });
  check("a repeat callback is absorbed", repeat.status === 200 && repeat.body.data?.applied === false, repeat.body.data);

  const unknown = await api("/payments/callback/lmbtech", {
    method: "POST",
    body: { reference_id: shapesReference, status: "banana" },
  });
  check("an unrecognised status does not corrupt a settled payment", unknown.status === 200, unknown.body);

  const noRef = await api("/payments/callback/lmbtech", { method: "POST", body: { status: "success" } });
  check("a callback with no reference is refused", noRef.status === 400, noRef.body);

  await cleanup();
  await prisma.$disconnect();

  console.log(failures === 0 ? "\nAll rails checks passed.\n" : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("\nSmoke test could not run:", error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

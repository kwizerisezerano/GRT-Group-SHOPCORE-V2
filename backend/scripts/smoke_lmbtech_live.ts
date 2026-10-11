/**
 * A real charge against LMBTech, through our own driver.
 *
 * Not part of `npm test` and never run in CI: it moves actual money on a real
 * account. It exists because the gateway's documented shapes and its live
 * shapes differ in ways that only a real call reveals — the auth scheme, the
 * flat (not wrapped) verify payload, and the fact that `pay` blocks until the
 * payer approves the prompt rather than returning when it is delivered.
 *
 *   npx tsx scripts/smoke_lmbtech_live.ts 0791545579 100
 *
 * The payer must approve the prompt on the handset for this to reach
 * "success"; left unapproved it stays pending, which is itself the correct
 * result and is reported as such.
 */
import { env } from "../src/config/env";
import {
  buildReferenceId,
  fetchRemoteStatus,
  initiateCollection,
  normalizePhone,
  MTN_GATEWAY_METHOD,
} from "../src/lib/payments/lmbtech";

const phone = process.argv[2] ?? "0791545579";
const amount = Number(process.argv[3] ?? 100);

function line(label: string, value: unknown) {
  console.log(`  ${label.padEnd(16)} ${typeof value === "string" ? value : JSON.stringify(value)}`);
}

async function main() {
  console.log("\nconfiguration");
  line("driver", env.PAYMENTS_DRIVER);
  line("endpoint", env.API_URL);
  line("app key", env.LMB_APP_KEY ? `${env.LMB_APP_KEY.slice(0, 8)}…` : "(missing)");
  line("secret key", env.LMB_SECRET_KEY ? `${env.LMB_SECRET_KEY.slice(0, 8)}…` : "(missing)");
  line("configured", env.paymentsConfigured);

  if (env.PAYMENTS_DRIVER === "mock") {
    console.error("\nPAYMENTS_DRIVER is mock — nothing would leave the process. Aborting.\n");
    process.exit(1);
  }

  const referenceId = buildReferenceId("INV");
  const payerPhone = normalizePhone(phone, env.SMS_DEFAULT_COUNTRY_CODE);

  console.log("\ncharge");
  line("reference", referenceId);
  line("phone", payerPhone);
  line("amount", `${amount} RWF`);
  line("method", MTN_GATEWAY_METHOD);

  let initiateMessage = "";

  try {
    const result = await initiateCollection(
      {
        referenceId,
        amount,
        method: MTN_GATEWAY_METHOD,
        email: "billing@shopcore.rw",
        name: "ShopCore live check",
        servicePaid: "ShopCore subscription check",
        payerPhone,
        callbackUrl: env.paymentCallbackUrl,
        cardRedirectUrl: null,
      },
      {}
    );

    initiateMessage = result.message;
    console.log("\ninitiate returned");
    line("status", result.status);
    line("message", result.message);
    line("txn id", result.providerTxnId ?? "(none yet)");
  } catch (error) {
    const timedOut = (error as { timedOut?: boolean }).timedOut === true;
    console.log("\ninitiate threw");
    line("timed out", timedOut);
    line("message", error instanceof Error ? error.message : String(error));

    if (!timedOut) {
      console.error("\nThat is a real gateway rejection, not a wait. Stopping.\n");
      process.exit(1);
    }

    console.log("\n  A timeout here is expected: their endpoint holds the call open");
    console.log("  until the prompt is approved. Asking the verify endpoint instead.");
  }

  console.log("\nwatching (approve the prompt on the handset)");

  let last = "";
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const remote = await fetchRemoteStatus(referenceId, {});

    if (!remote) {
      console.log(`  ${String(attempt).padStart(2)}  the gateway does not know this reference`);
      continue;
    }

    if (remote.status !== last) {
      console.log(`  ${String(attempt).padStart(2)}  ${remote.status} — ${remote.message}`);
      last = remote.status;
    } else {
      console.log(`  ${String(attempt).padStart(2)}  ${remote.status}`);
    }

    if (remote.status !== "pending") {
      console.log("\nsettled");
      line("status", remote.status);
      line("txn id", remote.providerTxnId ?? "(none)");
      line("amount", remote.amount ?? "(not reported)");
      line("raw", remote.raw);
      console.log(
        remote.status === "success"
          ? "\nPayment confirmed by the gateway.\n"
          : `\nPayment ended as "${remote.status}".\n`
      );
      process.exit(remote.status === "success" ? 0 : 2);
    }
  }

  console.log(`\nStill pending after two minutes (initiate said: ${initiateMessage || "—"}).`);
  console.log("That means the prompt was never approved on the handset.\n");
  process.exit(3);
}

main().catch((error) => {
  console.error("\nunexpected failure:", error);
  process.exit(1);
});

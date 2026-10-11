import "dotenv/config";
import { env } from "../src/config/env";
import { normalizePhone } from "../src/lib/sms/notifications";
import { getSmsTransport } from "../src/lib/sms/transport";

/**
 * Sends one real text, to prove the gateway works.
 *
 * Worth having as its own command because SMS is deliberately fire-and-forget
 * everywhere else: a failed send is logged and swallowed so it cannot break
 * the account creation or sign-in that triggered it. That is the right
 * behaviour in the application and a terrible one for finding out whether the
 * credentials are valid — the failure never reaches a screen. Here the error
 * is the output.
 *
 *   npm run sms:test -- 0788123456
 */

async function main() {
  const raw = process.argv[2];

  if (!raw) {
    console.error("Usage: npm run sms:test -- <phone number>");
    console.error("Example: npm run sms:test -- 0788123456");
    process.exit(1);
  }

  const to = normalizePhone(raw);
  if (!to) {
    console.error(`"${raw}" is not a usable phone number.`);
    process.exit(1);
  }

  const transport = getSmsTransport();

  if (transport.name !== "hdev") {
    console.error(
      "SMS is not configured, so this would only print to the console.\n" +
        "Set HDEV_API_ID and HDEV_API_KEY in backend/.env and try again."
    );
    process.exit(1);
  }

  console.log(`Endpoint: ${env.HDEV_SMS_URL}/<api_id>/<api_key>`);
  console.log(`Sender:   ${env.HDEV_SENDER_ID}`);
  console.log(`To:       ${to}  (from "${raw}")`);
  console.log("");

  const message = `ShopCore test message. If you received this, SMS is working. Sent ${new Date()
    .toISOString()
    .slice(11, 16)} UTC.`;

  try {
    await transport.send({ to, message });
    console.log("Sent. The gateway accepted the message.");
    console.log("If nothing arrives, the number or the sender id is the next thing to check.");
  } catch (error) {
    // The gateway's own wording is the useful part: "insufficient balance"
    // and "unknown sender id" are both refusals someone has to act on.
    console.error("Failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void main();

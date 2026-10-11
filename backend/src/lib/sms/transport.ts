import { env } from "../../config/env";

export type OutboundSms = {
  /** E.164-ish digits, no leading +. Normalised by lib/sms/notifications. */
  to: string;
  message: string;
};

export interface SmsTransport {
  send(message: OutboundSms): Promise<void>;
  readonly name: string;
}

/**
 * Production transport: HDev's SMS API.
 *
 * Shaped to match the gateway's own PHP client exactly, because the wire
 * format is not what a REST API would suggest and guessing it produced a
 * transport that never delivered anything:
 *
 *   - the credentials are path segments, not body fields or headers, so the
 *     endpoint is `.../api_pay/api/{api_id}/{api_key}`;
 *   - the body is form data, not JSON;
 *   - `ref` selects the operation — this account's key also does mobile-money
 *     top-ups, and without `ref=sms` the gateway does not know which it is;
 *   - the recipient field is `tel`, singular.
 *
 * The gateway answers 200 for both success and refusal, distinguishing them
 * in the body, so the status code alone is not enough to know a message went
 * anywhere. A non-2xx status *and* a failing body are both treated as errors,
 * because a send that silently failed is worse than one that threw: the whole
 * point of the second channel is knowing the credential arrived.
 */
export class HdevTransport implements SmsTransport {
  readonly name = "hdev";

  async send(message: OutboundSms): Promise<void> {
    const base = env.HDEV_SMS_URL.replace(/\/+$/, "");
    const url = `${base}/${encodeURIComponent(env.HDEV_API_ID)}/${encodeURIComponent(env.HDEV_API_KEY)}`;

    /*
     * FormData rather than a JSON string: the reference client posts a curl
     * array, which is multipart/form-data, and the endpoint reads $_POST.
     * fetch sets the boundary itself, so no Content-Type header here — one
     * written by hand would be missing the boundary and the body unreadable.
     */
    const form = new FormData();
    form.set("ref", "sms");
    form.set("sender_id", env.HDEV_SENDER_ID);
    form.set("tel", message.to);
    form.set("message", message.message);
    form.set("link", "");

    const response = await fetch(url, { method: "POST", body: form });
    const raw = (await response.text().catch(() => "")).trim();

    if (!response.ok) {
      throw new Error(`HDev SMS API error (${response.status}): ${truncate(raw)}`);
    }

    /*
     * A 200 carrying a failure is the case worth catching. The body is JSON
     * when the gateway is healthy, so anything unparseable is itself a
     * problem rather than something to shrug at — a PHP notice or an HTML
     * error page comes back with a 200 and would otherwise read as success.
     */
    type GatewayReply = { success?: boolean; status?: number | string; message?: string };

    let parsed: GatewayReply;
    try {
      parsed = JSON.parse(raw) as GatewayReply;
    } catch {
      throw new Error(`HDev SMS API returned a non-JSON body: ${truncate(raw)}`);
    }

    const status = String(parsed.status ?? "").toLowerCase();
    const accepted = parsed.success === true || status === "200" || status === "success" || status === "ok";

    if (!accepted) {
      // The gateway's own wording is the useful part — "insufficient balance"
      // and "unknown sender id" are both refusals a person has to act on.
      throw new Error(`HDev SMS API refused the message: ${parsed.message ?? truncate(raw)}`);
    }
  }
}

function truncate(text: string): string {
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

/**
 * Development transport: prints the message instead of sending it, so the
 * whole notification path runs locally with no gateway account and no risk of
 * texting a real person from a dev database.
 */
class ConsoleSmsTransport implements SmsTransport {
  readonly name = "console";

  async send(message: OutboundSms): Promise<void> {
    console.log(
      [
        "",
        "──────────── sms (not sent — no HDEV_API_ID/KEY) ────────────",
        `to:   ${message.to}`,
        `from: ${env.HDEV_SENDER_ID}`,
        "",
        message.message,
        "─────────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
  }
}

/** Test transport: captures messages in memory for assertions. */
export class MemorySmsTransport implements SmsTransport {
  readonly name = "memory";
  readonly sent: OutboundSms[] = [];

  async send(message: OutboundSms): Promise<void> {
    this.sent.push(message);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

let transport: SmsTransport =
  env.HDEV_API_ID && env.HDEV_API_KEY ? new HdevTransport() : new ConsoleSmsTransport();

export function getSmsTransport(): SmsTransport {
  return transport;
}

/** Swaps the transport. Intended for tests. */
export function setSmsTransport(next: SmsTransport): void {
  transport = next;
}

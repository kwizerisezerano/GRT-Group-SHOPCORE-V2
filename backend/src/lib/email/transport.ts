import { env } from "../../config/env";

export type OutboundEmail = {
  to: string;
  bcc?: string | string[];
  subject: string;
  html: string;
  text: string;
  /**
   * Files to attach. Used for the invoice PDF, which is the one message where
   * the customer needs something they can keep and forward to an accountant.
   *
   * Kept out of the templated `sendNotification` path deliberately: everything
   * else here is a short transactional note, and a notification system that
   * can attach arbitrary bytes is one that eventually mails something it
   * should not.
   */
  attachments?: { filename: string; content: Buffer }[];
};

/**
 * A stable, unique id per message.
 *
 * Gmail collapses messages whose subject and sender repeat — so two
 * verification codes in a row can end up threaded, with the older one shown
 * expanded and the newer one hidden behind "show trimmed content". Giving
 * every send its own reference stops that.
 */
function messageRef(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface EmailTransport {
  send(message: OutboundEmail): Promise<void>;
  readonly name: string;
}

/** Production transport: Resend's HTTP API. */
class ResendTransport implements EmailTransport {
  readonly name = "resend";

  async send(message: OutboundEmail): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      /*
       * `text` is not a courtesy — a message with no plain-text alternative
       * is one of the oldest and strongest spam signals there is, and every
       * template here renders both. Reply-To is sent when configured for the
       * same reason: transactional mail from an address that bounces replies
       * scores worse than mail a person can answer.
       */
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: message.to,
        ...(message.bcc ? { bcc: message.bcc } : {}),
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.attachments?.length
          ? {
              // Resend takes attachment bytes base64-encoded.
              attachments: message.attachments.map((file) => ({
                filename: file.filename,
                content: file.content.toString("base64"),
              })),
            }
          : {}),
        ...(env.RESEND_REPLY_TO ? { reply_to: env.RESEND_REPLY_TO } : {}),
        headers: {
          "X-Entity-Ref-ID": messageRef(),
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Resend API error (${response.status}): ${body}`);
    }
  }
}

/**
 * Development transport: prints the message instead of sending it, so the
 * whole notification path runs locally with no provider account and no risk
 * of mailing a real person from a dev database.
 */
class ConsoleTransport implements EmailTransport {
  readonly name = "console";

  async send(message: OutboundEmail): Promise<void> {
    console.log(
      [
        "",
        "──────────── email (not sent — no RESEND_API_KEY) ────────────",
        `to:      ${message.to}`,
        `subject: ${message.subject}`,
        ...(message.attachments?.length
          ? [
              `attached: ${message.attachments
                .map((file) => `${file.filename} (${Math.ceil(file.content.length / 1024)} KB)`)
                .join(", ")}`,
            ]
          : []),
        "",
        message.text,
        "──────────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
  }
}

/** Test transport: captures messages in memory for assertions. */
export class MemoryTransport implements EmailTransport {
  readonly name = "memory";
  readonly sent: OutboundEmail[] = [];

  async send(message: OutboundEmail): Promise<void> {
    this.sent.push(message);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

let transport: EmailTransport = env.RESEND_API_KEY ? new ResendTransport() : new ConsoleTransport();

export function getTransport(): EmailTransport {
  return transport;
}

/** Swaps the transport. Intended for tests. */
export function setTransport(next: EmailTransport): void {
  transport = next;
}

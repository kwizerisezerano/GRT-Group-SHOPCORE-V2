import { env } from "../../config/env";

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

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
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import { normalizePhone, sendLoginOtpSms, sendUserInvitedSms } from "./notifications";
import { MemorySmsTransport, getSmsTransport, setSmsTransport } from "./transport";

/**
 * Transactional SMS.
 *
 * The number handling is the part that matters. People write phone numbers in
 * every shape there is, and a malformed one posted to the gateway is a message
 * that silently goes nowhere — for an invitation, that means a temporary
 * password nobody receives and an account nobody can enter, because the
 * password is stored only as a hash.
 */

let outbox: MemorySmsTransport;
const original = getSmsTransport();

beforeEach(() => {
  outbox = new MemorySmsTransport();
  setSmsTransport(outbox);
});

afterEach(() => setSmsTransport(original));

describe("phone numbers", () => {
  it.each([
    ["+250788123456", "250788123456"],
    ["250788123456", "250788123456"],
    ["0788123456", "250788123456"],
    ["+250 788 123 456", "250788123456"],
    ["0788-123-456", "250788123456"],
    ["(078) 812 3456", "250788123456"],
    ["  +250788123456  ", "250788123456"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([[null], [undefined], [""], ["   "], ["abc"], ["12"], ["+"]])(
    "refuses %s rather than posting rubbish to the gateway",
    (input) => {
      expect(normalizePhone(input as string | null | undefined)).toBeNull();
    },
  );

  it("honours a different country code", () => {
    expect(normalizePhone("0712345678", "254")).toBe("254712345678");
  });
});

describe("sending", () => {
  it("texts a new member their credentials", async () => {
    const sent = await sendUserInvitedSms({
      to: "0788123456",
      workspace: "Patrick shop",
      email: "sam@example.rw",
      tempPassword: "Tmp-9x4Qa2",
    });

    expect(sent).toBe(true);
    expect(outbox.sent).toHaveLength(1);

    const [message] = outbox.sent;
    expect(message.to).toBe("250788123456");
    expect(message.message).toContain("Patrick shop");
    expect(message.message).toContain("sam@example.rw");
    // The credential is the whole point of the message.
    expect(message.message).toContain("Tmp-9x4Qa2");
  });

  it("texts a sign-in code", async () => {
    await sendLoginOtpSms({ to: "+250788123456", code: "482917", minutes: 10 });

    const [message] = outbox.sent;
    expect(message.message).toContain("482917");
    expect(message.message).toContain("10");
  });

  it("sends nothing when there is no usable number", async () => {
    expect(await sendLoginOtpSms({ to: null, code: "482917", minutes: 10 })).toBe(false);
    expect(await sendLoginOtpSms({ to: "not a phone", code: "482917", minutes: 10 })).toBe(false);
    expect(outbox.sent).toHaveLength(0);
  });

  it("returns false instead of throwing when the gateway fails", async () => {
    /*
     * Same contract as the email sender: the account has already been
     * created by the time this runs, so a gateway outage must not surface as
     * a failed request.
     */
    setSmsTransport({
      name: "broken",
      async send() {
        throw new Error("gateway down");
      },
    });

    await expect(
      sendLoginOtpSms({ to: "0788123456", code: "482917", minutes: 10 }),
    ).resolves.toBe(false);
  });

  it("renders in every supported language, leaving no placeholder behind", async () => {
    for (const language of SUPPORTED_LANGUAGES) {
      outbox.clear();
      await sendUserInvitedSms({
        to: "0788123456",
        workspace: "W",
        email: "a@b.io",
        tempPassword: "Tmp-1",
        language,
      });

      const [message] = outbox.sent;
      expect(message.message).not.toMatch(/\{\{\w+\}\}/);
      // A missing key would render as the raw dotted path.
      expect(message.message).not.toContain("sms.");
    }
  });

  it("keeps every message inside one billable segment", async () => {
    /*
     * 160 characters is one SMS. Past that the gateway splits the message,
     * which costs twice and can arrive out of order — badly, when the thing
     * being split is a password.
     */
    for (const language of SUPPORTED_LANGUAGES) {
      outbox.clear();
      await sendUserInvitedSms({
        to: "0788123456",
        workspace: "Patrick shop",
        email: "sam@example.rw",
        tempPassword: "Tmp-9x4Qa2!z",
        language,
      });

      expect(outbox.sent[0].message.length).toBeLessThanOrEqual(160);
    }
  });
});

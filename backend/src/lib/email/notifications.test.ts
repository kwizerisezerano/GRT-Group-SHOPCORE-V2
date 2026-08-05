import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import {
  sendAccountCreatedEmail,
  sendNotification,
  sendPasswordResetEmail,
  sendSubscriptionActivatedEmail,
} from "./notifications";
import { MemoryTransport, getTransport, setTransport } from "./transport";

let mailbox: MemoryTransport;
const original = getTransport();

beforeEach(() => {
  mailbox = new MemoryTransport();
  setTransport(mailbox);
});

afterEach(() => setTransport(original));

describe("rendering", () => {
  it("sends a subject, HTML and plain-text alternative", async () => {
    await sendAccountCreatedEmail({
      to: "ada@shopcore.io",
      name: "Ada",
      workspace: "Ada Retail",
    });

    expect(mailbox.sent).toHaveLength(1);
    const [mail] = mailbox.sent;
    expect(mail.to).toBe("ada@shopcore.io");
    expect(mail.subject).toBe("Welcome to ShopCore");
    expect(mail.html).toContain("<!doctype html>");
    expect(mail.text).not.toContain("<");
  });

  it("interpolates every parameter, leaving no placeholder behind", async () => {
    await sendSubscriptionActivatedEmail({
      to: "ada@shopcore.io",
      name: "Ada",
      workspace: "Ada Retail",
      plan: "professional",
      cycle: "annual",
    });

    const [mail] = mailbox.sent;
    expect(mail.text).toContain("Ada Retail");
    expect(mail.text).toContain("professional");
    expect(mail.text).toContain("annual");
    expect(mail.text).not.toMatch(/\{\{\w+\}\}/);
    expect(mail.html).not.toMatch(/\{\{\w+\}\}/);
  });

  it("builds an absolute action URL from a relative path", async () => {
    await sendPasswordResetEmail({
      to: "ada@shopcore.io",
      name: "Ada",
      resetToken: "tok123",
    });

    const [mail] = mailbox.sent;
    expect(mail.text).toContain("http://127.0.0.1:5173/reset-password?token=tok123");
  });

  it("url-encodes the reset token", async () => {
    await sendPasswordResetEmail({
      to: "ada@shopcore.io",
      name: "Ada",
      resetToken: "a+b/c=d",
    });

    expect(mailbox.sent[0].text).toContain("token=a%2Bb%2Fc%3Dd");
  });

  it("escapes HTML in user-supplied values", async () => {
    // Display names are user input and land in the HTML body.
    await sendAccountCreatedEmail({
      to: "x@shopcore.io",
      name: '<script>alert("xss")</script>',
      workspace: "Ada & Sons <Retail>",
    });

    const [mail] = mailbox.sent;
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("Ada &amp; Sons");
  });

  it("includes the ignore notice only on security-sensitive mail", async () => {
    await sendPasswordResetEmail({ to: "a@b.io", name: "A", resetToken: "t" });
    expect(mailbox.sent[0].text).toContain("safely ignore");

    mailbox.clear();
    await sendAccountCreatedEmail({ to: "a@b.io", name: "A", workspace: "W" });
    expect(mailbox.sent[0].text).not.toContain("safely ignore");
  });
});

describe("language selection", () => {
  it("renders the subject in the requested language", async () => {
    const subjects: Record<string, string> = {};

    for (const language of ["en", "fr", "es", "sw"] as const) {
      mailbox.clear();
      await sendAccountCreatedEmail({ to: "a@b.io", name: "A", workspace: "W", language });
      subjects[language] = mailbox.sent[0].subject;
    }

    expect(subjects.fr).toBe("Bienvenue sur ShopCore");
    expect(subjects.es).toBe("Bienvenido a ShopCore");
    expect(subjects.sw).toBe("Karibu ShopCore");
    expect(new Set(Object.values(subjects)).size).toBe(4);
  });

  it("sets the html lang attribute to the chosen language", async () => {
    await sendAccountCreatedEmail({ to: "a@b.io", name: "A", workspace: "W", language: "es" });
    expect(mailbox.sent[0].html).toContain('<html lang="es">');
  });

  it("falls back to English for an unsupported or missing language", async () => {
    for (const language of ["de", "", null, undefined]) {
      mailbox.clear();
      await sendAccountCreatedEmail({ to: "a@b.io", name: "A", workspace: "W", language });
      expect(mailbox.sent[0].subject).toBe("Welcome to ShopCore");
    }
  });

  it("renders every template in every supported language without placeholders", async () => {
    for (const language of SUPPORTED_LANGUAGES) {
      mailbox.clear();
      await sendSubscriptionActivatedEmail({
        to: "a@b.io",
        name: "A",
        workspace: "W",
        plan: "starter",
        cycle: "monthly",
        language,
      });

      const [mail] = mailbox.sent;
      expect(mail.subject.length).toBeGreaterThan(0);
      expect(mail.text).not.toMatch(/\{\{\w+\}\}/);
      // A missing key would render as the raw dotted path.
      expect(mail.subject).not.toContain("email.");
    }
  });
});

describe("failure handling", () => {
  it("returns false instead of throwing when the transport fails", async () => {
    setTransport({
      name: "broken",
      async send() {
        throw new Error("smtp exploded");
      },
    });

    // A signup that already committed must not fail because its welcome
    // email bounced.
    await expect(
      sendAccountCreatedEmail({ to: "a@b.io", name: "A", workspace: "W" })
    ).resolves.toBe(false);
  });

  it("returns true on success", async () => {
    await expect(
      sendNotification({
        to: "a@b.io",
        template: "accountCreated",
        params: { name: "A", workspace: "W" },
      })
    ).resolves.toBe(true);
  });
});

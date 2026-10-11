import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../config/env";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import {
  sendAccountCreatedEmail,
  sendLoginOtpEmail,
  sendNotification,
  sendPasswordResetEmail,
  sendSubscriptionActivatedEmail,
} from "./notifications";
import { MemoryTransport, getTransport, setTransport } from "./transport";

let mailbox: MemoryTransport;
const original = getTransport();
const originalFrontendUrl = env.FRONTEND_URL;

beforeEach(() => {
  mailbox = new MemoryTransport();
  setTransport(mailbox);
});

afterEach(() => {
  setTransport(original);
  env.FRONTEND_URL = originalFrontendUrl;
});

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
    env.FRONTEND_URL = "https://app.shopcore.example";

    await sendPasswordResetEmail({
      to: "ada@shopcore.io",
      name: "Ada",
      resetToken: "tok123",
    });

    const [mail] = mailbox.sent;
    expect(mail.text).toContain("https://app.shopcore.example/reset-password?token=tok123");
  });

  it("url-encodes the reset token", async () => {
    env.FRONTEND_URL = "https://app.shopcore.example";

    await sendPasswordResetEmail({
      to: "ada@shopcore.io",
      name: "Ada",
      resetToken: "a+b/c=d",
    });

    expect(mailbox.sent[0].text).toContain("token=a%2Bb%2Fc%3Dd");
  });

  /*
   * The spam control. A link to localhost or a bare IP over plain HTTP is the
   * shape of a phishing link, weighs heavily with filters, and points the
   * recipient at their own machine — so where the message works without it,
   * no link is better than that link.
   */
  it.each([
    ["the development default", "http://127.0.0.1:5173"],
    ["plain http on a real host", "http://app.shopcore.example"],
    ["localhost", "https://localhost:5173"],
    ["a bare IP", "https://203.0.113.10"],
  ])("omits an optional call to action when the base URL is %s", async (_label, base) => {
    env.FRONTEND_URL = base;

    await sendAccountCreatedEmail({ to: "ada@shopcore.io", name: "Ada", workspace: "Ada Retail" });

    const [mail] = mailbox.sent;
    expect(mail.text).not.toContain("127.0.0.1");
    expect(mail.text).not.toContain("localhost");
    expect(mail.text).not.toContain("http://");
    expect(mail.html).not.toContain("<a href");

    // The message still delivers and still explains itself.
    expect(mail.subject.length).toBeGreaterThan(0);
    expect(mail.text).toContain("Ada Retail");
  });

  /*
   * The deliberate exception. A reset link is not a convenience — it is the
   * only way to complete the action, so dropping it would trade a spam
   * problem for a flow nobody can finish. It ships regardless, and the
   * server warning plus the failing preflight are what stop a bad
   * FRONTEND_URL reaching production.
   */
  it("keeps the reset link even when it is not publicly reachable", async () => {
    env.FRONTEND_URL = "http://127.0.0.1:5173";

    await sendPasswordResetEmail({ to: "ada@shopcore.io", name: "Ada", resetToken: "tok123" });

    expect(mailbox.sent[0].text).toContain("reset-password?token=tok123");
  });

  it("still carries a verification code when links are suppressed", async () => {
    env.FRONTEND_URL = "http://127.0.0.1:5173";

    await sendLoginOtpEmail({ to: "ada@shopcore.io", name: "Ada", code: "482917", minutes: 10 });

    const [mail] = mailbox.sent;
    expect(mail.text).toContain("482917");
    expect(mail.html).toContain("482917");
    expect(mail.text).not.toContain("127.0.0.1");
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

describe("workspace header", () => {
  it("names the workspace in both the HTML and the text alternative", async () => {
    await sendAccountCreatedEmail({
      to: "ada@shopcore.io",
      name: "Ada",
      workspace: "Ada Retail",
    });

    const [mail] = mailbox.sent;
    expect(mail.html).toContain("Ada Retail");
    expect(mail.text).toContain("Workspace: Ada Retail");
  });

  it("carries the workspace on mail whose body copy never mentions it", async () => {
    // A verification code says nothing about which business sent it, so the
    // header is the only thing that can answer that.
    await sendLoginOtpEmail({
      to: "ada@shopcore.io",
      name: "Ada",
      code: "482917",
      minutes: 10,
      workspace: "Ada Retail",
    });

    const [mail] = mailbox.sent;
    expect(mail.html).toContain("Ada Retail");
    expect(mail.text).toContain("Workspace: Ada Retail");
    expect(mail.html).toContain("482917");
  });

  it("labels the workspace in the recipient's language", async () => {
    await sendLoginOtpEmail({
      to: "ada@shopcore.io",
      name: "Ada",
      code: "482917",
      minutes: 10,
      workspace: "Ada Retail",
      language: "fr",
    });

    expect(mailbox.sent[0].text).toContain("Espace de travail: Ada Retail");
  });

  it("omits the workspace line entirely when there is none to name", async () => {
    // A reset can be asked for by someone whose tenant was never finished.
    await sendPasswordResetEmail({ to: "ada@shopcore.io", name: "Ada", resetToken: "t" });

    const [mail] = mailbox.sent;
    expect(mail.text).not.toContain("Workspace:");
    expect(mail.text).not.toContain("undefined");
    expect(mail.html).not.toContain("undefined");
  });

  it("escapes a workspace name that contains markup", async () => {
    await sendLoginOtpEmail({
      to: "ada@shopcore.io",
      name: "Ada",
      code: "482917",
      minutes: 10,
      workspace: '<img src=x onerror="alert(1)">',
    });

    const [mail] = mailbox.sent;
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;img");
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

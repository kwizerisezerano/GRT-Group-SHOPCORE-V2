import { env } from "../../config/env";
import { DEFAULT_LANGUAGE, Language, MessageKey, isSupportedLanguage, translate } from "../../i18n";
import { getTransport } from "./transport";

/**
 * Transactional email for the events the requirements call out: account
 * notifications, user actions, transaction updates and system alerts.
 *
 * Every template is defined once here and rendered from the shared i18n
 * catalogue, so a new notification means adding a template entry and its
 * translations — never a new bespoke send function with its own HTML.
 */

export type NotificationTemplate =
  | "accountCreated"
  | "passwordReset"
  | "passwordChanged"
  | "subscriptionActivated"
  | "userInvitedWithCredentials"
  | "loginOtp";

/**
 * What each template needs interpolated. Typing this per template means a
 * caller cannot forget a placeholder — omitting `workspace` from
 * accountCreated is a compile error, not an email reading "the workspace
 * {{workspace}}".
 */
type TemplateParams = {
  accountCreated: { name: string; workspace: string };
  passwordReset: { name: string };
  passwordChanged: { name: string };
  subscriptionActivated: { name: string; workspace: string; plan: string; cycle: string };
  /*
   * The deliberate exception to "never put a password in a log or response":
   * this one field's entire purpose is to reach the outbound email body, and
   * nowhere else. See sendUserInvitedWithCredentialsEmail below.
   */
  userInvitedWithCredentials: {
    name: string;
    workspace: string;
    email: string;
    tempPassword: string;
    /** Shown so the recipient knows what they have been given access as. */
    role: string;
  };
  /*
   * Same exception as above: the code exists to reach this one email and
   * is never logged or returned to a caller. See auth.service.ts requestLoginOtp.
   */
  loginOtp: { name: string; code: string; minutes: string };
};

type SendOptions<T extends NotificationTemplate> = {
  to: string;
  template: T;
  language?: string | null;
  params: TemplateParams[T];
  /**
   * The workspace this mail is about, shown in the header of every template.
   *
   * Separate from any `workspace` in `params`: that one is interpolated into
   * body copy by the templates whose sentences mention it, while this is
   * chrome and applies to all of them. Optional because not every recipient
   * has a workspace yet — a password reset can reach someone whose tenant was
   * never created, and a platform admin has no tenant at all.
   */
  workspace?: string | null;
  /** Path or absolute URL the call-to-action button points at. */
  actionPath?: string;
  /**
   * True when following the link is the only way to complete the action, as
   * on a password reset. Such a link is sent even when it is not publicly
   * reachable, because an email without it cannot be acted on at all;
   * everywhere else an unusable link is dropped rather than shipped.
   */
  linkIsEssential?: boolean;
  /** Adds the "ignore this if it wasn't you" line. Security-sensitive mail. */
  includeIgnoreNotice?: boolean;
  /**
   * A value the reader has to copy — a verification code, a temporary
   * password. Rendered as its own block, because a credential buried in a
   * paragraph is exactly what people mistype.
   */
  highlight?: string;
  /** Caption above that block, e.g. "Temporary password". */
  highlightLabel?: string;
  /**
   * Values to set in bold where they appear in the body sentence — the parts
   * of the message the reader has to transcribe exactly.
   */
  emphasise?: string[];
};

function normalizeLanguage(language: string | null | undefined): Language {
  return isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;
}

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${env.FRONTEND_URL.replace(/\/$/, "")}/${pathOrUrl.replace(/^\//, "")}`;
}

/**
 * Whether a URL is one an outside recipient could actually open.
 *
 * This decides whether a message gets a call-to-action at all, and it is the
 * most important spam control in this file. With FRONTEND_URL left at its
 * development default, every email carried a button pointing at
 * `http://127.0.0.1:5173/...` — plain HTTP, to a loopback IP, on a host
 * unrelated to the sending domain. That is the exact shape of a phishing
 * link, filters weight it heavily, and the recipient could never have
 * followed it anyway: 127.0.0.1 is their own machine.
 *
 * Rather than ship a link nobody can use, the templates drop the button and
 * keep the part that works — the code itself, or the instruction to sign in.
 */
function isPubliclyReachable(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Anything not served over TLS is a spam signal in its own right.
  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return false;
  }

  // Bare IP literals — v4 dotted quads and anything bracketed/colon-bearing for v6.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.startsWith("[") || host.includes(":")) return false;

  // A public hostname has at least one dot.
  return host.includes(".");
}

/**
 * The call-to-action URL, or nothing when it would not be a usable link.
 *
 * Whether an unreachable link is dropped depends on what the link is *for*,
 * and the two cases are genuinely different:
 *
 *  - On a verification code or an invitation the button is a convenience. The
 *    code and the temporary password are in the body, so the message still
 *    does its job without it, and dropping a localhost link removes the worst
 *    spam signal these emails carry.
 *
 *  - On a password reset the link *is* the mechanism. There is nothing to
 *    type instead, so an email without it is an email that cannot be acted
 *    on. Suppressing it there would trade a spam problem for a broken flow,
 *    which is not a trade worth making — it is kept, and the loud warning
 *    plus the failing preflight are what force FRONTEND_URL to be set
 *    properly before this reaches real recipients.
 *
 * Warned about once per process so a misconfigured FRONTEND_URL shows up in
 * the server log rather than silently producing button-less mail.
 */
let warnedAboutUnreachableFrontend = false;

function warnOnce(url: string) {
  if (warnedAboutUnreachableFrontend) return;
  warnedAboutUnreachableFrontend = true;
  console.warn(
    `[email] FRONTEND_URL is "${env.FRONTEND_URL}", so email links resolve to ${url}. ` +
      "That is not an address a recipient can open, and a button pointing at localhost or a " +
      "bare IP over plain HTTP reads as phishing to spam filters. Links are being left out " +
      "where the message works without them, and password-reset mail is being sent with a " +
      "link nobody outside this machine can follow. Set FRONTEND_URL to the real workspace URL."
  );
}

function resolveActionUrl(actionPath: string | undefined, linkIsEssential: boolean) {
  if (!actionPath) return undefined;

  const url = absoluteUrl(actionPath);
  if (isPubliclyReachable(url)) return url;

  warnOnce(url);
  return linkIsEssential ? url : undefined;
}

/** Minimal HTML escaping — every interpolated value is user-controlled. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type RenderedEmail = { subject: string; html: string; text: string };

/*
 * Palette for the email chrome. Kept in one place so the whole template can
 * be retoned at once — email clients strip <style> blocks and know nothing of
 * CSS variables, so every one of these has to be repeated inline at each use.
 */
const BRAND = {
  ink: "#05085c",
  inkSoft: "#3f45a8",
  page: "#eef1f6",
  card: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  panel: "#f1f5f9",
} as const;

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif";

/**
 * The chrome every notification is rendered into.
 *
 * Laid out with tables and inline styles rather than modern CSS: Outlook
 * renders through Word, which has no flexbox, no grid and no border-radius on
 * a div, and Gmail drops <style> blocks entirely. Tables are the one layout
 * primitive that behaves the same in all of them.
 *
 * The header carries the workspace the mail is about. One person can belong
 * to several ShopCore workspaces and be mailed by any of them, so "which
 * business is this about?" has to be answerable from the email itself rather
 * than guessed from the body copy.
 */
function shell(options: {
  language: Language;
  workspace?: string;
  workspaceLabel: string;
  heading: string;
  content: string;
  footer: string;
}): string {
  const { language, workspace, workspaceLabel, heading, content, footer } = options;

  const workspaceRow = workspace
    ? [
        '<tr><td style="padding:12px 0 0;">',
        '<span style="display:inline-block;background:rgba(255,255,255,0.14);',
        "border:1px solid rgba(255,255,255,0.24);border-radius:999px;padding:6px 14px;",
        'font-size:13px;font-weight:600;color:#ffffff;">',
        escapeHtml(workspaceLabel),
        "&nbsp;&middot;&nbsp;",
        escapeHtml(workspace),
        "</span></td></tr>",
      ].join("")
    : "";

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.page};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;font-family:${FONT_STACK};color:${BRAND.text};">
            <tr>
              <td style="background:${BRAND.ink};padding:28px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="font-size:12px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,0.70);">SHOPCORE</td></tr>
                  <tr><td style="padding:10px 0 0;font-size:22px;font-weight:700;line-height:1.3;color:#ffffff;">${escapeHtml(heading)}</td></tr>${workspaceRow}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">${content}</td>
            </tr>
            <tr>
              <td style="border-top:1px solid ${BRAND.border};padding:20px 32px 26px;">
                <p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;">${escapeHtml(footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function render(options: {
  language: Language;
  template: NotificationTemplate;
  params: Record<string, string>;
  workspace?: string;
  actionUrl?: string;
  includeIgnoreNotice: boolean;
  highlight?: string;
  highlightLabel?: string;
  emphasise?: string[];
}): RenderedEmail {
  const {
    language,
    template,
    params,
    workspace,
    actionUrl,
    includeIgnoreNotice,
    highlight,
    highlightLabel,
    emphasise = [],
  } = options;
  const t = (key: MessageKey, p?: Record<string, string | number>) => translate(key, language, p);

  const subject = t(`email.${template}.subject` as MessageKey);
  // Interpolated too: userInvitedWithCredentials puts the workspace in its heading.
  const heading = t(`email.${template}.heading` as MessageKey, params);
  const body = t(`email.${template}.body` as MessageKey, params);
  const cta = t(`email.${template}.cta` as MessageKey);
  const greeting = t("email.common.greeting", { name: params.name });
  const footer = t("email.common.footer");
  const ignore = t("email.common.ignore");
  const linkFallback = t("email.common.linkFallback");
  const workspaceLabel = t("email.common.workspaceLabel");

  const textLines: string[] = [];
  if (workspace) textLines.push(`${workspaceLabel}: ${workspace}`, "");
  textLines.push(greeting, "", body);
  if (highlight) textLines.push("", highlight);
  if (actionUrl) textLines.push("", `${cta}: ${actionUrl}`);
  if (includeIgnoreNotice) textLines.push("", ignore);
  textLines.push("", footer);

  /*
   * A code the reader has to retype gets its own block: spaced out, and in a
   * monospaced face because a proportional one makes 0/O and 1/l worse.
   */
  /*
   * The block sizes itself to what it holds.
   *
   * A six-digit code wants to be large and widely spaced — it is read once
   * and typed. A generated password is longer and mixes case, digits and
   * symbols: at that size it wraps badly, and wide letter-spacing makes it
   * genuinely harder to transcribe rather than easier. Both still get the
   * monospaced face, because that is what separates l from 1 and O from 0.
   */
  const isShortCode = Boolean(highlight && /^[0-9]{4,8}$/.test(highlight));
  const highlightType = isShortCode
    ? "font-size:30px;letter-spacing:10px;text-indent:10px;"
    : "font-size:20px;letter-spacing:1px;word-break:break-all;";

  const codeBlock = highlight
    ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0;">
                  ${
                    highlightLabel
                      ? `<tr><td align="center" style="padding:0 0 8px;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${BRAND.muted};">${escapeHtml(highlightLabel)}</td></tr>`
                      : ""
                  }
                  <tr>
                    <td align="center" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;padding:20px 12px;font-family:Consolas,'Courier New',Courier,monospace;${highlightType}font-weight:700;color:${BRAND.ink};">${escapeHtml(highlight)}</td>
                  </tr>
                </table>`
    : "";

  /*
   * The call to action is an anchor padded inside its own table cell, so a
   * client that drops border-radius still renders a solid tappable block
   * rather than a bare underlined link.
   */
  const button = actionUrl
    ? `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 18px;">
                  <tr>
                    <td align="center" style="background:${BRAND.ink};border-radius:10px;">
                      <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(cta)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 6px;color:${BRAND.muted};font-size:12px;line-height:1.5;">${escapeHtml(linkFallback)}</p>
                <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(actionUrl)}" style="color:${BRAND.inkSoft};text-decoration:underline;">${escapeHtml(actionUrl)}</a></p>`
    : "";

  const ignoreBlock = includeIgnoreNotice
    ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">
                  <tr>
                    <td style="background:${BRAND.panel};border-radius:10px;padding:14px 16px;color:${BRAND.muted};font-size:13px;line-height:1.6;">${escapeHtml(ignore)}</td>
                  </tr>
                </table>`
    : "";

  /*
   * Credentials are set in bold where they appear in the sentence.
   *
   * A temporary password reads as ordinary prose otherwise — the one thing
   * in the message the reader has to copy exactly, rendered exactly like the
   * words around it. Applied after escaping, and only to the escaped form of
   * the value, so nothing user-supplied can introduce markup this way.
   */
  let bodyHtml = escapeHtml(body);
  for (const value of emphasise) {
    if (!value) continue;
    const escaped = escapeHtml(value);
    bodyHtml = bodyHtml.split(escaped).join(`<strong style="font-weight:700;">${escaped}</strong>`);
  }

  const content = `
                <p style="margin:0 0 14px;font-size:16px;font-weight:600;color:${BRAND.text};">${escapeHtml(greeting)}</p>
                <p style="margin:0;font-size:15px;line-height:1.7;color:${BRAND.text};">${bodyHtml}</p>${codeBlock}${button}${ignoreBlock}
              `;

  const html = shell({ language, workspace, workspaceLabel, heading, content, footer });

  return { subject, html, text: textLines.join("\n") };
}

/**
 * Sends a notification. Never throws.
 *
 * A transactional email is a side effect of an action, not the action
 * itself: a signup that succeeded must not report failure because the
 * welcome mail bounced. Delivery problems are logged and swallowed, and the
 * boolean lets a caller that genuinely cares check the outcome.
 */
export async function sendNotification<T extends NotificationTemplate>(
  options: SendOptions<T>
): Promise<boolean> {
  const language = normalizeLanguage(options.language);

  try {
    const message = render({
      language,
      template: options.template,
      params: options.params as Record<string, string>,
      workspace: options.workspace?.trim() || undefined,
      actionUrl: resolveActionUrl(options.actionPath, options.linkIsEssential ?? false),
      includeIgnoreNotice: options.includeIgnoreNotice ?? false,
      highlight: options.highlight,
      highlightLabel: options.highlightLabel,
      emphasise: options.emphasise,
    });

    await getTransport().send({ to: options.to, ...message });
    return true;
  } catch (error) {
    console.error(
      `[email] failed to send "${options.template}" to ${options.to} (${language}):`,
      error
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Convenience wrappers — one per event, so call sites read as intent rather
// than as template plumbing.
//
// Every wrapper takes the workspace the mail is about. Where the template's
// body copy already names it, the same value is passed twice — once as a
// parameter for the sentence, once as chrome for the header — because those
// are two different jobs and only one of them is optional.
// ---------------------------------------------------------------------------

export function sendAccountCreatedEmail(input: {
  to: string;
  name: string;
  workspace: string;
  language?: string | null;
}) {
  return sendNotification({
    to: input.to,
    template: "accountCreated",
    language: input.language,
    params: { name: input.name, workspace: input.workspace },
    workspace: input.workspace,
    actionPath: "/auth",
  });
}

export function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetToken: string;
  workspace?: string | null;
  language?: string | null;
}) {
  return sendNotification({
    to: input.to,
    template: "passwordReset",
    language: input.language,
    params: { name: input.name },
    workspace: input.workspace,
    actionPath: `/reset-password?token=${encodeURIComponent(input.resetToken)}`,
    // Without this link there is nothing for the recipient to do.
    linkIsEssential: true,
    includeIgnoreNotice: true,
  });
}

export function sendPasswordChangedEmail(input: {
  to: string;
  name: string;
  workspace?: string | null;
  language?: string | null;
}) {
  return sendNotification({
    to: input.to,
    template: "passwordChanged",
    language: input.language,
    params: { name: input.name },
    workspace: input.workspace,
    actionPath: "/settings",
    includeIgnoreNotice: true,
  });
}

/**
 * The credentials email for a member created directly (as opposed to
 * invited by link). Deliberately carries the temporary password in plain
 * text in the body — that is the whole point of this flow, per product
 * decision: an administrator creates the account outright and the person
 * signs in with what they were emailed, then is required to change it (see
 * User.metadata.mustChangePassword). The password never appears anywhere
 * else: not in the API response that created the account, not in a log,
 * only here.
 */
export function sendUserInvitedWithCredentialsEmail(input: {
  to: string;
  name: string;
  workspace: string;
  tempPassword: string;
  /** Human-readable role label, e.g. "Cashier" — not the internal key. */
  role: string;
  language?: string | null;
}) {
  return sendNotification({
    to: input.to,
    template: "userInvitedWithCredentials",
    language: input.language,
    params: {
      name: input.name,
      workspace: input.workspace,
      email: input.to,
      tempPassword: input.tempPassword,
      role: input.role,
    },
    workspace: input.workspace,
    /*
     * The credential gets both treatments: bold where the sentence mentions
     * it, and its own labelled block underneath. It is the one thing in this
     * message that has to be transcribed exactly, and set in ordinary prose
     * it reads like the words around it.
     */
    highlight: input.tempPassword,
    highlightLabel: "Temporary password",
    emphasise: [input.tempPassword, input.to],
    // The call-to-action is the sign-in page itself: this account already
    // exists, so there is no invitation to accept first.
    actionPath: "/auth",
  });
}

/**
 * The second factor asked for once a member has chosen their own password.
 * The button only reopens the verification screen; the code must still be
 * typed in, so following the link alone proves nothing.
 */
export function sendLoginOtpEmail(input: {
  to: string;
  name: string;
  code: string;
  minutes: number;
  workspace?: string | null;
  language?: string | null;
}) {
  return sendNotification({
    to: input.to,
    template: "loginOtp",
    language: input.language,
    params: { name: input.name, code: input.code, minutes: String(input.minutes) },
    workspace: input.workspace,
    highlight: input.code,
    // Links back to the screen that asks for the code — the code itself
    // still has to be typed, so the link is a convenience, not the factor.
    actionPath: "/verify-otp",
    includeIgnoreNotice: true,
  });
}

export function sendSubscriptionActivatedEmail(input: {
  to: string;
  name: string;
  workspace: string;
  plan: string;
  cycle: string;
  language?: string | null;
}) {
  return sendNotification({
    to: input.to,
    template: "subscriptionActivated",
    language: input.language,
    params: {
      name: input.name,
      workspace: input.workspace,
      plan: input.plan,
      cycle: input.cycle,
    },
    workspace: input.workspace,
    actionPath: "/settings",
  });
}

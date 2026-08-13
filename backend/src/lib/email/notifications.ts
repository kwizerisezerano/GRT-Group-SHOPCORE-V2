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
  | "subscriptionActivated";

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
};

type SendOptions<T extends NotificationTemplate> = {
  to: string;
  template: T;
  language?: string | null;
  params: TemplateParams[T];
  /** Path or absolute URL the call-to-action button points at. */
  actionPath?: string;
  /** Adds the "ignore this if it wasn't you" line. Security-sensitive mail. */
  includeIgnoreNotice?: boolean;
};

function normalizeLanguage(language: string | null | undefined): Language {
  return isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;
}

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${env.FRONTEND_URL.replace(/\/$/, "")}/${pathOrUrl.replace(/^\//, "")}`;
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

function render(options: {
  language: Language;
  template: NotificationTemplate;
  params: Record<string, string>;
  actionUrl?: string;
  includeIgnoreNotice: boolean;
}): RenderedEmail {
  const { language, template, params, actionUrl, includeIgnoreNotice } = options;
  const t = (key: MessageKey, p?: Record<string, string | number>) => translate(key, language, p);

  const subject = t(`email.${template}.subject` as MessageKey);
  const heading = t(`email.${template}.heading` as MessageKey);
  const body = t(`email.${template}.body` as MessageKey, params);
  const cta = t(`email.${template}.cta` as MessageKey);
  const greeting = t("email.common.greeting", { name: params.name });
  const footer = t("email.common.footer");
  const ignore = t("email.common.ignore");
  const linkFallback = t("email.common.linkFallback");

  const textLines = [greeting, "", body];
  if (actionUrl) textLines.push("", `${cta}: ${actionUrl}`);
  if (includeIgnoreNotice) textLines.push("", ignore);
  textLines.push("", footer);

  const button = actionUrl
    ? `
      <p style="margin:28px 0;">
        <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#05085c;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">${escapeHtml(cta)}</a>
      </p>
      <p style="color:#64748b;font-size:12px;margin:0 0 8px;">${escapeHtml(linkFallback)}</p>
      <p style="color:#64748b;font-size:12px;word-break:break-all;margin:0;">${escapeHtml(actionUrl)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="${language}">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="color:#05085c;font-size:20px;margin:0 0 16px;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
      <p style="margin:0;line-height:1.6;">${escapeHtml(body)}</p>
      ${button}
      ${includeIgnoreNotice ? `<p style="color:#64748b;font-size:13px;margin:24px 0 0;">${escapeHtml(ignore)}</p>` : ""}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 16px;" />
      <p style="color:#94a3b8;font-size:12px;margin:0;">${escapeHtml(footer)}</p>
    </div>
  </body>
</html>`;

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
      actionUrl: options.actionPath ? absoluteUrl(options.actionPath) : undefined,
      includeIgnoreNotice: options.includeIgnoreNotice ?? false,
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
    actionPath: "/auth",
  });
}

export function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetToken: string;
  language?: string | null;
}) {
  return sendNotification({
    to: input.to,
    template: "passwordReset",
    language: input.language,
    params: { name: input.name },
    actionPath: `/reset-password?token=${encodeURIComponent(input.resetToken)}`,
    includeIgnoreNotice: true,
  });
}

export function sendPasswordChangedEmail(input: {
  to: string;
  name: string;
  language?: string | null;
}) {
  return sendNotification({
    to: input.to,
    template: "passwordChanged",
    language: input.language,
    params: { name: input.name },
    actionPath: "/settings",
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
    actionPath: "/settings",
  });
}

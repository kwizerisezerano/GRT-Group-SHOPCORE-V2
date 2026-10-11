import { env } from "../../config/env";
import { DEFAULT_LANGUAGE, Language, MessageKey, isSupportedLanguage, translate } from "../../i18n";
import { getSmsTransport } from "./transport";

/**
 * Transactional SMS, sent alongside the email for the messages that have to
 * arrive.
 *
 * Deliberately a narrow set. Email is the record; SMS is the delivery
 * guarantee, and only for the two messages a person is locked out without:
 * the invitation carrying a temporary password, and the sign-in code. A
 * generated password exists nowhere but that message — it is stored only as
 * a hash — so an email that lands in spam means an account nobody can enter.
 *
 * Everything else stays email-only. Texting people about subscription
 * renewals and password-changed notices trains them to ignore the channel,
 * which is exactly what must not happen to the code that gets them in.
 */

export type SmsTemplate = "userInvitedWithCredentials" | "loginOtp" | "subscriptionPaid";

type SmsParams = {
  userInvitedWithCredentials: { workspace: string; email: string; tempPassword: string };
  loginOtp: { code: string; minutes: string };
  subscriptionPaid: { plan: string; endDate: string; invoiceNo: string; amount: string };
};

function normalizeLanguage(language: string | null | undefined): Language {
  return isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;
}

/**
 * Turns whatever a person typed into digits the gateway will accept.
 *
 * Numbers reach us in every shape a human writes them: `+250 788 123 456`,
 * `0788-123-456`, `(078) 812 3456`. The gateway wants digits with a country
 * code and no plus, so a local number keeps its leading zero replaced by the
 * configured code. Returns null when there is nothing usable, so the caller
 * skips the send rather than posting rubbish to the API.
 */
export function normalizePhone(
  raw: string | null | undefined,
  countryCode = env.SMS_DEFAULT_COUNTRY_CODE,
): string | null {
  if (!raw) return null;

  const trimmed = String(raw).trim();
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return null;

  // Already international, either written with a + or with the code up front.
  if (hadPlus || digits.startsWith(countryCode)) {
    return digits.length >= 9 ? digits : null;
  }

  // Local form: a single leading zero stands in for the country code.
  const local = digits.replace(/^0+/, "");
  if (local.length < 8) return null;

  return `${countryCode}${local}`;
}

function render(template: SmsTemplate, language: Language, params: Record<string, string>): string {
  const t = (key: MessageKey, p?: Record<string, string | number>) => translate(key, language, p);
  return t(`sms.${template}` as MessageKey, params);
}

/**
 * Sends an SMS. Never throws.
 *
 * Same contract as the email sender, and for the same reason: the message is
 * a side effect of an action that has already committed. A member whose
 * account was created must not see the request fail because the gateway was
 * briefly unreachable — the email still went, and the boolean lets a caller
 * that genuinely cares check.
 */
export async function sendSms<T extends SmsTemplate>(options: {
  to: string | null | undefined;
  template: T;
  params: SmsParams[T];
  language?: string | null;
}): Promise<boolean> {
  const to = normalizePhone(options.to);
  if (!to) return false;

  const language = normalizeLanguage(options.language);

  try {
    const message = render(options.template, language, options.params as Record<string, string>);
    await getSmsTransport().send({ to, message });
    return true;
  } catch (error) {
    console.error(
      `[sms] failed to send "${options.template}" to ${to} (${language}):`,
      error
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// One wrapper per event, so call sites read as intent.
// ---------------------------------------------------------------------------

/**
 * The credentials text for a member created with a generated password.
 *
 * Carries the temporary password in clear text, exactly as the email does and
 * for the same reason: it is the only copy that will ever exist. See
 * lib/email/notifications.ts sendUserInvitedWithCredentialsEmail.
 */
export function sendUserInvitedSms(input: {
  to: string | null | undefined;
  workspace: string;
  email: string;
  tempPassword: string;
  language?: string | null;
}) {
  return sendSms({
    to: input.to,
    template: "userInvitedWithCredentials",
    language: input.language,
    params: {
      workspace: input.workspace,
      email: input.email,
      tempPassword: input.tempPassword,
    },
  });
}

/** The sign-in code, so a person is not locked out by a slow inbox. */
export function sendLoginOtpSms(input: {
  to: string | null | undefined;
  code: string;
  minutes: number;
  language?: string | null;
}) {
  return sendSms({
    to: input.to,
    template: "loginOtp",
    language: input.language,
    params: { code: input.code, minutes: String(input.minutes) },
  });
}

/**
 * Confirmation that a subscription payment landed.
 *
 * Sent to the number the shop signed up with, because that is the phone the
 * owner actually carries — and for a mobile money payment it is usually the
 * same handset that just approved the charge. Email can sit unread for days
 * in this market; a text saying the workspace is open until a given date is
 * the difference between trusting the payment and calling support.
 */
export function sendSubscriptionPaidSms(input: {
  to: string | null | undefined;
  plan: string;
  endDate: string;
  invoiceNo: string;
  amount: string;
  language?: string | null;
}) {
  return sendSms({
    to: input.to,
    template: "subscriptionPaid",
    language: input.language,
    params: {
      plan: input.plan,
      endDate: input.endDate,
      invoiceNo: input.invoiceNo,
      amount: input.amount,
    },
  });
}

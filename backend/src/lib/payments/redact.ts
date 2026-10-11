/**
 * Masking for anything on its way into `payment_logs`.
 *
 * The log exists so support can answer "what did the gateway actually say",
 * which means people read it — and a support engineer does not need the
 * customer's phone number to see that a callback arrived with status `fail`.
 * The transaction row keeps the payer's details encrypted (lib/crypto.ts);
 * writing the same values into a JSON column beside it would undo that with
 * extra steps.
 *
 * Masking rather than deleting, because "which number was this sent to" is a
 * real support question and the last three digits are usually enough for the
 * customer on the phone to confirm it was theirs.
 */

const SENSITIVE_KEYS = new Set([
  "payer_phone",
  "payerphone",
  "phone",
  "tel",
  "msisdn",
  "email",
  "payer_email",
  "name",
  "payer_name",
  "customer_name",
  "authorization",
  "app_key",
  "secret_key",
  "appkey",
  "secretkey",
  "password",
  "token",
]);

/** `+250780000000` -> `+2507*****000`. Enough to confirm, not enough to reuse. */
export function maskPhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 7) return "*".repeat(trimmed.length);
  return `${trimmed.slice(0, 5)}${"*".repeat(Math.max(0, trimmed.length - 8))}${trimmed.slice(-3)}`;
}

/** `patrick@example.com` -> `pa****@example.com`. */
export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at < 1) return maskGeneric(value);
  const local = value.slice(0, at);
  const domain = value.slice(at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(1, local.length - head.length))}${domain}`;
}

/** `Jean Bosco` -> `Je********`. */
export function maskGeneric(value: string): string {
  if (value.length <= 2) return "*".repeat(value.length);
  return `${value.slice(0, 2)}${"*".repeat(value.length - 2)}`;
}

function maskValue(key: string, value: string): string {
  const lower = key.toLowerCase();
  if (lower.includes("phone") || lower === "tel" || lower.includes("msisdn")) return maskPhone(value);
  if (lower.includes("email")) return maskEmail(value);
  if (lower === "authorization" || lower.includes("key") || lower.includes("token") || lower.includes("password")) {
    return "***redacted***";
  }
  return maskGeneric(value);
}

/**
 * Deep-copies a payload with every sensitive leaf masked. Anything that is not
 * a plain object, array or primitive is stringified rather than dropped — a
 * gateway that answers with something unexpected is exactly when the log
 * matters most.
 */
export function redactPayload(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return input ?? null;
  if (depth > 8) return "[depth limit]";

  if (Array.isArray(input)) {
    return input.slice(0, 100).map((item) => redactPayload(item, depth + 1));
  }

  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (typeof value === "string" && SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = maskValue(key, value);
      } else {
        out[key] = redactPayload(value, depth + 1);
      }
    }
    return out;
  }

  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
    return input;
  }

  return String(input);
}

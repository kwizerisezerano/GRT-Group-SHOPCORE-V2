import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGINS: z.string().default(""),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  BCRYPT_COST: z.coerce.number().default(10),

  // PII protection (lib/crypto.ts). Both are 32-byte keys as 64 hex chars,
  // generated with `openssl rand -hex 32`, and must differ from each other.
  // No defaults on purpose: booting with a fallback key would silently write
  // data nobody can decrypt later.
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)"),
  BLIND_INDEX_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "BLIND_INDEX_KEY must be 64 hex characters (openssl rand -hex 32)"),
  FRONTEND_URL: z.string().default("http://127.0.0.1:5173"),
  RESEND_API_KEY: z.string().default(""),
  /*
   * The visible sender, as "Display Name <mailbox@domain>".
   *
   * Two separate things matter here and they fail differently. The display
   * name is what the recipient reads, so it has to be the product they are
   * actually using — mail branded ShopCore arriving from some other company's
   * name reads as a phishing attempt to a person and scores like one to a
   * filter. The domain has to be a domain verified in Resend with SPF and
   * DKIM published, or the message is either rejected outright or delivered
   * unauthenticated straight to spam.
   */
  RESEND_FROM_EMAIL: z.string().default("ShopCore <no-reply@shopcore.local>"),
  /** Optional Reply-To. Mail nobody can reply to is itself a spam signal. */
  RESEND_REPLY_TO: z.string().default(""),

  /*
   * SMS (lib/sms) — HDev, a Rwandan gateway.
   *
   * Sent alongside email wherever a message has to actually arrive: an
   * invitation carrying a temporary password, a sign-in code. Email in this
   * region routinely lands in spam or goes unread for days, and a member who
   * never receives their credential cannot be recovered — the password is
   * stored only as a hash. A second channel is the difference between "check
   * your email" and the person actually getting in.
   *
   * With no API id/key configured the sender falls back to logging, exactly
   * like the email transport, so development needs no account.
   */
  HDEV_API_ID: z.string().default(""),
  HDEV_API_KEY: z.string().default(""),
  /**
   * Base of the gateway endpoint. The api id and key are appended as path
   * segments — see lib/sms/transport.ts — so this stays credential-free.
   */
  HDEV_SMS_URL: z.string().default("https://sms-api.hdev.rw/api_pay/api"),
  /** The name recipients see the message from. */
  HDEV_SENDER_ID: z.string().default("N-SMS"),
  /** Default country code for local numbers entered without one. */
  SMS_DEFAULT_COUNTRY_CODE: z.string().default("250"),

  // File storage (lib/storage.ts): "local" writes under backend/uploads and
  // serves it back via the /uploads static route; "s3" targets any
  // S3-compatible endpoint (AWS S3, MinIO, Cloudflare R2, ...).
  // "cloudinary" is the driver the requirements specify. "local" stays the
  // zero-config default for development; "s3" is kept for self-hosting.
  STORAGE_DRIVER: z.enum(["local", "s3", "cloudinary"]).default("local"),
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  STORAGE_PUBLIC_BASE_URL: z.string().default(""), // s3 only: public URL prefix to read objects back from
  STORAGE_S3_REGION: z.string().default("auto"),
  STORAGE_S3_ENDPOINT: z.string().default(""), // leave empty for real AWS S3; set for MinIO/R2/etc.
  STORAGE_S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  STORAGE_S3_ACCESS_KEY_ID: z.string().default(""),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().default(""),

  /*
   * Payments (lib/payments) - LMBTech Pay, a Rwandan aggregator fronting MTN
   * Mobile Money, Airtel Money and card payments (Pesapal).
   *
   * The driver is explicit rather than inferred so a misconfigured production
   * deployment fails loudly instead of quietly "succeeding" against a
   * simulator. "mock" settles every collection locally after a short delay
   * and writes the same transaction and log rows the real driver does, which
   * is what makes the subscription flow developable without an account.
   */
  PAYMENTS_DRIVER: z.enum(["mock", "lmbtech"]).default("mock"),

  /*
   * The gateway endpoint and the credentials it authenticates with.
   *
   * LMBTech issue a *pair* — an App Key and a Secret Key — and expect them as
   * HTTP Basic `app_key:secret_key`. This was previously a single API_KEY sent
   * as `Authorization: Bearer`, which their server rejects outright:
   *
   *     401 {"status":"fail","message":"Invalid Authorization header format"}
   *
   * so every live call failed before it reached their payment logic. API_KEY
   * is kept only so an existing deployment that set it does not fail to boot;
   * it is no longer what authenticates a request.
   */
  API_URL: z.string().default("https://pay.lmbtech.rw/pay/config/api"),
  API_KEY: z.string().default(""),
  LMB_APP_KEY: z.string().default(""),
  LMB_SECRET_KEY: z.string().default(""),

  /**
   * How long to hold the gateway's `pay` call open before giving up on it.
   *
   * Deliberately short. Their endpoint does not return when the prompt is
   * delivered — it blocks until the payer approves or the prompt expires,
   * which can be minutes. Waiting for that would pin an Express worker and a
   * browser request to one customer's PIN entry. We abort, ask the verify
   * endpoint whether the payment exists, and let polling settle it.
   */
  LMB_PAY_TIMEOUT_SECONDS: z.coerce.number().default(8),

  /**
   * Where a payment's status can be re-asked for. Used when a callback
   * arrives with a status we do not recognise, and when a card payer returns
   * with nothing but a tracking id.
   */
  LMBTECH_VERIFY_URL: z.string().default("https://pay.lmbtech.rw/pay/config/api.php"),

  /** What each method is called on the wire. Overridable without a deploy. */
  GATEWAY_METHOD_MTN: z.string().default("MTN_MOMO_RWA"),
  GATEWAY_METHOD_AIRTEL: z.string().default("AIRTEL_MONEY_RWA"),
  GATEWAY_METHOD_CARD: z.string().default("card"),
  /**
   * Publicly reachable base of THIS API, used to build the callback URL the
   * gateway posts to. Localhost is fine in development (the mock driver never
   * leaves the process); a real gateway needs a public origin or a tunnel.
   */
  API_PUBLIC_URL: z.string().default("http://127.0.0.1:4000"),
  /** Overrides the derived callback URL when the API sits behind a proxy path. */
  LMB_CALLBACK_URL: z.string().default(""),
  /** Where the card gateway returns the customer once they are done paying. */
  LMB_CARD_REDIRECT_URL: z.string().default(""),
  /** Seconds the mock driver waits before settling a collection. */
  MOCK_PAYMENT_SETTLE_SECONDS: z.coerce.number().default(4),

  /**
   * Offers the RWF 100 test plan on the signup and pricing screens.
   *
   * Off by default, and it must stay off in production: the plan is real and
   * charges real money, so with this set a customer could buy a hundred-franc
   * subscription from the pricing page. See modules/subscription/testPlan.ts.
   */
  SHOW_TEST_PLAN: z
    .string()
    .default("false")
    .transform((value) => value === "true" || value === "1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),

  /**
   * Where the gateway posts payment results. Derived from API_PUBLIC_URL so a
   * correct deployment needs one variable rather than two kept in step, and
   * overridable for the deployments where that derivation is wrong.
   */
  paymentCallbackUrl:
    parsed.data.LMB_CALLBACK_URL ||
    `${trimTrailingSlash(parsed.data.API_PUBLIC_URL)}/api/payments/callback/lmbtech`,

  /** Where a card payer lands after the gateway is finished with them. */
  paymentCardRedirectUrl:
    parsed.data.LMB_CARD_REDIRECT_URL ||
    `${trimTrailingSlash(parsed.data.FRONTEND_URL)}/billing/payment-return`,

  /**
   * True only when the live driver is selected AND both credentials are
   * present. Asked before every outbound call so a half-configured
   * environment reports "gateway not configured" instead of a 401 from
   * somebody else's server.
   *
   * Both halves of the pair are required: an App Key on its own produces the
   * same 401 as no credentials at all, and finding that out from the gateway
   * mid-checkout is worse than refusing locally.
   */
  paymentsConfigured:
    parsed.data.PAYMENTS_DRIVER === "mock" ||
    Boolean(parsed.data.LMB_APP_KEY && parsed.data.LMB_SECRET_KEY),
};

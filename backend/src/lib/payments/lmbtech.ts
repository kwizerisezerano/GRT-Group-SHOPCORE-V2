import crypto from "node:crypto";
import { env } from "../../config/env";
import { writePaymentLog } from "./logger";

/**
 * The LMBTech Pay gateway (pay.lmbtech.rw).
 *
 * Built to match the integration LMBTech supply: one JSON endpoint,
 * `Authorization: Bearer <API_KEY>`, `action` deciding what the call does, and
 * a callback posted back when the money actually moves.
 *
 * ## Two drivers
 *
 * `PAYMENTS_DRIVER=mock` is not a stub that returns nothing — it walks the
 * same states the real gateway does (accepted as pending, settled by a
 * callback a moment later) and writes the same transaction and log rows. That
 * is what lets the whole subscription flow, including the callback handler, be
 * exercised without an account on somebody else's system.
 *
 * ## Statuses
 *
 * The gateway spells the same outcome several ways across its documentation
 * and its live responses — "success", "successful", "paid", "completed" all
 * mean the money arrived. `STATUS_MAP` is the whole vocabulary in one place;
 * anything not in it is treated as unknown, which is what triggers a
 * verification call rather than a guess.
 */

export type PaymentStatus = "pending" | "success" | "failed" | "cancelled";

/** Every spelling the gateway uses, mapped onto the four states we store. */
const STATUS_MAP: Record<string, PaymentStatus> = {
  success: "success",
  successful: "success",
  succeeded: "success",
  approved: "success",
  paid: "success",
  completed: "success",
  complete: "success",

  pending: "pending",
  processing: "pending",
  initiated: "pending",

  fail: "failed",
  failed: "failed",
  error: "failed",
  declined: "failed",
  rejected: "failed",

  canceled: "cancelled",
  cancelled: "cancelled",
  void: "cancelled",
  expired: "cancelled",
};

/**
 * Normalises a gateway status, or returns null when it is not one we know.
 *
 * The null matters: an unrecognised status must not silently become
 * "pending", because that is indistinguishable from a payment still in
 * flight. The callback handler asks the gateway directly instead.
 */
export function mapStatus(raw: unknown): PaymentStatus | null {
  /*
   * `status` is not always a status. The live gateway answers an unknown
   * reference with `{"status": false, "message": "Payment not found ..."}`,
   * where the field is a boolean carrying the success of the *lookup*, not
   * the state of a payment. Neither boolean is a payment state, so both are
   * unknown — which sends the caller to verify rather than letting `false`
   * fall through to "pending" and leave a dead reference polling forever.
   */
  if (typeof raw === "boolean") return null;

  const value = String(raw ?? "").trim().toLowerCase();
  return STATUS_MAP[value] ?? null;
}

/** Same, but with a fallback for the paths that must produce something. */
export function normalizeStatus(raw: unknown): PaymentStatus {
  return mapStatus(raw) ?? "pending";
}

export const MTN_GATEWAY_METHOD = env.GATEWAY_METHOD_MTN;
export const AIRTEL_GATEWAY_METHOD = env.GATEWAY_METHOD_AIRTEL;
export const CARD_GATEWAY_METHOD = env.GATEWAY_METHOD_CARD;

export type GatewayMethod = string;

/**
 * Our PaymentMethod.code -> what actually goes on the wire.
 *
 * The wire values come from env so a change on the gateway's side is a
 * configuration edit rather than a deploy — which matters because the
 * documentation names MTN and card explicitly and is silent on Airtel.
 */
function gatewayMethodTable(): Record<string, GatewayMethod> {
  return {
    mobile_money_mtn: MTN_GATEWAY_METHOD,
    mtn_momo: MTN_GATEWAY_METHOD,
    momo: MTN_GATEWAY_METHOD,
    mtn: MTN_GATEWAY_METHOD,

    mobile_money_airtel: AIRTEL_GATEWAY_METHOD,
    airtel_money: AIRTEL_GATEWAY_METHOD,
    airtel: AIRTEL_GATEWAY_METHOD,

    card: CARD_GATEWAY_METHOD,
    visa: CARD_GATEWAY_METHOD,
    mastercard: CARD_GATEWAY_METHOD,
  };
}

export function gatewayMethodFor(paymentMethodCode: string): GatewayMethod | null {
  return gatewayMethodTable()[paymentMethodCode.trim().toLowerCase()] ?? null;
}

export function isMobileMoney(method: GatewayMethod): boolean {
  return method === MTN_GATEWAY_METHOD || method === AIRTEL_GATEWAY_METHOD;
}

export function isCard(method: GatewayMethod): boolean {
  return method === CARD_GATEWAY_METHOD;
}

export type CollectionRequest = {
  referenceId: string;
  amount: number;
  method: GatewayMethod;
  email: string;
  name: string;
  servicePaid: string;
  /** Required for mobile money; ignored for card. */
  payerPhone?: string | null;
  callbackUrl: string;
  /** Required for card; ignored for mobile money. */
  cardRedirectUrl?: string | null;
};

export type PayoutRequest = {
  referenceId: string;
  amount: number;
  method: GatewayMethod;
  email: string;
  name: string;
  payerPhone: string;
  servicePaid: string;
  callbackUrl: string;
};

export type GatewayResult = {
  status: PaymentStatus;
  message: string;
  referenceId: string;
  providerTxnId: string | null;
  /** Card only — where to send the customer to enter their details. */
  redirectUrl: string | null;
  httpStatus: number | null;
  amount: number | null;
  /** The gateway's untouched body, for the log and for support. */
  raw: unknown;
};

export class GatewayError extends Error {
  readonly httpStatus: number | null;
  readonly raw: unknown;
  /**
   * True when we stopped waiting, rather than the gateway saying no.
   *
   * The difference decides whether a customer's payment is dead or in flight:
   * their `pay` endpoint holds the connection open until the payer approves
   * the prompt, so a timeout is the *normal* outcome of a working charge, not
   * a failure. Callers check this before marking anything failed.
   */
  readonly timedOut: boolean;

  constructor(message: string, httpStatus: number | null, raw: unknown, timedOut = false) {
    super(message);
    this.name = "GatewayError";
    this.httpStatus = httpStatus;
    this.raw = raw;
    this.timedOut = timedOut;
  }
}

/**
 * HTTP Basic, `app_key:secret_key`.
 *
 * Verified against the live gateway rather than inferred: a Bearer token —
 * either key — comes back
 * `401 {"status":"fail","message":"Invalid Authorization header format"}`,
 * while Basic with the pair authenticates and reaches their payment logic.
 */
function authHeader(): string {
  const pair = `${env.LMB_APP_KEY}:${env.LMB_SECRET_KEY}`;
  return `Basic ${Buffer.from(pair).toString("base64")}`;
}

/**
 * A phone the gateway will accept: `+2507XXXXXXXX`.
 *
 * People type their number every way there is — with a leading zero, with
 * spaces, with the country code and without. Normalising here rather than at
 * the form means the API accepts what a person actually types, and the gateway
 * still receives the one shape it documents.
 */
export function normalizePhone(input: string, defaultCountryCode = "250"): string {
  const digits = input.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) return digits;
  if (digits.startsWith(defaultCountryCode)) return `+${digits}`;
  if (digits.startsWith("0")) return `+${defaultCountryCode}${digits.slice(1)}`;
  return `+${defaultCountryCode}${digits}`;
}

/**
 * `INV-YYYYMMDD-<timestamp tail>-<random>` — the reference every later message
 * about this payment is matched on.
 *
 * The timestamp tail keeps references roughly ordered for anybody reading a
 * log; the random suffix is what stops two workspaces paying in the same
 * millisecond from colliding, and stops a reference being guessed from a
 * previous one. `crypto.randomInt`, not `Math.random`, because the callback
 * endpoint is unauthenticated and the reference is the only thing a forger
 * would need.
 */
export function buildReferenceId(prefix = "INV"): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const tail = Date.now().toString().slice(-8);
  const random = crypto.randomInt(1000, 9999);

  return `${prefix}-${year}${month}${day}-${tail}-${random}`;
}

async function postToGateway(
  body: Record<string, unknown>,
  context: { referenceId: string; tenantId?: string | null; transactionId?: string | null; event: string }
): Promise<GatewayResult> {
  const startedAt = Date.now();

  await writePaymentLog({
    ...context,
    direction: "request",
    httpStatus: null,
    requestPayload: { url: env.API_URL, body },
    message: `Sent ${body.action} request to the payment gateway`,
  });

  let response: Response;
  let text: string;

  try {
    response = await fetch(env.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify(body),
      /*
       * Short on purpose. Their `pay` endpoint does not answer when the
       * prompt reaches the handset — it blocks until the payer approves it or
       * it expires, which can run to minutes. Holding on for that pins a
       * worker and the customer's browser to one person's PIN entry. We stop
       * waiting and ask the verify endpoint what happened instead.
       */
      signal: AbortSignal.timeout(env.LMB_PAY_TIMEOUT_SECONDS * 1000),
    });

    text = await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timedOut =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

    await writePaymentLog({
      ...context,
      direction: "error",
      errorMessage: message,
      durationMs: Date.now() - startedAt,
      message: timedOut
        ? "Stopped waiting on the gateway; the payment may still be awaiting approval"
        : "The payment gateway could not be reached",
    });

    throw new GatewayError(message, null, null, timedOut);
  }

  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw_body: text };
  }

  const durationMs = Date.now() - startedAt;
  /*
   * A boolean `status` here is the gateway reporting whether it accepted the
   * request, not the state of the money — so fall back to the HTTP result
   * rather than letting `mapStatus` shrug and produce "pending" for a call
   * that was actually refused.
   */
  const rawStatus =
    typeof parsed?.status === "boolean" || parsed?.status === undefined || parsed?.status === null
      ? response.ok
        ? "pending"
        : "failed"
      : parsed.status;
  const status = normalizeStatus(rawStatus);
  const message = String(parsed?.message ?? (response.ok ? "Payment request accepted" : "Payment request rejected"));

  await writePaymentLog({
    ...context,
    direction: "response",
    httpStatus: response.status,
    resultStatus: status,
    responsePayload: parsed,
    durationMs,
    message,
  });

  if (!response.ok) {
    throw new GatewayError(message, response.status, parsed);
  }

  /* Flat or wrapped — the live gateway answers flat. See fetchRemoteStatus. */
  const data = { ...parsed, ...(parsed?.data ?? {}) };

  return {
    status,
    message,
    referenceId: String(data.reference_id ?? body.reference_id),
    providerTxnId: data.transaction_id
      ? String(data.transaction_id)
      : data.id
        ? String(data.id)
        : null,
    /* Both shapes appear in their examples: top level and nested under data. */
    redirectUrl: parsed?.redirect_url
      ? String(parsed.redirect_url)
      : data.redirect_url
        ? String(data.redirect_url)
        : null,
    httpStatus: response.status,
    amount: data.amount !== undefined ? Number(data.amount) : null,
    raw: parsed,
  };
}

/* ------------------------------------------------------------- mock ----- */

/**
 * The development driver. Accepts everything as pending and settles it a few
 * seconds later, so the callback handler — the part of a payment integration
 * that is easiest to get wrong and hardest to test — is exercised on every
 * local run.
 */
const mockSettlers = new Map<string, NodeJS.Timeout>();

export function scheduleMockSettlement(
  referenceId: string,
  settle: (result: { status: PaymentStatus; providerTxnId: string }) => Promise<void>
): void {
  const existing = mockSettlers.get(referenceId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    mockSettlers.delete(referenceId);
    void settle({
      status: "success",
      providerTxnId: `MOCK-${referenceId}`,
    }).catch((error) => {
      console.error("[payments] mock settlement failed", referenceId, error);
    });
  }, Math.max(0, env.MOCK_PAYMENT_SETTLE_SECONDS) * 1000);

  // Do not hold the process open just to settle a fake payment.
  timer.unref?.();
  mockSettlers.set(referenceId, timer);
}

/** Cancels any scheduled mock settlement. Used by the tests and on shutdown. */
export function clearMockSettlements(): void {
  for (const timer of mockSettlers.values()) clearTimeout(timer);
  mockSettlers.clear();
}

/* -------------------------------------------------------- operations ---- */

export async function initiateCollection(
  request: CollectionRequest,
  context: { tenantId?: string | null; transactionId?: string | null }
): Promise<GatewayResult> {
  const body: Record<string, unknown> = {
    email: request.email,
    name: request.name,
    payment_method: request.method,
    amount: request.amount,
    service_paid: request.servicePaid,
    reference_id: request.referenceId,
    callback_url: request.callbackUrl,
    action: "pay",
  };

  if (isMobileMoney(request.method)) {
    body.payer_phone = request.payerPhone;
  }

  if (isCard(request.method)) {
    /*
     * The card gateway sends the payer back here with the reference on the
     * query string. Carrying it means the return page can settle and report
     * without the customer having to find their reference.
     */
    const base = request.cardRedirectUrl ?? env.paymentCardRedirectUrl;
    const separator = base.includes("?") ? "&" : "?";
    body.card_redirect_url = `${base}${separator}reference_id=${encodeURIComponent(request.referenceId)}`;
  }

  if (env.PAYMENTS_DRIVER === "mock") {
    await writePaymentLog({
      ...context,
      referenceId: request.referenceId,
      direction: "request",
      event: "collection.initiate",
      provider: "mock",
      requestPayload: body,
      message: "Simulated collection accepted by the mock payment driver",
      resultStatus: "pending",
    });

    return {
      status: "pending",
      message: "Payment initiated successfully",
      referenceId: request.referenceId,
      providerTxnId: null,
      redirectUrl: isCard(request.method)
        ? `${request.cardRedirectUrl ?? env.paymentCardRedirectUrl}?reference_id=${encodeURIComponent(request.referenceId)}&simulated=1`
        : null,
      httpStatus: 200,
      amount: request.amount,
      raw: { driver: "mock", request: body },
    };
  }

  return postToGateway(body, {
    ...context,
    referenceId: request.referenceId,
    event: "collection.initiate",
  });
}

export async function initiatePayout(
  request: PayoutRequest,
  context: { tenantId?: string | null; transactionId?: string | null }
): Promise<GatewayResult> {
  const body: Record<string, unknown> = {
    email: request.email,
    name: request.name,
    payment_method: request.method,
    amount: request.amount,
    payer_phone: request.payerPhone,
    service_paid: request.servicePaid,
    reference_id: request.referenceId,
    callback_url: request.callbackUrl,
    action: "payout",
  };

  if (env.PAYMENTS_DRIVER === "mock") {
    await writePaymentLog({
      ...context,
      referenceId: request.referenceId,
      direction: "request",
      event: "payout.initiate",
      provider: "mock",
      requestPayload: body,
      message: "Simulated payout accepted by the mock payment driver",
      resultStatus: "pending",
    });

    return {
      status: "pending",
      message: "Payout initiated successfully",
      referenceId: request.referenceId,
      providerTxnId: null,
      redirectUrl: null,
      httpStatus: 200,
      amount: request.amount,
      raw: { driver: "mock", request: body },
    };
  }

  return postToGateway(body, {
    ...context,
    referenceId: request.referenceId,
    event: "payout.initiate",
  });
}

/**
 * Asks the gateway what became of a reference.
 *
 * Two callers, both of which exist because a callback is not guaranteed: the
 * status endpoint the billing screen polls, and the callback handler itself
 * when what arrived carries a status we do not recognise. Answering "I do not
 * know" and asking is always better than assuming.
 */
export async function fetchRemoteStatus(
  referenceId: string,
  context: { tenantId?: string | null; transactionId?: string | null }
): Promise<GatewayResult | null> {
  if (env.PAYMENTS_DRIVER === "mock") return null;
  if (!env.LMBTECH_VERIFY_URL) return null;

  const url = `${env.LMBTECH_VERIFY_URL}?reference_id=${encodeURIComponent(referenceId)}`;
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: authHeader() },
      signal: AbortSignal.timeout(20_000),
    });

    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw_body: text };
    }

    /*
     * The verify endpoint answers flat, not wrapped:
     *
     *   {"status":"pending","amount":"105.00","reference_id":"INV-…",
     *    "transaction_id":"01M13AN…","name":"…","message":"…"}
     *
     * Reading only `parsed.data` — which is what the documented examples show
     * — found nothing here and silently dropped the gateway's transaction id.
     * Both shapes are accepted, flat last so a wrapped payload still wins.
     */
    const data = { ...parsed, ...(parsed?.data ?? {}) };
    const known = mapStatus(data.status ?? parsed?.status);

    /*
     * An unknown reference is not a pending payment. `{"status": false}`
     * comes back 200, so without this the caller would keep polling a
     * reference the gateway has never heard of.
     */
    if (known === null && parsed?.status === false) {
      await writePaymentLog({
        ...context,
        referenceId,
        direction: "status_check",
        event: "status.poll",
        httpStatus: response.status,
        responsePayload: parsed,
        durationMs: Date.now() - startedAt,
        message: String(parsed?.message ?? "The gateway does not know this reference"),
      });

      return null;
    }

    const status = known ?? "pending";

    await writePaymentLog({
      ...context,
      referenceId,
      direction: "status_check",
      event: "status.poll",
      httpStatus: response.status,
      resultStatus: status,
      responsePayload: parsed,
      durationMs: Date.now() - startedAt,
      message: String(parsed?.message ?? "Polled the gateway for the current payment status"),
    });

    if (!response.ok) return null;

    return {
      status,
      message: String(parsed?.message ?? "Status retrieved"),
      referenceId: String(data.reference_id ?? referenceId),
      providerTxnId: data.transaction_id ? String(data.transaction_id) : null,
      redirectUrl: null,
      httpStatus: response.status,
      amount: data.amount !== undefined ? Number(data.amount) : null,
      raw: parsed,
    };
  } catch (error) {
    await writePaymentLog({
      ...context,
      referenceId,
      direction: "error",
      event: "status.poll",
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
      message: "The gateway could not be reached for a status check",
    });

    return null;
  }
}

/**
 * Pulls the reference out of a callback body, whatever shape it arrived in.
 *
 * The gateway posts JSON for mobile money and form fields for card returns,
 * nests some payloads under `data`, and calls the same field `reference_id`,
 * `refid`, `reference` or `OrderMerchantReference` depending on the rail. All
 * of them are the same string.
 */
export function extractReference(payload: Record<string, any>): string {
  const data = payload?.data ?? {};

  return String(
    payload.reference_id ??
      payload.refid ??
      payload.reference ??
      payload.OrderMerchantReference ??
      payload.order_merchant_reference ??
      data.reference_id ??
      data.refid ??
      data.reference ??
      data.OrderMerchantReference ??
      data.order_merchant_reference ??
      ""
  ).trim();
}

/** The gateway's own id for the payment, under any of its names. */
export function extractTrackingId(payload: Record<string, any>): string {
  const data = payload?.data ?? {};

  return String(
    payload.OrderTrackingId ??
      payload.order_tracking_id ??
      payload.orderTrackingId ??
      payload.transaction_id ??
      data.OrderTrackingId ??
      data.order_tracking_id ??
      data.orderTrackingId ??
      data.transaction_id ??
      ""
  ).trim();
}

/** The raw status string from a callback, under any of its names. */
export function extractStatus(payload: Record<string, any>): string {
  const data = payload?.data ?? {};

  return String(
    payload.payment_status ??
      payload.status ??
      payload.transaction_status ??
      payload.state ??
      data.payment_status ??
      data.status ??
      data.transaction_status ??
      data.state ??
      ""
  )
    .trim()
    .toLowerCase();
}

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CheckoutRequest = {
  tenantId?: string;
  invoiceId?: string;
  paymentAttemptId?: string;
  returnUrl?: string;
  cancelUrl?: string;
};

type InvoiceRow = {
  id: string;
  tenant_id: string | null;
  invoice_no: string | null;
  status: string | null;
  currency: string | null;
  total: number | string | null;
};

type AttemptRow = {
  id: string;
  tenant_id: string | null;
  invoice_id: string | null;
  payment_method: string | null;
  provider: string | null;
  provider_reference: string | null;
  status: string | null;
};

class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeStatus(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || "";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getXmlValue(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"),
  );

  return match?.[1]?.trim() || null;
}

function formatServiceDate(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function splitCustomerName(
  rawName: string | null | undefined,
): { firstName: string; lastName: string } {
  const parts = (rawName || "ShopCore Customer")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || "ShopCore",
    lastName: parts.slice(1).join(" ") || "Customer",
  };
}

function isUuid(value: string | null | undefined): boolean {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function resolveReturnUrl(
  requestedUrl: string | undefined,
  tenantId: string,
  configuredOrigin: string,
): string {
  const fallback = new URL(
    `/onboarding/payment/${encodeURIComponent(tenantId)}?card_return=1`,
    configuredOrigin,
  ).toString();

  if (!requestedUrl) {
    return fallback;
  }

  try {
    const requested = new URL(requestedUrl);
    const allowedOrigin = new URL(configuredOrigin).origin;

    if (requested.origin !== allowedOrigin) {
      return fallback;
    }

    requested.searchParams.set("card_return", "1");
    return requested.toString();
  } catch {
    return fallback;
  }
}

function resolveCancelUrl(
  requestedUrl: string | undefined,
  tenantId: string,
  configuredOrigin: string,
): string {
  const fallback = new URL(
    `/onboarding/payment/${encodeURIComponent(tenantId)}?card_cancelled=1`,
    configuredOrigin,
  ).toString();

  if (!requestedUrl) {
    return fallback;
  }

  try {
    const requested = new URL(requestedUrl);
    const allowedOrigin = new URL(configuredOrigin).origin;

    if (requested.origin !== allowedOrigin) {
      return fallback;
    }

    requested.searchParams.set("card_cancelled", "1");
    return requested.toString();
  } catch {
    return fallback;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      error: "Method not allowed.",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const dpoCompanyToken = Deno.env.get("DPO_COMPANY_TOKEN");
  const dpoServiceType = Deno.env.get("DPO_SERVICE_TYPE");
  const dpoApiUrl =
    Deno.env.get("DPO_API_URL") ||
    "https://secure1.sandbox.directpay.online/API/v6/";
  const dpoPaymentPageUrl =
    Deno.env.get("DPO_PAYMENT_PAGE_URL") ||
    "https://secure.3gdirectpay.com/payv2.php";
  const shopCorePublicUrl =
    Deno.env.get("SHOPCORE_PUBLIC_URL") ||
    "http://localhost:5173";

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse(500, {
      error: "Supabase Edge Function environment is incomplete.",
    });
  }

  if (!dpoCompanyToken || !dpoServiceType) {
    return jsonResponse(503, {
      error:
        "Card checkout is not configured. DPO merchant credentials are missing.",
    });
  }

  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse(401, {
      error: "Authentication is required.",
    });
  }

  const userClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const adminClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  let attemptIdForFailure: string | null = null;

  try {
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      throw new HttpError(401, "The authenticated session is invalid.");
    }

    let payload: CheckoutRequest;

    try {
      payload = (await request.json()) as CheckoutRequest;
    } catch {
      throw new HttpError(400, "A valid JSON request body is required.");
    }

    const tenantId = payload.tenantId?.trim();
    const invoiceId = payload.invoiceId?.trim();
    const paymentAttemptId = payload.paymentAttemptId?.trim();

    if (!tenantId || !invoiceId || !paymentAttemptId) {
      throw new HttpError(
        400,
        "tenantId, invoiceId, and paymentAttemptId are required.",
      );
    }

    attemptIdForFailure = paymentAttemptId;

    const [{ data: membership }, { data: tenant }] = await Promise.all([
      adminClient
        .from("tenant_members")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .maybeSingle(),
      adminClient
        .from("tenants")
        .select("id, owner_id, name")
        .eq("id", tenantId)
        .maybeSingle(),
    ]);

    const isTenantOwner = tenant?.owner_id === user.id;

    if (!membership && !isTenantOwner) {
      throw new HttpError(
        403,
        "You are not authorized to create payments for this workspace.",
      );
    }

    const { data: invoiceData, error: invoiceError } =
      await adminClient
        .from("subscription_invoices")
        .select(
          "id, tenant_id, invoice_no, status, currency, total",
        )
        .eq("id", invoiceId)
        .maybeSingle();

    if (invoiceError) {
      throw new HttpError(
        500,
        "The subscription invoice could not be loaded.",
        invoiceError,
      );
    }

    const invoice = invoiceData as InvoiceRow | null;

    if (!invoice || invoice.tenant_id !== tenantId) {
      throw new HttpError(
        404,
        "The subscription invoice was not found for this workspace.",
      );
    }

    const invoiceStatus = normalizeStatus(invoice.status);

    if (
      ["paid", "void", "cancelled", "canceled"].includes(
        invoiceStatus,
      )
    ) {
      throw new HttpError(
        409,
        `This invoice cannot be paid because its status is ${invoiceStatus}.`,
      );
    }

    if (invoiceStatus !== "issued") {
      throw new HttpError(
        409,
        "This invoice is not currently available for payment.",
      );
    }

    const amount = Number(invoice.total);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(
        409,
        "The invoice does not contain a valid payable amount.",
      );
    }

    const currency = (invoice.currency || "RWF")
      .trim()
      .toUpperCase();

    const { data: attemptData, error: attemptError } =
      await adminClient
        .from("payment_attempts")
        .select(
          "id, tenant_id, invoice_id, payment_method, provider, provider_reference, status",
        )
        .eq("id", paymentAttemptId)
        .maybeSingle();

    if (attemptError) {
      throw new HttpError(
        500,
        "The payment attempt could not be loaded.",
        attemptError,
      );
    }

    const attempt = attemptData as AttemptRow | null;

    if (
      !attempt ||
      attempt.tenant_id !== tenantId ||
      attempt.invoice_id !== invoiceId
    ) {
      throw new HttpError(
        404,
        "The payment attempt does not belong to this invoice and workspace.",
      );
    }

    if (normalizeStatus(attempt.payment_method) !== "card") {
      throw new HttpError(
        409,
        "The selected payment attempt is not a card-payment attempt.",
      );
    }

    const attemptStatus = normalizeStatus(attempt.status);

    if (
      ["paid", "verified", "completed", "successful"].includes(
        attemptStatus,
      )
    ) {
      throw new HttpError(
        409,
        "This card payment has already been completed.",
      );
    }

    if (
      attempt.provider === "dpo_pay" &&
      isUuid(attempt.provider_reference) &&
      ["pending", "processing", "initiated", "submitted"].includes(
        attemptStatus,
      )
    ) {
      const checkoutUrl = new URL(dpoPaymentPageUrl);
      checkoutUrl.searchParams.set(
        "ID",
        attempt.provider_reference!,
      );

      return jsonResponse(200, {
        checkoutUrl: checkoutUrl.toString(),
        paymentAttemptId: attempt.id,
        provider: "dpo_pay",
        reused: true,
      });
    }

    const returnUrl = resolveReturnUrl(
      payload.returnUrl,
      tenantId,
      shopCorePublicUrl,
    );
    const cancelUrl = resolveCancelUrl(
      payload.cancelUrl,
      tenantId,
      shopCorePublicUrl,
    );

    const rawDisplayName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.email ||
      "ShopCore Customer";

    const { firstName, lastName } =
      splitCustomerName(rawDisplayName);

    const companyReference =
      invoice.invoice_no?.trim() ||
      `SC-${invoice.id.replace(/-/g, "").slice(0, 18)}`;

    const serviceDescription = `ShopCore subscription ${
      invoice.invoice_no || invoice.id
    }`;

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(dpoCompanyToken)}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${amount.toFixed(2)}</PaymentAmount>
    <PaymentCurrency>${escapeXml(currency)}</PaymentCurrency>
    <CompanyRef>${escapeXml(companyReference)}</CompanyRef>
    <CompanyRefUnique>1</CompanyRefUnique>
    <RedirectURL>${escapeXml(returnUrl)}</RedirectURL>
    <BackURL>${escapeXml(cancelUrl)}</BackURL>
    <PTL>30</PTL>
    <PTLtype>minutes</PTLtype>
    <DefaultPayment>CC</DefaultPayment>
    <TransactionSource>Website</TransactionSource>
    <customerFirstName>${escapeXml(firstName)}</customerFirstName>
    <customerLastName>${escapeXml(lastName)}</customerLastName>
    <customerEmail>${escapeXml(user.email || "")}</customerEmail>
    <CompanyAccRef>${escapeXml(paymentAttemptId)}</CompanyAccRef>
    <MetaData><![CDATA[${JSON.stringify({
      tenantId,
      invoiceId,
      paymentAttemptId,
    })}]]></MetaData>
  </Transaction>
  <Services>
    <Service>
      <ServiceType>${escapeXml(dpoServiceType)}</ServiceType>
      <ServiceDescription>${escapeXml(serviceDescription)}</ServiceDescription>
      <ServiceDate>${formatServiceDate()}</ServiceDate>
      <ServiceRef>${escapeXml(invoice.id)}</ServiceRef>
    </Service>
  </Services>
</API3G>`;

    const providerResponse = await fetch(dpoApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        Accept: "application/xml",
      },
      body: xmlBody,
    });

    const responseText = await providerResponse.text();

    if (!providerResponse.ok) {
      throw new HttpError(
        502,
        "The card provider could not create the checkout session.",
        {
          providerStatus: providerResponse.status,
          providerBody: responseText.slice(0, 1000),
        },
      );
    }

    const resultCode =
      getXmlValue(responseText, "Result") ||
      getXmlValue(responseText, "Code");

    const resultExplanation =
      getXmlValue(responseText, "ResultExplanation") ||
      getXmlValue(responseText, "Explanation") ||
      "Unknown provider response.";

    const transactionToken =
      getXmlValue(responseText, "TransToken");

    const transactionReference =
      getXmlValue(responseText, "TransRef");

    if (resultCode !== "000" || !transactionToken) {
      throw new HttpError(
        502,
        `DPO checkout creation failed: ${resultExplanation}`,
        {
          resultCode,
          resultExplanation,
        },
      );
    }

    const { error: updateError } = await adminClient
      .from("payment_attempts")
      .update({
        provider: "dpo_pay",
        provider_reference: transactionToken,
        status: "processing",
        failure_reason: null,
      })
      .eq("id", paymentAttemptId)
      .eq("tenant_id", tenantId)
      .eq("invoice_id", invoiceId);

    if (updateError) {
      throw new HttpError(
        500,
        "The provider checkout was created, but the payment attempt could not be updated.",
        updateError,
      );
    }

    const checkoutUrl = new URL(dpoPaymentPageUrl);
    checkoutUrl.searchParams.set("ID", transactionToken);

    return jsonResponse(200, {
      checkoutUrl: checkoutUrl.toString(),
      paymentAttemptId,
      provider: "dpo_pay",
      providerReference: transactionReference,
      reused: false,
    });
  } catch (error) {
    console.error("create-card-checkout failed:", error);

    if (
      attemptIdForFailure &&
      !(error instanceof HttpError && error.status < 500)
    ) {
      await adminClient
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Card checkout creation failed.",
        })
        .eq("id", attemptIdForFailure)
        .then(() => undefined)
        .catch(() => undefined);
    }

    if (error instanceof HttpError) {
      return jsonResponse(error.status, {
        error: error.message,
        details: error.details ?? null,
      });
    }

    return jsonResponse(500, {
      error:
        error instanceof Error
          ? error.message
          : "An unexpected card-checkout error occurred.",
    });
  }
});

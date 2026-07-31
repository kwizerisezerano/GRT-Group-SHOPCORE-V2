import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type JsonRecord = Record<string, unknown>;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true, message: "OK" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new Error("Supabase function environment variables are missing");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth?.user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const tenantId = body.tenant_id || body.settings?.tenant_id;

    if (!tenantId) throw new Error("tenant_id is required");

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_members")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) throw new Error("Forbidden: workspace access denied");

    const { data: settings, error: settingsError } = await supabase
      .from("ebm_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (!settings) {
      if (body.sale_id) {
        await supabase
          .from("sales")
          .update({
            ebm_status: "not_configured",
            ebm_response: {
              ok: false,
              message: "No active EBM settings found for this workspace",
            },
          })
          .eq("tenant_id", tenantId)
          .eq("id", body.sale_id);
      }

      return json({
        ok: false,
        status: "not_configured",
        message: "No active EBM settings found for this workspace",
      });
    }

    if (action === "test_connection") {
      return json(await testConnection(settings));
    }

    if (action === "import_products") {
      return json(await importProducts(supabase, tenantId, settings));
    }

    if (action === "submit_invoice") {
      return json(await submitInvoice(supabase, tenantId, settings, body));
    }

    if (action === "retry_invoice") {
      return json(await retryInvoice(supabase, tenantId, settings, body));
    }

    if (action === "get_submission_status") {
      return json(await getSubmissionStatus(supabase, tenantId, body));
    }

    throw new Error(`Unsupported action: ${action}`);
  } catch (error) {
    return json(
      {
        ok: false,
        status: "failed",
        message: error instanceof Error ? error.message : "EBM function failed",
      },
      400,
    );
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function testConnection(settings: JsonRecord) {
  const url = cleanUrl(settings.api_base_url);
  if (!url) throw new Error("API base URL is missing");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(settings),
  });

  const payload = await safeJson(response);

  return {
    ok: response.ok,
    status: response.ok ? "success" : "failed",
    message: response.ok
      ? "VSDC connection successful"
      : `VSDC connection failed: ${response.status}`,
    http_status: response.status,
    data: payload,
  };
}

async function importProducts(
  supabase: SupabaseClient,
  tenantId: string,
  settings: JsonRecord,
) {
  const url = `${cleanUrl(settings.api_base_url)}/products`;

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(settings),
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    throw new Error(payload?.message || `Product import failed: ${response.status}`);
  }

  const products = Array.isArray(payload)
    ? payload
    : payload.products || payload.items || payload.data || [];

  let imported = 0;
  let skipped = 0;

  for (const item of products) {
    const name = String(
      item.name || item.itemName || item.productName || item.description || "",
    ).trim();

    if (!name) {
      skipped += 1;
      continue;
    }

    const sku =
      item.sku ||
      item.code ||
      item.itemCode ||
      item.productCode ||
      item.product_code ||
      null;

    const row = {
      tenant_id: tenantId,
      name,
      sku,
      barcode: item.barcode || item.barCode || null,
      selling_price: safeNumber(
        item.selling_price ||
          item.sellingPrice ||
          item.price ||
          item.unitPrice ||
          item.retailPrice,
      ),
      cost_price: safeNumber(
        item.cost_price ||
          item.costPrice ||
          item.purchasePrice ||
          item.buyingPrice,
      ),
      unit: item.unit || item.unitName || item.measurementUnit || "Piece",
      status: "active",
      ebm_product_code:
        item.ebm_product_code ||
        item.code ||
        item.itemCode ||
        item.productCode ||
        item.product_code ||
        null,
    };

    const { error } = await supabase.from("products").upsert(row, {
      onConflict: "tenant_id,sku",
    });

    if (error) {
      skipped += 1;
      console.error("EBM product import skipped", error);
    } else {
      imported += 1;
    }
  }

  return {
    ok: true,
    status: "success",
    imported,
    skipped,
    message: `${imported} EBM product(s) imported`,
  };
}

async function submitInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  settings: JsonRecord,
  body: JsonRecord,
) {
  if (body.mode === "sync_pending") {
    const { data: sales, error } = await supabase
      .from("sales")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(
        "ebm_status.is.null,ebm_status.eq.pending,ebm_status.eq.failed,ebm_status.eq.pending_sync",
      )
      .limit(25);

    if (error) throw error;

    let synced = 0;
    let failed = 0;

    for (const sale of sales || []) {
      const result = await submitOneInvoice(supabase, tenantId, settings, sale);
      if (result.ok) synced += 1;
      else failed += 1;
    }

    return {
      ok: true,
      status: "success",
      synced,
      failed,
      message: `${synced} invoice(s) synced, ${failed} failed`,
    };
  }

  if (!body.sale_id) throw new Error("sale_id is required");

  const { data: sale, error } = await supabase
    .from("sales")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", body.sale_id)
    .single();

  if (error) throw error;
  if (!sale) throw new Error("Sale not found");

  return await submitOneInvoice(supabase, tenantId, settings, sale);
}

async function submitOneInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  settings: JsonRecord,
  sale: JsonRecord,
) {
  const saleItems = await loadSaleItems(supabase, tenantId, sale.id);
  const invoicePayload = buildInvoicePayload(settings, sale, saleItems);
  const url = `${cleanUrl(settings.api_base_url)}/invoices`;

  await supabase
    .from("sales")
    .update({ ebm_status: "pending" })
    .eq("tenant_id", tenantId)
    .eq("id", sale.id);

  const { data: submission, error: submissionError } = await supabase
    .from("ebm_submissions")
    .insert({
      tenant_id: tenantId,
      sale_id: sale.id,
      invoice_no: sale.invoice_no || sale.receipt_no || null,
      request_payload: invoicePayload,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (submissionError) throw submissionError;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(settings),
      body: JSON.stringify(invoicePayload),
    });

    const responsePayload = await safeJson(response);

    if (!response.ok) {
      throw new Error(
        responsePayload?.message ||
          responsePayload?.error ||
          `Invoice submission failed: ${response.status}`,
      );
    }

    const receiptNo =
      responsePayload.receipt_number ||
      responsePayload.receiptNo ||
      responsePayload.sdcReceiptNo ||
      responsePayload.fiscalReceiptNo ||
      null;

    const qrCode =
      responsePayload.qr_code ||
      responsePayload.qrCode ||
      responsePayload.verificationUrl ||
      responsePayload.qr ||
      null;

    const verificationCode =
      responsePayload.verification_code ||
      responsePayload.verificationCode ||
      responsePayload.sdcVerificationCode ||
      null;

    await supabase
      .from("ebm_submissions")
      .update({
        response_payload: responsePayload,
        receipt_number: receiptNo,
        qr_code: qrCode,
        status: "success",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", submission.id);

    await supabase
      .from("sales")
      .update({
        ebm_status: "success",
        ebm_receipt_no: receiptNo,
        ebm_qr_code: qrCode,
        ebm_verification_code: verificationCode,
        ebm_response: responsePayload,
        ebm_synced_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", sale.id);

    return {
      ok: true,
      status: "success",
      receipt_number: receiptNo,
      qr_code: qrCode,
      verification_code: verificationCode,
      data: responsePayload,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invoice submission failed";

    await supabase
      .from("ebm_submissions")
      .update({
        response_payload: { ok: false, error: message },
        status: "failed",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", submission.id);

    await supabase
      .from("sales")
      .update({
        ebm_status: "failed",
        ebm_response: { ok: false, error: message },
      })
      .eq("tenant_id", tenantId)
      .eq("id", sale.id);

    return { ok: false, status: "failed", message };
  }
}

async function retryInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  settings: JsonRecord,
  body: JsonRecord,
) {
  if (!body.sale_id) throw new Error("sale_id is required");

  return submitInvoice(supabase, tenantId, settings, {
    action: "submit_invoice",
    tenant_id: tenantId,
    sale_id: body.sale_id,
  });
}

async function getSubmissionStatus(
  supabase: SupabaseClient,
  tenantId: string,
  body: JsonRecord,
) {
  let query = supabase
    .from("ebm_submissions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (body.sale_id) {
    query = query.eq("sale_id", body.sale_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  return { ok: true, status: "success", data };
}

async function loadSaleItems(
  supabase: SupabaseClient,
  tenantId: string,
  saleId: string,
) {
  if (!saleId) return [];

  const { data, error } = await supabase
    .from("sale_items")
    .select(
      "id, sale_id, tenant_id, product_id, product_name, sku, quantity, unit_price, unit_cost, subtotal, discount, tax, total, cost_total, gross_profit",
    )
    .eq("tenant_id", tenantId)
    .eq("sale_id", saleId);

  if (error) {
    console.error("Failed to load sale_items for EBM invoice", error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

function buildInvoicePayload(
  settings: JsonRecord,
  sale: JsonRecord,
  saleItems: JsonRecord[],
) {
  const items =
    saleItems.length > 0
      ? saleItems.map((item) => ({
          product_id: item.product_id || null,
          product_name: item.product_name || "Item",
          sku: item.sku || null,
          quantity: safeNumber(item.quantity),
          unit_price: safeNumber(item.unit_price),
          unit_cost: safeNumber(item.unit_cost),
          subtotal: safeNumber(item.subtotal || item.total),
          discount: safeNumber(item.discount),
          tax: safeNumber(item.tax),
          total: safeNumber(item.total || item.subtotal),
        }))
      : normalizeEmbeddedItems(sale);

  return {
    tin: settings.tin,
    device_id: settings.device_id,
    branch_id: settings.branch_id,
    invoice_no: sale.invoice_no || sale.receipt_no,
    receipt_no: sale.receipt_no || null,
    invoice_date: sale.date || sale.created_at || new Date().toISOString(),
    customer_name: sale.customer_name || "Walk-in Customer",
    customer_phone: sale.customer_phone || null,
    customer_tin: sale.customer_tin || null,
    payment_method: sale.payment_method || "cash",
    subtotal: safeNumber(sale.subtotal || sale.total),
    tax: safeNumber(sale.tax || sale.tax_total),
    discount: safeNumber(sale.discount),
    total: safeNumber(sale.total || sale.grand_total),
    currency: sale.currency || "RWF",
    items,
  };
}

function normalizeEmbeddedItems(sale: JsonRecord) {
  const raw =
    Array.isArray(sale.items_data)
      ? sale.items_data
      : Array.isArray(sale.line_items)
        ? sale.line_items
        : Array.isArray(sale.sale_items)
          ? sale.sale_items
          : [];

  return raw.map((item: JsonRecord) => ({
    product_id: item.product_id || null,
    product_name: item.product_name || item.name || "Item",
    sku: item.sku || null,
    quantity: safeNumber(item.quantity || item.qty),
    unit_price: safeNumber(item.unit_price || item.price),
    unit_cost: safeNumber(item.unit_cost || item.cost_price),
    subtotal: safeNumber(item.subtotal || item.total),
    discount: safeNumber(item.discount),
    tax: safeNumber(item.tax),
    total: safeNumber(
      item.total ||
        safeNumber(item.unit_price || item.price) *
          safeNumber(item.quantity || item.qty),
    ),
  }));
}

function buildHeaders(settings: JsonRecord) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (settings.username && settings.password_secret) {
    headers.Authorization = `Basic ${btoa(
      `${settings.username}:${settings.password_secret}`,
    )}`;
  }

  if (settings.api_key) headers.Authorization = `Bearer ${settings.api_key}`;
  if (settings.device_id) headers["X-Device-ID"] = settings.device_id;
  if (settings.branch_id) headers["X-Branch-ID"] = settings.branch_id;
  if (settings.tin) headers["X-TIN"] = settings.tin;

  return headers;
}

function cleanUrl(value: string) {
  return String(value || "").replace(/\/+$/, "");
}

function safeNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

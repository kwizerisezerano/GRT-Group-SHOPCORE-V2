import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "@/lib/offlineAuth";
import {
  isOnline,
  isNetworkError,
  getPendingProducts,
  clearPendingProduct,
  getPendingCustomers,
  clearPendingCustomer,
  getPendingSuppliers,
  clearPendingSupplier,
  getPendingExpenses,
  clearPendingExpense,
  getPendingPurchases,
  clearPendingPurchase,
  getPendingSales,
  clearPendingSale,
  getPendingStockMovements,
  clearPendingStockMovement,
  getPending,
  clearPending,
  getOfflineSummary,
  offlineDB,
  removeCachedRecord,
  forceReplaceCachedTable,
  clearSyncedDirtyCacheRecord,
} from "@/lib/offlineStore";

type SyncResult = {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
};

type ClearFn = (offlineId: string) => Promise<void>;

const OFFLINE_SALE_ID_MAP_KEY = "shopcore_offline_sale_id_map";

const SUPABASE_REACHABILITY_TIMEOUT_MS = 4500;

const SYNC_OPERATION_TIMEOUT_MS = 20000;
const SYNC_STEP_TIMEOUT_MS = 45000;

function withTimeout<T>(
  promise: Promise<T>,
  message = "Sync operation timeout",
  timeoutMs = SYNC_OPERATION_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: number | undefined;

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) window.clearTimeout(timeoutId);
    }),
    new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error(message)),
        timeoutMs,
      );
    }),
  ]);
}

async function runSyncStep(
  result: SyncResult,
  label: string,
  fn: () => Promise<void>,
  critical = false,
) {
  try {
    await withTimeout(fn(), `${label} sync timeout`, SYNC_STEP_TIMEOUT_MS);
  } catch (error: any) {
    if (isNetworkError(error) || critical) throw error;
    result.failed += 1;
    result.errors.push(`${label}: ${error?.message || "sync failed"}`);
  }
}

function uniqueKeys(...values: any[]) {
  return Array.from(
    new Set(values.map((value) => String(value || "")).filter(Boolean)),
  );
}

async function forceSaveCachedTable(table: string, records: any[]) {
  try {
    await withTimeout(
      forceReplaceCachedTable(table, records || []),
      `Saving refreshed cache for ${table} timed out`,
      12000,
    );
  } catch {
    await withTimeout(
      offlineDB.setItem(`cached_${table}`, records || []),
      `Fallback cache save for ${table} timed out`,
      12000,
    ).catch(() => undefined);
  }
}

async function refreshOnlineCaches(tenantId?: string | null) {
  const tables = [
    { name: "products", order: "created_at", limit: 10000 },
    { name: "stock_batches", order: "created_at", limit: 10000 },
    { name: "stock_movements", order: "created_at", limit: 1000 },
    { name: "sales", order: "created_at", limit: 1000 },
    { name: "sale_items", order: "created_at", limit: 5000 },
    { name: "customers", order: "created_at", limit: 5000 },
    { name: "expenses", order: "created_at", limit: 5000 },
    { name: "purchases", order: "created_at", limit: 5000 },
    { name: "purchase_items", order: "created_at", limit: 5000 },
    { name: "suppliers", order: "created_at", limit: 5000 },
    { name: "categories", order: "created_at", limit: 5000 },
    { name: "brands", order: "created_at", limit: 5000 },
    { name: "units", order: "created_at", limit: 5000 },
    { name: "sale_refunds", order: "created_at", limit: 5000 },
    { name: "sale_refund_items", order: "created_at", limit: 5000 },
    { name: "workspace_members", order: "created_at", limit: 5000 },
    { name: "workspace_messages", order: "created_at", limit: 1000 },
    { name: "workspace_meetings", order: "created_at", limit: 1000 },
    { name: "workspace_channels", order: "created_at", limit: 1000 },
    { name: "workspace_message_reactions", order: "created_at", limit: 5000 },
    { name: "branches", order: "created_at", limit: 5000 },
    { name: "warehouses", order: "created_at", limit: 5000 },
    { name: "transfers", order: "created_at", limit: 5000 },
    { name: "stock_counts", order: "created_at", limit: 5000 },
    { name: "quotations", order: "created_at", limit: 5000 },
    { name: "staff", order: "created_at", limit: 5000 },
    { name: "ebm_settings", order: "created_at", limit: 100 },
  ];

  for (const table of tables) {
    try {
      let query = (supabase as any).from(table.name).select("*");

      if (tenantId) query = query.eq("tenant_id", tenantId);

      query = query.order(table.order, { ascending: false }).limit(table.limit);

      const { data, error } = await query;
      if (error) continue;

      await forceSaveCachedTable(table.name, data || []);
    } catch {
      // Cache refresh should never break sync.
    }
  }
}

async function getSyncTenantId() {
  const summary = await getOfflineSummary();
  void summary;

  const tables = [
    "products",
    "sales",
    "customers",
    "suppliers",
    "expenses",
    "purchases",
    "stock_movements",
    "stock_batches",
    "categories",
    "brands",
    "units",
    "stock_adjustments",
    "sale_items",
    "sale_refunds",
    "sale_refund_items",
    "workspace_messages",
    "workspace_members",
    "workspace_meetings",
    "workspace_channels",
    "workspace_tasks",
    "workspace_polls",
    "workspace_message_reactions",
    "workspace_message_pins",
    "branches",
    "warehouses",
    "transfers",
    "stock_counts",
    "quotations",
    "loyalty",
    "loyalty_members",
    "staff",
    "ebm_settings",
  ];

  for (const table of tables) {
    const rows = await getPending(table).catch(() => []);
    const tenantId = rows.find((row: any) => row?.tenant_id)?.tenant_id;
    if (tenantId) return tenantId;
  }

  return null;
}

async function clearPendingAndCached(
  table: string,
  item: any,
  clearFn?: ClearFn,
) {
  const keys = uniqueKeys(
    item?.offline_id,
    item?.id,
    item?.offline_local_id,
    item?.client_id,
    item?.reference_id,
    item?.invoice_no,
    item?.receipt_no,
  );

  for (const key of keys) {
    if (clearFn) await clearFn(key).catch(() => undefined);
    await clearPending(table, key).catch(() => undefined);
    await removeCachedRecord(table, key).catch(() => undefined);
    await clearSyncedDirtyCacheRecord(table, key).catch(() => undefined);
  }
}

async function canReachSupabase() {
  try {
    const healthCheck = (supabase as any)
      .from("profiles")
      .select("id")
      .limit(1);

    const response: any = await withTimeout(
      Promise.resolve(healthCheck),
      "Supabase reachability check timeout",
      SUPABASE_REACHABILITY_TIMEOUT_MS,
    );

    const error = response?.error;

    if (!error) return true;

    const code = String(error?.code || "");
    const message = String(error?.message || "").toLowerCase();

    // These responses prove the Supabase API is reachable.
    // They may happen because of RLS, authentication, or schema constraints,
    // but they should not block offline queue sync from trying.
    if (
      code === "PGRST301" ||
      code === "42501" ||
      message.includes("permission denied") ||
      message.includes("jwt") ||
      message.includes("row-level security")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function saleIdentityKeys(item: any) {
  return [
    String(item?.id || ""),
    String(item?.offline_id || ""),
    String(item?.offline_local_id || ""),
  ].filter(Boolean);
}

function rememberSaleIdMapFromItem(item: any, onlineId: any) {
  for (const key of saleIdentityKeys(item)) rememberSaleIdMap(key, onlineId);
}

function readOfflineSaleIdMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_SALE_ID_MAP_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeOfflineSaleIdMap(map: Record<string, string>) {
  localStorage.setItem(OFFLINE_SALE_ID_MAP_KEY, JSON.stringify(map));
}

function rememberSaleIdMap(offlineId: any, onlineId: any) {
  const offline = String(offlineId || "");
  const online = String(onlineId || "");

  if (!offline || !online) return;
  if (!offline.startsWith("offline-")) return;

  const map = readOfflineSaleIdMap();
  map[offline] = online;
  writeOfflineSaleIdMap(map);
}

function isUuid(value: any) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function isOfflineProductId(value: any) {
  return (
    String(value || "").startsWith("offline-product-") || isOfflineId(value)
  );
}

async function findExistingProduct(item: any) {
  if (!item?.tenant_id) return null;

  if (item?.sku) {
    const { data, error } = await (supabase as any)
      .from("products")
      .select("id, tenant_id, stock, stock_quantity, name, sku")
      .eq("tenant_id", item.tenant_id)
      .eq("sku", item.sku)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  if (item?.barcode) {
    const { data, error } = await (supabase as any)
      .from("products")
      .select("id, tenant_id, stock, stock_quantity, name, barcode")
      .eq("tenant_id", item.tenant_id)
      .eq("barcode", item.barcode)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  if (item?.name) {
    const { data, error } = await (supabase as any)
      .from("products")
      .select("id, tenant_id, stock, stock_quantity, name")
      .eq("tenant_id", item.tenant_id)
      .ilike("name", item.name)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  return null;
}

async function updateProductStockAbsolute(args: {
  tenantId: string;
  productId: string;
  stock: number;
  status?: string | null;
}) {
  const nextStock = Number.isFinite(Number(args.stock))
    ? Number(args.stock)
    : 0;
  const { error } = await (supabase as any)
    .from("products")
    .update({
      stock: nextStock,
      stock_quantity: nextStock,
      status: args.status || (nextStock <= 0 ? "out_of_stock" : "active"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.productId)
    .eq("tenant_id", args.tenantId);
  if (error) throw error;
}

async function applyProductStockDelta(args: {
  tenantId: string;
  productId: string;
  quantityChange: number;
  statusWhenPositive?: string;
}) {
  const { data: product, error: productError } = await (supabase as any)
    .from("products")
    .select("id, stock, stock_quantity")
    .eq("id", args.productId)
    .eq("tenant_id", args.tenantId)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) return null;
  const currentStock = Number(product.stock ?? product.stock_quantity ?? 0);
  const nextStock = Math.max(
    0,
    currentStock + Number(args.quantityChange || 0),
  );
  await updateProductStockAbsolute({
    tenantId: args.tenantId,
    productId: args.productId,
    stock: nextStock,
    status:
      nextStock <= 0 ? "out_of_stock" : args.statusWhenPositive || "active",
  });
  return { currentStock, nextStock };
}

function isSaleCreateRecord(item: any) {
  const operation = String(item?.operation || "create").toLowerCase();

  return (
    operation === "create" &&
    (String(item?.id || "").startsWith("offline-sale-") ||
      String(item?.offline_id || "").startsWith("offline-sale-") ||
      Array.isArray(item?.line_items) ||
      Array.isArray(item?.sale_items) ||
      Array.isArray(item?.items_data)) &&
    !item?.restore_stock_on_sync &&
    !item?.partial_refund_on_sync &&
    !item?.partial_refund_items &&
    !item?.refund_items
  );
}

function isQueuedSaleOperationRecord(item: any) {
  const operation = String(item?.operation || "").toLowerCase();

  return (
    operation === "update" ||
    operation === "delete" ||
    item?.restore_stock_on_sync ||
    item?.partial_refund_on_sync ||
    item?.partial_refund_items ||
    item?.refund_items ||
    item?.credit_paid_on_sync
  );
}

async function resolveOnlineSaleId(item: any) {
  const rawId = String(item?.id || "");
  const map = readOfflineSaleIdMap();

  if (isUuid(rawId)) return rawId;

  for (const key of saleIdentityKeys(item)) {
    if (map[key]) return map[key];
  }

  const existing = await findExistingSale(item);
  if (existing?.id) {
    rememberSaleIdMapFromItem(item, existing.id);
    return existing.id;
  }

  return null;
}

async function requireOnlineSupabaseSession() {
  if (isOfflineMode()) {
    throw new Error(
      "Online login required before syncing. Please log out of offline mode, then log in using the normal online login tab.",
    );
  }

  const reachable = await canReachSupabase();
  if (!reachable) {
    throw new Error(
      "Internet is connected, but Supabase is not reachable yet. Wait a few seconds and sync again.",
    );
  }

  const { data, error } = await supabase.auth.getSession();
  if (error)
    throw new Error(error.message || "Could not verify Supabase session.");
  if (data.session?.access_token) return data.session;

  await supabase.auth.refreshSession();
  const refreshed = await supabase.auth.getSession();
  if (refreshed.data.session?.access_token) return refreshed.data.session;

  throw new Error(
    "Online login required before syncing. Please log in using the normal online login tab.",
  );
}

function asNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function isOfflineId(value: any) {
  return String(value || "").startsWith("offline-");
}

function removeUndefinedFields(payload: any) {
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });
  return payload;
}

function cleanOfflineFields(record: any) {
  const {
    offline_id,
    sync_status,
    created_offline_at,
    updated_offline_at,
    operation,
    line_items,
    sale_items,
    items_data,
    offline_local_id,
    batch_payload,
    refund_items,
    partial_refund_items,
    restore_stock_on_sync,
    restore_reason,
    partial_refund_on_sync,
    refund_reason,
    refund_no,
    ...clean
  } = record;

  return removeUndefinedFields(clean);
}

function sanitizeGenericPayload(payload: any) {
  const clean = cleanOfflineFields(payload);
  if (isOfflineId(clean.id)) delete clean.id;
  return removeUndefinedFields(clean);
}

function sanitizeProductPayload(payload: any) {
  const clean = sanitizeGenericPayload(payload);

  clean.name = String(clean.name || payload?.product_name || "").trim();
  clean.sku = String(clean.sku || "").trim() || null;
  clean.barcode = String(clean.barcode || "").trim() || null;
  clean.selling_price = asNumber(
    clean.selling_price ?? payload?.price ?? payload?.sale_price ?? 0,
  );
  clean.cost_price = asNumber(
    clean.cost_price ?? payload?.purchase_price ?? payload?.unit_cost ?? 0,
  );
  clean.stock = asNumber(clean.stock ?? clean.stock_quantity ?? 0);
  clean.stock_quantity = asNumber(clean.stock_quantity ?? clean.stock ?? 0);
  clean.status = clean.status || (clean.stock <= 0 ? "out_of_stock" : "active");
  clean.created_at = clean.created_at || new Date().toISOString();
  clean.updated_at = new Date().toISOString();

  delete clean.price;
  delete clean.sale_price;
  delete clean.purchase_price;
  delete clean.unit_cost;
  delete clean.product_name;

  return removeUndefinedFields(clean);
}

function sanitizeStockMovementPayload(payload: any) {
  const clean = sanitizeGenericPayload(payload);

  // Your current Supabase stock_movements schema does not contain these columns.
  // Keep cost/selling details inside notes or stock_batches instead.
  delete clean.selling_price;
  delete clean.unit_cost;
  delete clean.price;
  delete clean.purchase_price;
  delete clean.batch_no;
  delete clean.sku;
  delete clean.barcode;

  if (String(clean.movement_type || "") === "adjustment_in")
    clean.movement_type = "adjustment";
  if (String(clean.movement_type || "") === "adjustment_out")
    clean.movement_type = "adjustment";

  return removeUndefinedFields(clean);
}

function isMissingRelationError(error: any) {
  const message = String(error?.message || error?.details || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    message.includes("could not find the table") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

const OPTIONAL_SYNC_TABLES = new Set([
  "workspace_tasks",
  "workspace_polls",
  "workspace_message_pins",
  "loyalty",
  "loyalty_members",
  "stock_adjustments",
]);

const tableAvailabilityCache = new Map<string, boolean>();

async function canSyncTable(table: string) {
  if (!OPTIONAL_SYNC_TABLES.has(table)) return true;
  if (tableAvailabilityCache.has(table))
    return tableAvailabilityCache.get(table) === true;

  try {
    const { error } = await (supabase as any).from(table).select("id").limit(1);
    const available = !error;
    tableAvailabilityCache.set(table, available);
    return available;
  } catch {
    tableAvailabilityCache.set(table, false);
    return false;
  }
}

function sanitizeBatchPayload(payload: any) {
  const clean = { ...payload };

  delete clean.id;
  delete clean.offline_id;
  delete clean.sync_status;
  delete clean.operation;
  delete clean.created_offline_at;
  delete clean.updated_offline_at;
  delete clean.offline_local_id;

  if (isOfflineId(clean.product_id)) delete clean.product_id;

  clean.quantity_in = asNumber(
    clean.quantity_in || clean.quantity || clean.quantity_remaining,
  );
  clean.quantity_remaining = asNumber(
    clean.quantity_remaining ?? clean.quantity_in,
  );
  clean.cost_price = asNumber(clean.cost_price ?? clean.unit_cost);
  clean.selling_price = asNumber(clean.selling_price ?? clean.unit_price);
  clean.status =
    clean.status || (clean.quantity_remaining > 0 ? "active" : "depleted");
  clean.source_type = clean.source_type || "offline_adjustment";
  clean.created_at = clean.created_at || new Date().toISOString();

  return removeUndefinedFields(clean);
}

function sanitizeSalesPayload(payload: any) {
  const clean = { ...payload };

  delete clean.id;
  delete clean.updated_at;
  delete clean.updated_offline_at;
  delete clean.created_offline_at;
  delete clean.sync_status;
  delete clean.operation;
  delete clean.offline_id;
  delete clean.line_items;
  delete clean.sale_items;
  delete clean.items_data;
  delete clean.offline_local_id;
  delete clean.restore_stock_on_sync;
  delete clean.restore_reason;
  delete clean.partial_refund_on_sync;
  delete clean.partial_refund_items;
  delete clean.refund_items;
  delete clean.refund_reason;

  clean.status =
    clean.status === "pending_sync" ? "completed" : clean.status || "completed";
  clean.ebm_status = clean.ebm_status || "not_synced";
  clean.created_at = clean.created_at || new Date().toISOString();
  clean.date = clean.date || clean.created_at;

  return removeUndefinedFields(clean);
}

function getItemName(item: any, fields: string[]) {
  return (
    fields.map((field) => item?.[field]).find(Boolean) || item?.id || "Unknown"
  );
}

function hasRequiredText(value: any) {
  return String(value || "").trim().length > 0;
}

async function discardInvalidPendingRecord(
  result: SyncResult,
  table: string,
  item: any,
  label: string,
  reason: string,
  clearFn?: ClearFn,
) {
  await clearPendingAndCached(table, item, clearFn);
  result.errors.push(
    `${label} "${getItemName(item, ["name", "sku", "barcode", "code"])}" skipped: ${reason}`,
  );
}

function validateProductSyncRecord(item: any) {
  const operation = String(item?.operation || "create").toLowerCase();

  if (operation === "delete") return null;

  if (!hasRequiredText(item?.tenant_id)) {
    return "missing tenant_id";
  }

  const candidateName = String(item?.name || item?.product_name || "").trim();
  if (!candidateName) {
    return "missing product name";
  }

  return null;
}

function getSaleLines(record: any) {
  const lines =
    record?.line_items || record?.sale_items || record?.items_data || [];
  return Array.isArray(lines) ? lines : [];
}

function getLineRefundedQuantity(line: any) {
  return asNumber(
    line?.refunded_quantity ?? line?.refunded_qty ?? line?.refund_quantity ?? 0,
  );
}

function getLineQuantity(line: any) {
  return asNumber(line?.quantity ?? line?.qty ?? 0);
}

function sameSaleIdentity(a: any, b: any) {
  const aKeys = saleIdentityKeys(a);
  const bKeys = saleIdentityKeys(b);
  return aKeys.some((key) => bKeys.includes(key));
}

function hasQueuedOperationForSale(createRecord: any, queuedOps: any[]) {
  return queuedOps.some((op) => sameSaleIdentity(createRecord, op));
}

function getRefundStatus(refundedQuantity: number, totalQuantity: number) {
  if (refundedQuantity <= 0) return "none";
  return refundedQuantity >= totalQuantity ? "refunded" : "partial_refunded";
}

async function clearPendingSaleRecord(item: any) {
  await clearPendingAndCached("sales", item, clearPendingSale);
}

async function syncRecord(table: string, item: any, clearFn: ClearFn) {
  const operation = String(item.operation || "create").toLowerCase();
  const payload = sanitizeGenericPayload(item);

  const clearThis = async (onlineId?: string | null) => {
    const keys = uniqueKeys(
      item.offline_id,
      item.id,
      item.offline_local_id,
      item.client_id,
      payload?.id,
      onlineId,
    );

    for (const key of keys) {
      await clearFn(key).catch(() => undefined);
      await clearPending(table, key).catch(() => undefined);
      await removeCachedRecord(table, key).catch(() => undefined);
      await clearSyncedDirtyCacheRecord(table, key).catch(() => undefined);
    }
  };

  if (operation === "delete") {
    if (!payload.id || isOfflineId(payload.id)) {
      await clearThis();
      return null;
    }
    const { error } = await (supabase as any)
      .from(table)
      .delete()
      .eq("id", payload.id);
    if (error) throw error;
    await clearThis(payload.id);
    return payload.id;
  }

  if (operation === "update") {
    if (!payload.id || isOfflineId(payload.id)) {
      delete payload.id;
      const { data, error } = await (supabase as any)
        .from(table)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      await clearThis(data?.id);
      return data?.id || null;
    }
    const onlineId = payload.id;
    delete payload.id;
    const query = (supabase as any)
      .from(table)
      .update(payload)
      .eq("id", onlineId);
    if (payload.tenant_id) query.eq("tenant_id", payload.tenant_id);
    const { error } = await query;
    if (error) throw error;
    await clearThis(onlineId);
    return onlineId;
  }

  if (isOfflineId(payload.id)) delete payload.id;
  const { data, error } = await (supabase as any)
    .from(table)
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  await clearThis(data?.id);
  return data?.id || null;
}
async function syncGenericPendingTable(
  result: SyncResult,
  table: string,
  label: string,
  nameFields: string[] = ["name", "code"],
) {
  const items = await getPending(table);

  if (items.length > 0 && !(await canSyncTable(table))) {
    result.errors.push(
      `${label}: skipped because Supabase table "${table}" does not exist yet.`,
    );
    return;
  }

  for (const item of items) {
    try {
      await withTimeout(
        syncRecord(table, item, (offlineId) => clearPending(table, offlineId)),
        `${label} "${getItemName(item, nameFields)}" sync timeout`,
      );
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `${label} "${getItemName(item, nameFields)}": ${error?.message || "sync failed"}`,
      );
    }
  }
}

async function syncStockBatches(result: SyncResult) {
  const items = await getPending("stock_batches");

  for (const item of items) {
    try {
      const payload = sanitizeBatchPayload(item);
      if (!payload.tenant_id || !payload.product_id) {
        await clearPendingAndCached("stock_batches", item);
        continue;
      }

      const { data: existingBatch, error: existingError } = await (
        supabase as any
      )
        .from("stock_batches")
        .select("id")
        .eq("tenant_id", payload.tenant_id)
        .eq("product_id", payload.product_id)
        .eq("batch_no", payload.batch_no)
        .maybeSingle();

      if (existingError) throw existingError;

      if (!existingBatch?.id) {
        const { error } = await (supabase as any)
          .from("stock_batches")
          .insert(payload);
        if (error) throw error;
      }

      await clearPendingAndCached("stock_batches", item);
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `Stock batch "${item.batch_no || item.product_name || item.product_id}": ${error?.message || "sync failed"}`,
      );
    }
  }
}

async function syncProducts(result: SyncResult) {
  const items = await getPendingProducts();

  for (const item of items) {
    try {
      const operation = String(item.operation || "create").toLowerCase();
      const validationError = validateProductSyncRecord(item);

      if (validationError) {
        await discardInvalidPendingRecord(
          result,
          "products",
          item,
          "Product",
          validationError,
          clearPendingProduct,
        );
        continue;
      }

      if (operation === "delete") {
        await syncRecord("products", item, clearPendingProduct);
        result.synced += 1;
        continue;
      }

      const existingProduct = await findExistingProduct(item);
      const payload = sanitizeProductPayload(item);
      const stockValue = Number(payload.stock ?? payload.stock_quantity ?? 0);

      if (!payload.name) {
        await discardInvalidPendingRecord(
          result,
          "products",
          item,
          "Product",
          "missing product name after sanitizing",
          clearPendingProduct,
        );
        continue;
      }

      if (existingProduct?.id) {
        const onlineId = existingProduct.id;
        delete payload.id;

        const { error } = await (supabase as any)
          .from("products")
          .update({
            ...payload,
            stock: stockValue,
            stock_quantity: stockValue,
            status:
              payload.status || (stockValue <= 0 ? "out_of_stock" : "active"),
            updated_at: new Date().toISOString(),
          })
          .eq("id", onlineId)
          .eq("tenant_id", item.tenant_id);

        if (error) throw error;

        await clearPendingAndCached("products", item, clearPendingProduct);
        await removeCachedRecord("products", onlineId).catch(() => undefined);
        result.synced += 1;
        continue;
      }

      const cleanCreatePayload = sanitizeProductPayload(item);
      if (isOfflineId(cleanCreatePayload.id)) delete cleanCreatePayload.id;

      if (!cleanCreatePayload.name) {
        await discardInvalidPendingRecord(
          result,
          "products",
          item,
          "Product",
          "missing product name before insert",
          clearPendingProduct,
        );
        continue;
      }

      const { data: createdProduct, error: createError } = await (
        supabase as any
      )
        .from("products")
        .insert(cleanCreatePayload)
        .select("id")
        .single();

      if (createError) throw createError;

      const onlineId = createdProduct?.id || null;

      if (onlineId && item.tenant_id && Number.isFinite(stockValue)) {
        await updateProductStockAbsolute({
          tenantId: item.tenant_id,
          productId: onlineId,
          stock: stockValue,
          status: payload.status,
        });
      }

      await clearPendingAndCached("products", item, clearPendingProduct);
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `Product "${item.name || item.sku || item.id}": ${error?.message || "sync failed"}`,
      );
    }
  }
}

async function syncCustomers(result: SyncResult) {
  const items = await getPendingCustomers();
  for (const item of items) {
    try {
      await syncRecord("customers", item, clearPendingCustomer);
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `Customer "${item.name || item.code || item.id}": ${error?.message || "sync failed"}`,
      );
    }
  }
}

async function syncSuppliers(result: SyncResult) {
  const items = await getPendingSuppliers();
  for (const item of items) {
    try {
      await syncRecord("suppliers", item, clearPendingSupplier);
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `Supplier "${item.name || item.code || item.id}": ${error?.message || "sync failed"}`,
      );
    }
  }
}

async function syncExpenses(result: SyncResult) {
  const items = await getPendingExpenses();
  for (const item of items) {
    try {
      await syncRecord("expenses", item, clearPendingExpense);
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `Expense "${item.title || item.reference || item.id}": ${error?.message || "sync failed"}`,
      );
    }
  }
}

async function syncPurchases(result: SyncResult) {
  const items = await getPendingPurchases();
  for (const item of items) {
    try {
      await syncRecord("purchases", item, clearPendingPurchase);
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `Purchase "${item.purchase_no || item.supplier_name || item.id}": ${error?.message || "sync failed"}`,
      );
    }
  }
}

async function findExistingSale(item: any) {
  const invoiceNo = item.invoice_no || item.receipt_no;
  if (!invoiceNo || !item.tenant_id) return null;

  const { data, error } = await (supabase as any)
    .from("sales")
    .select("id, tenant_id, invoice_no, receipt_no")
    .eq("tenant_id", item.tenant_id)
    .or(`invoice_no.eq.${invoiceNo},receipt_no.eq.${invoiceNo}`)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function resolveSaleProduct(line: any, tenantId: string) {
  const productId = String(line.product_id || "");
  if (productId && !isOfflineId(productId)) return productId;

  const sku = String(line.sku || "").trim();
  if (sku) {
    const { data, error } = await (supabase as any)
      .from("products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("sku", sku)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id;
  }

  const name = String(line.product_name || line.name || "").trim();
  if (name) {
    const { data, error } = await (supabase as any)
      .from("products")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", name)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id;
  }

  return null;
}

async function resolveBatchId(
  line: any,
  tenantId: string,
  productId: string | null,
) {
  if (!productId) return null;

  const givenBatchId = String(line.batch_id || "");
  if (givenBatchId && !isOfflineId(givenBatchId)) return givenBatchId;

  const batchNo = String(line.batch_no || line.batch_ref || "").trim();
  if (batchNo) {
    const { data, error } = await (supabase as any)
      .from("stock_batches")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .eq("batch_no", batchNo)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id;
  }

  const unitCost = asNumber(line.unit_cost ?? line.cost_price);
  const unitPrice = asNumber(
    line.unit_price ?? line.selling_price ?? line.price,
  );

  let query = (supabase as any)
    .from("stock_batches")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .gt("quantity_remaining", 0)
    .order("created_at", { ascending: true })
    .limit(1);

  if (unitCost > 0) query = query.eq("cost_price", unitCost);
  if (unitPrice > 0) query = query.eq("selling_price", unitPrice);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function decrementBatchQuantity(
  batchId: string | null,
  tenantId: string,
  quantity: number,
) {
  if (!batchId || quantity <= 0) return;

  const { data: batch, error: batchError } = await (supabase as any)
    .from("stock_batches")
    .select("id, quantity_remaining")
    .eq("id", batchId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (batchError) throw batchError;
  if (!batch) return;

  const nextRemaining = Math.max(
    0,
    asNumber(batch.quantity_remaining) - quantity,
  );

  const { error } = await (supabase as any)
    .from("stock_batches")
    .update({
      quantity_remaining: nextRemaining,
      status: nextRemaining <= 0 ? "depleted" : "active",
    })
    .eq("id", batchId)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}

async function incrementBatchQuantity(
  batchId: string | null,
  tenantId: string,
  quantity: number,
) {
  if (!batchId || quantity <= 0) return;

  const { data: batch, error: batchError } = await (supabase as any)
    .from("stock_batches")
    .select("id, quantity_remaining")
    .eq("id", batchId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (batchError) throw batchError;
  if (!batch) return;

  const nextRemaining = asNumber(batch.quantity_remaining) + quantity;

  const { error } = await (supabase as any)
    .from("stock_batches")
    .update({
      quantity_remaining: nextRemaining,
      status: nextRemaining <= 0 ? "depleted" : "active",
    })
    .eq("id", batchId)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}

async function restoreSingleProductStock(args: {
  tenantId: string;
  userId: string | null;
  saleId: string;
  saleItemId?: string | null;
  productId: string;
  productName?: string | null;
  batchId?: string | null;
  quantity: number;
  reason: string;
}) {
  const { data: product, error: productError } = await (supabase as any)
    .from("products")
    .select("id, stock, stock_quantity, name")
    .eq("id", args.productId)
    .eq("tenant_id", args.tenantId)
    .maybeSingle();

  if (productError) throw productError;
  if (!product) return;

  const currentStock = Number(product.stock ?? product.stock_quantity ?? 0);
  const newStock = currentStock + args.quantity;

  const { error: stockError } = await (supabase as any)
    .from("products")
    .update({
      stock: newStock,
      stock_quantity: newStock,
      status: newStock <= 0 ? "out_of_stock" : "active",
    })
    .eq("id", args.productId)
    .eq("tenant_id", args.tenantId);

  if (stockError) throw stockError;

  await incrementBatchQuantity(
    args.batchId || null,
    args.tenantId,
    args.quantity,
  );

  if (args.saleItemId) {
    const { data: saleItem, error: saleItemError } = await (supabase as any)
      .from("sale_items")
      .select("quantity, refunded_quantity")
      .eq("id", args.saleItemId)
      .eq("tenant_id", args.tenantId)
      .maybeSingle();

    if (saleItemError) throw saleItemError;

    const totalQuantity = asNumber(saleItem?.quantity);
    const newRefundedQty = Math.min(
      totalQuantity,
      asNumber(saleItem?.refunded_quantity) + args.quantity,
    );

    const { error: updateItemError } = await (supabase as any)
      .from("sale_items")
      .update({
        refunded_quantity: newRefundedQty,
        refund_status:
          newRefundedQty <= 0
            ? "none"
            : newRefundedQty >= totalQuantity
              ? "refunded"
              : "partial_refunded",
      })
      .eq("id", args.saleItemId)
      .eq("tenant_id", args.tenantId);

    if (updateItemError) throw updateItemError;
  }

  const { error: movementError } = await (supabase as any)
    .from("stock_movements")
    .insert({
      tenant_id: args.tenantId,
      user_id: args.userId,
      product_id: args.productId,
      product_name: args.productName || product.name || "Unknown Product",
      movement_type: args.reason === "cancelled" ? "sale_cancel" : "refund",
      quantity_change: args.quantity,
      stock_before: currentStock,
      stock_after: newStock,
      reference: args.reason,
      reference_id: args.saleId,
      notes: `Offline sync ${args.reason} restored stock`,
      created_at: new Date().toISOString(),
    });

  if (movementError) throw movementError;
}

async function restoreSaleItemsStock(
  saleId: string,
  tenantId: string,
  userId: string | null,
  reason: string,
) {
  const { data: saleItems, error: itemsError } = await (supabase as any)
    .from("sale_items")
    .select(
      "id, sale_id, tenant_id, product_id, product_name, quantity, refunded_quantity, batch_id",
    )
    .eq("sale_id", saleId)
    .eq("tenant_id", tenantId);

  if (itemsError) throw itemsError;

  for (const item of saleItems || []) {
    if (!item.product_id) continue;

    const soldQty = asNumber(item.quantity);
    const alreadyRefunded = asNumber(item.refunded_quantity);
    const restoreQty = Math.max(0, soldQty - alreadyRefunded);
    if (restoreQty <= 0) continue;

    await restoreSingleProductStock({
      tenantId,
      userId,
      saleId,
      saleItemId: item.id,
      productId: item.product_id,
      productName: item.product_name,
      batchId: item.batch_id,
      quantity: restoreQty,
      reason,
    });
  }
}

async function recalculateSaleAfterRefund(saleId: string, tenantId: string) {
  const { data: saleItems, error: itemsError } = await (supabase as any)
    .from("sale_items")
    .select("quantity, refunded_quantity, unit_price, unit_cost, discount, tax")
    .eq("sale_id", saleId)
    .eq("tenant_id", tenantId);

  if (itemsError) throw itemsError;

  let subtotal = 0;
  let tax = 0;
  let discount = 0;
  let costTotal = 0;

  for (const item of saleItems || []) {
    const activeQty = Math.max(
      0,
      asNumber(item.quantity) - asNumber(item.refunded_quantity),
    );
    const lineSubtotal = asNumber(item.unit_price) * activeQty;
    const originalQty = Math.max(1, asNumber(item.quantity));
    const discountPerUnit = asNumber(item.discount) / originalQty;
    const taxPerUnit = asNumber(item.tax) / originalQty;

    subtotal += lineSubtotal;
    discount += discountPerUnit * activeQty;
    tax += taxPerUnit * activeQty;
    costTotal += asNumber(item.unit_cost) * activeQty;
  }

  const total = subtotal - discount + tax;
  const grossProfit = total - costTotal;
  const status = total <= 0 ? "refunded" : "partial_refunded";

  const { error } = await (supabase as any)
    .from("sales")
    .update({
      subtotal,
      discount,
      tax,
      total,
      cost_total: costTotal,
      cogs_total: costTotal,
      gross_profit: grossProfit,
      profit: grossProfit,
      net_profit: grossProfit,
      status,
      due: 0,
    })
    .eq("id", saleId)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}

async function resolveSaleItemForRefund(
  refundLine: any,
  saleId: string,
  tenantId: string,
) {
  const givenId = String(refundLine.sale_item_id || refundLine.id || "");

  if (givenId && isUuid(givenId)) {
    const { data, error } = await (supabase as any)
      .from("sale_items")
      .select(
        "id, sale_id, tenant_id, product_id, product_name, quantity, refunded_quantity, unit_price, unit_cost, total, batch_id",
      )
      .eq("id", givenId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data;
  }

  let query = (supabase as any)
    .from("sale_items")
    .select(
      "id, sale_id, tenant_id, product_id, product_name, sku, quantity, refunded_quantity, unit_price, unit_cost, total, batch_id",
    )
    .eq("sale_id", saleId)
    .eq("tenant_id", tenantId);

  const productId = String(refundLine.product_id || "");
  const sku = String(refundLine.sku || "").trim();
  const productName = String(
    refundLine.product_name || refundLine.name || "",
  ).trim();

  if (productId && !isOfflineId(productId)) {
    query = query.eq("product_id", productId);
  } else if (sku) {
    query = query.eq("sku", sku);
  } else if (productName) {
    query = query.ilike("product_name", productName);
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function syncPartialRefund(item: any) {
  const refundItems = item.partial_refund_items || item.refund_items || [];
  if (!Array.isArray(refundItems) || refundItems.length === 0) return;

  const refundNo = item.refund_no || `RF-${Date.now().toString().slice(-8)}`;
  let refundTotal = 0;
  let refund: any = null;

  const { data: existingRefund, error: existingRefundError } = await (
    supabase as any
  )
    .from("sale_refunds")
    .select("id, refund_total")
    .eq("tenant_id", item.tenant_id)
    .eq("sale_id", item.id)
    .eq("refund_no", refundNo)
    .maybeSingle();

  if (existingRefundError) throw existingRefundError;

  if (existingRefund?.id) {
    refund = existingRefund;
  } else {
    const { data: createdRefund, error: refundError } = await (supabase as any)
      .from("sale_refunds")
      .insert({
        tenant_id: item.tenant_id,
        sale_id: item.id,
        refund_no: refundNo,
        refund_type: "partial",
        reason: item.refund_reason || item.reason || null,
        status: "completed",
        user_id: item.user_id || null,
        refund_total: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (refundError) throw refundError;
    refund = createdRefund;
  }

  const refundRows = [];

  for (const refundLine of refundItems) {
    const saleItem = await resolveSaleItemForRefund(
      refundLine,
      item.id,
      item.tenant_id,
    );
    if (!saleItem?.product_id) continue;

    const availableToRefund = Math.max(
      0,
      asNumber(saleItem.quantity) - asNumber(saleItem.refunded_quantity),
    );
    const quantity = Math.min(asNumber(refundLine.quantity), availableToRefund);
    if (quantity <= 0) continue;

    const unitPrice = asNumber(saleItem.unit_price);
    const unitCost = asNumber(saleItem.unit_cost);
    const total = unitPrice * quantity;
    refundTotal += total;

    await restoreSingleProductStock({
      tenantId: item.tenant_id,
      userId: item.user_id || null,
      saleId: item.id,
      saleItemId: saleItem.id,
      productId: saleItem.product_id,
      productName: saleItem.product_name,
      batchId: saleItem.batch_id,
      quantity,
      reason: "refund",
    });

    refundRows.push({
      tenant_id: item.tenant_id,
      refund_id: refund.id,
      sale_id: item.id,
      sale_item_id: saleItem.id,
      product_id: saleItem.product_id,
      product_name: saleItem.product_name,
      quantity,
      unit_price: unitPrice,
      unit_cost: unitCost,
      total,
      batch_id: saleItem.batch_id,
      created_at: new Date().toISOString(),
    });
  }

  if (refundRows.length > 0) {
    const { error: refundItemsError } = await (supabase as any)
      .from("sale_refund_items")
      .insert(refundRows);
    if (refundItemsError) throw refundItemsError;
  }

  const { error: updateRefundError } = await (supabase as any)
    .from("sale_refunds")
    .update({ refund_total: asNumber(refund.refund_total) + refundTotal })
    .eq("id", refund.id)
    .eq("tenant_id", item.tenant_id);

  if (updateRefundError) throw updateRefundError;

  await recalculateSaleAfterRefund(item.id, item.tenant_id);
}

async function syncQueuedSaleOperations(result: SyncResult) {
  const items = (await getPending("sales")).filter(isQueuedSaleOperationRecord);

  for (const item of items) {
    try {
      if (!item.tenant_id) {
        await clearPending("sales", item.offline_id);
        continue;
      }

      const onlineSaleId = await resolveOnlineSaleId(item);

      if (!onlineSaleId) {
        continue;
      }

      if (item.restore_stock_on_sync) {
        await restoreSaleItemsStock(
          onlineSaleId,
          item.tenant_id,
          item.user_id || null,
          item.restore_reason || item.status || "refunded",
        );
        await recalculateSaleAfterRefund(onlineSaleId, item.tenant_id);
      }

      if (
        item.partial_refund_on_sync ||
        item.partial_refund_items ||
        item.refund_items
      ) {
        await syncPartialRefund({
          ...item,
          id: onlineSaleId,
          sale_id: onlineSaleId,
        });
      }

      const payload = cleanOfflineFields(item);
      delete payload.id;
      delete payload.sale_id;
      delete payload.restore_stock_on_sync;
      delete payload.restore_reason;
      delete payload.partial_refund_on_sync;
      delete payload.partial_refund_items;
      delete payload.refund_items;
      delete payload.refund_reason;
      delete payload.refund_no;
      delete payload.credit_paid_on_sync;

      if (Object.keys(payload).length > 0) {
        const { error } = await (supabase as any)
          .from("sales")
          .update(removeUndefinedFields(payload))
          .eq("id", onlineSaleId)
          .eq("tenant_id", item.tenant_id);

        if (error) throw error;
      }

      await clearPendingSaleRecord(item);
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `Sale update "${item.invoice_no || item.receipt_no || item.id}": ${
          error?.message || "sync failed"
        }`,
      );
    }
  }
}

async function syncSales(result: SyncResult) {
  const allPendingSales = await getPending("sales");
  const queuedOps = allPendingSales.filter(isQueuedSaleOperationRecord);
  const items = (await getPendingSales()).filter(isSaleCreateRecord);

  for (const item of items) {
    try {
      const existingSale = await findExistingSale(item);
      if (existingSale?.id) {
        rememberSaleIdMap(item.id, existingSale.id);
        rememberSaleIdMap(item.offline_id, existingSale.id);
        rememberSaleIdMap(item.offline_local_id, existingSale.id);
        await clearPendingSaleRecord(item);
        result.synced += 1;
        continue;
      }

      const lineItems = getSaleLines(item);
      const salePayload = sanitizeSalesPayload(item);
      const separateQueuedOperationWillReplayRefund = hasQueuedOperationForSale(
        item,
        queuedOps,
      );

      const { data: sale, error: saleError } = await (supabase as any)
        .from("sales")
        .insert(salePayload)
        .select()
        .single();

      if (saleError) throw saleError;

      rememberSaleIdMap(item.id, sale.id);
      rememberSaleIdMap(item.offline_id, sale.id);
      rememberSaleIdMap(item.offline_local_id, sale.id);

      if (Array.isArray(lineItems) && lineItems.length > 0) {
        const saleItems: any[] = [];
        const saleItemMeta: any[] = [];

        for (const line of lineItems) {
          const productId = await resolveSaleProduct(line, sale.tenant_id);
          const batchId = await resolveBatchId(line, sale.tenant_id, productId);
          const unitPrice = asNumber(line.unit_price || line.price);
          const quantity = getLineQuantity(line);
          const unitCost = asNumber(line.unit_cost || line.cost_price);
          const lineSubtotal = asNumber(line.subtotal || unitPrice * quantity);
          const lineDiscount = asNumber(line.discount);
          const lineTax = asNumber(line.tax);
          const lineTotal = asNumber(
            line.total || lineSubtotal - lineDiscount + lineTax,
          );
          const costTotal = asNumber(line.cost_total || unitCost * quantity);
          const offlineRefundedQuantity = Math.min(
            quantity,
            getLineRefundedQuantity(line),
          );

          saleItems.push({
            sale_id: sale.id,
            tenant_id: sale.tenant_id,
            product_id: productId,
            product_name: line.product_name || line.name || "Unknown Product",
            sku: line.sku || null,
            quantity,
            unit_price: unitPrice,
            unit_cost: unitCost,
            subtotal: lineSubtotal,
            discount: lineDiscount,
            tax: lineTax,
            total: lineTotal,
            cost_total: costTotal,
            gross_profit: lineTotal - costTotal,
            batch_id: batchId,
            refunded_quantity: 0,
            refund_status: "none",
          });

          saleItemMeta.push({ offlineRefundedQuantity });
        }

        const { data: insertedSaleItems, error: itemsError } = await (
          supabase as any
        )
          .from("sale_items")
          .insert(saleItems)
          .select(
            "id, sale_id, tenant_id, product_id, product_name, sku, quantity, unit_price, unit_cost, total, refunded_quantity, refund_status, batch_id",
          );

        if (itemsError) throw itemsError;

        const stockLines = (
          insertedSaleItems?.length ? insertedSaleItems : saleItems
        ).map((line: any, index: number) => ({
          ...saleItems[index],
          ...line,
          offlineRefundedQuantity:
            saleItemMeta[index]?.offlineRefundedQuantity || 0,
        }));

        for (const line of stockLines) {
          if (!line.product_id) continue;

          const { data: product, error: productError } = await (supabase as any)
            .from("products")
            .select("id, stock, stock_quantity, name")
            .eq("id", line.product_id)
            .eq("tenant_id", sale.tenant_id)
            .maybeSingle();

          if (productError) throw productError;
          if (!product) continue;

          const currentStock = Number(
            product.stock ?? product.stock_quantity ?? 0,
          );
          const newStock = currentStock - Number(line.quantity || 0);

          const { error: stockError } = await (supabase as any)
            .from("products")
            .update({
              stock: newStock,
              stock_quantity: newStock,
              status: newStock <= 0 ? "out_of_stock" : "active",
            })
            .eq("id", line.product_id)
            .eq("tenant_id", sale.tenant_id);

          if (stockError) throw stockError;

          await decrementBatchQuantity(
            line.batch_id || null,
            sale.tenant_id,
            Number(line.quantity || 0),
          );

          const { error: movementError } = await (supabase as any)
            .from("stock_movements")
            .insert({
              tenant_id: sale.tenant_id,
              user_id: sale.user_id,
              product_id: line.product_id,
              product_name: line.product_name,
              movement_type: "sale",
              quantity_change: -Number(line.quantity || 0),
              stock_before: currentStock,
              stock_after: newStock,
              reference: sale.invoice_no,
              reference_id: sale.id,
              notes: `Synced offline sale receipt ${sale.receipt_no || sale.invoice_no}`,
              created_at: new Date().toISOString(),
            });

          if (movementError) throw movementError;
        }

        if (!separateQueuedOperationWillReplayRefund) {
          const embeddedRefundLines = stockLines.filter(
            (line: any) =>
              asNumber(line.offlineRefundedQuantity) > 0 && line.product_id,
          );

          if (embeddedRefundLines.length > 0) {
            const refundNo =
              item.refund_no || `RF-${Date.now().toString().slice(-8)}`;
            let refundTotal = 0;

            const { data: refund, error: refundError } = await (supabase as any)
              .from("sale_refunds")
              .insert({
                tenant_id: sale.tenant_id,
                sale_id: sale.id,
                refund_no: refundNo,
                refund_type: embeddedRefundLines.every(
                  (line: any) =>
                    asNumber(line.offlineRefundedQuantity) >=
                    asNumber(line.quantity),
                )
                  ? "full"
                  : "partial",
                refund_total: 0,
                reason:
                  item.refund_reason ||
                  item.reason ||
                  "Offline refund synced with sale",
                status: "completed",
                user_id: sale.user_id || item.user_id || null,
                created_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (refundError) throw refundError;

            const refundRows: any[] = [];

            for (const line of embeddedRefundLines) {
              const quantity = Math.min(
                asNumber(line.quantity),
                asNumber(line.offlineRefundedQuantity),
              );
              const unitPrice = asNumber(line.unit_price);
              const unitCost = asNumber(line.unit_cost);
              const total = unitPrice * quantity;
              refundTotal += total;

              await restoreSingleProductStock({
                tenantId: sale.tenant_id,
                userId: sale.user_id || item.user_id || null,
                saleId: sale.id,
                saleItemId: line.id || null,
                productId: line.product_id,
                productName: line.product_name,
                batchId: line.batch_id,
                quantity,
                reason: "refund",
              });

              refundRows.push({
                tenant_id: sale.tenant_id,
                refund_id: refund.id,
                sale_id: sale.id,
                sale_item_id: line.id,
                product_id: line.product_id,
                product_name: line.product_name,
                quantity,
                unit_price: unitPrice,
                unit_cost: unitCost,
                total,
                batch_id: line.batch_id,
                created_at: new Date().toISOString(),
              });
            }

            if (refundRows.length > 0) {
              const { error: refundItemsError } = await (supabase as any)
                .from("sale_refund_items")
                .insert(refundRows);
              if (refundItemsError) throw refundItemsError;
            }

            const { error: refundTotalError } = await (supabase as any)
              .from("sale_refunds")
              .update({ refund_total: refundTotal })
              .eq("id", refund.id)
              .eq("tenant_id", sale.tenant_id);

            if (refundTotalError) throw refundTotalError;
            await recalculateSaleAfterRefund(sale.id, sale.tenant_id);
          }
        }
      }

      await clearPendingSaleRecord(item);
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `Sale "${item.receipt_no || item.invoice_no || item.id}": ${
          error?.message || "sync failed"
        }`,
      );
    }
  }
}

async function syncStockMovements(result: SyncResult) {
  const items = await getPendingStockMovements();

  for (const item of items) {
    try {
      if (item.movement_type === "sale") {
        await clearPendingAndCached(
          "stock_movements",
          item,
          clearPendingStockMovement,
        );
        continue;
      }

      const payload = sanitizeStockMovementPayload(item);

      if (!payload.tenant_id) {
        await clearPendingAndCached(
          "stock_movements",
          item,
          clearPendingStockMovement,
        );
        continue;
      }

      let productId = payload.product_id;
      if (productId && isOfflineProductId(productId)) {
        const product = await findExistingProduct({
          tenant_id: payload.tenant_id,
          sku: item.sku,
          barcode: item.barcode,
          name: payload.product_name,
        });
        productId = product?.id || null;
      }

      if (item.batch_payload) {
        const batchPayload = sanitizeBatchPayload({
          ...item.batch_payload,
          product_id: productId || item.batch_payload.product_id,
        });

        if (
          batchPayload.tenant_id &&
          batchPayload.product_id &&
          asNumber(batchPayload.quantity_in) > 0
        ) {
          const { error: batchError } = await (supabase as any)
            .from("stock_batches")
            .insert(batchPayload);
          if (batchError) throw batchError;
        }
      }

      if (!productId) {
        await clearPendingAndCached(
          "stock_movements",
          item,
          clearPendingStockMovement,
        );
        continue;
      }

      const referenceId = payload.reference_id || payload.id || item.offline_id;
      const reference = payload.reference || "Offline stock movement";

      const { data: existingMovement, error: findError } = await (
        supabase as any
      )
        .from("stock_movements")
        .select("id")
        .eq("tenant_id", payload.tenant_id)
        .eq("reference", reference)
        .eq("reference_id", referenceId)
        .maybeSingle();

      if (findError) throw findError;

      if (!existingMovement?.id) {
        const movementPayload = removeUndefinedFields({
          ...payload,
          product_id: productId,
          reference,
          reference_id: referenceId,
          created_at: payload.created_at || new Date().toISOString(),
        });

        if (isOfflineId(movementPayload.id)) delete movementPayload.id;

        const { error } = await (supabase as any)
          .from("stock_movements")
          .insert(movementPayload);
        if (error) throw error;
      }

      await clearPendingAndCached(
        "stock_movements",
        item,
        clearPendingStockMovement,
      );
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `Stock movement "${item.product_name || item.reference || item.id}": ${error?.message || "sync failed"}`,
      );
    }
  }
}

async function syncStockAdjustments(result: SyncResult) {
  // Backward compatibility only:
  // Old local builds may have queued "stock_adjustments", but the real online source of truth is stock_movements.
  // This function converts any old adjustment queue into stock_movements and then clears the old queue.
  const items = await getPending("stock_adjustments");

  if (!items.length) return;

  for (const item of items) {
    try {
      const payload = sanitizeStockMovementPayload(item);
      let productId = payload.product_id;

      if (productId && isOfflineProductId(productId)) {
        const product = await findExistingProduct({
          tenant_id: payload.tenant_id,
          sku: item.sku,
          barcode: item.barcode,
          name: payload.product_name,
        });
        productId = product?.id || null;
      }

      if (!payload.tenant_id || !productId) {
        await clearPendingAndCached("stock_adjustments", item);
        continue;
      }

      const quantityChange = asNumber(
        payload.quantity_change ??
          item.adjustment_quantity ??
          item.quantity ??
          item.difference ??
          0,
      );

      const productStock = await applyProductStockDelta({
        tenantId: payload.tenant_id,
        productId,
        quantityChange,
      });

      const movementPayload = removeUndefinedFields({
        tenant_id: payload.tenant_id,
        user_id: payload.user_id || null,
        product_id: productId,
        product_name: payload.product_name || "Product",
        movement_type: "adjustment",
        quantity_change: quantityChange,
        stock_before: payload.stock_before ?? productStock?.currentStock ?? 0,
        stock_after:
          payload.stock_after ??
          productStock?.nextStock ??
          Math.max(0, quantityChange),
        reference:
          payload.reference || item.adjustment_no || "Offline adjustment",
        reference_id: !isOfflineId(payload.reference_id)
          ? payload.reference_id || null
          : null,
        notes:
          payload.reason || payload.notes || "Offline stock adjustment synced",
        created_at: payload.created_at || new Date().toISOString(),
      });

      const { error: movementError } = await (supabase as any)
        .from("stock_movements")
        .insert(movementPayload);

      if (movementError) throw movementError;

      await clearPendingAndCached("stock_adjustments", item);
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      if (isMissingRelationError(error)) {
        await clearPendingAndCached("stock_adjustments", item);
        continue;
      }
      result.failed += 1;
      result.errors.push(
        `Stock adjustment "${item.product_name || item.reference || item.id}": ${
          error?.message || "sync failed"
        }`,
      );
    }
  }
}

async function syncWorkspaceMessages(result: SyncResult) {
  const items = await getPending("workspace_messages");
  for (const item of items) {
    try {
      const payload = sanitizeGenericPayload(item);
      if (!payload.workspace_id || !payload.user_id) {
        await clearPendingAndCached("workspace_messages", item);
        continue;
      }
      if (String(payload.attachment_url || "").startsWith("offline://"))
        payload.attachment_url = null;
      await syncRecord(
        "workspace_messages",
        { ...item, ...payload },
        (offlineId) => clearPending("workspace_messages", offlineId),
      );
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `Workspace message "${item.message || item.attachment_name || item.id}": ${error?.message || "sync failed"}`,
      );
    }
  }
}

async function syncWorkspaceMembers(result: SyncResult) {
  await syncGenericPendingTable(
    result,
    "workspace_members",
    "Workspace member",
    ["email", "user_id", "role"],
  );
}

async function syncBranches(result: SyncResult) {
  await syncGenericPendingTable(result, "branches", "Branch", ["name", "code"]);
}

async function syncWarehouses(result: SyncResult) {
  await syncGenericPendingTable(result, "warehouses", "Warehouse", [
    "name",
    "code",
  ]);
}

async function syncTransfers(result: SyncResult) {
  await syncGenericPendingTable(result, "transfers", "Transfer", [
    "transfer_no",
    "product_name",
    "reference",
  ]);
}

async function syncStockCounts(result: SyncResult) {
  await syncGenericPendingTable(result, "stock_counts", "Stock count", [
    "count_no",
    "product_name",
    "sku",
  ]);
}

async function syncQuotations(result: SyncResult) {
  await syncGenericPendingTable(result, "quotations", "Quotation", [
    "quotation_no",
    "customer_name",
  ]);
}

async function syncLoyalty(result: SyncResult) {
  await syncGenericPendingTable(result, "loyalty", "Loyalty record", [
    "customer_name",
    "customer_id",
    "tier",
  ]);
}

async function syncLoyaltyMembers(result: SyncResult) {
  await syncGenericPendingTable(result, "loyalty_members", "Loyalty member", [
    "customer_name",
    "customer_id",
    "tier",
  ]);
}

async function syncStaff(result: SyncResult) {
  await syncGenericPendingTable(result, "staff", "Staff record", [
    "name",
    "full_name",
    "email",
    "phone",
  ]);
}

async function syncEBMSettings(result: SyncResult) {
  const items = await getPending("ebm_settings");

  for (const item of items) {
    try {
      const payload = sanitizeGenericPayload(item);
      if (!payload.tenant_id) {
        await clearPendingAndCached("ebm_settings", item);
        continue;
      }

      const { data: existing, error: findError } = await (supabase as any)
        .from("ebm_settings")
        .select("id")
        .eq("tenant_id", payload.tenant_id)
        .maybeSingle();

      if (findError) throw findError;

      if (existing?.id) {
        const updatePayload = { ...payload };
        delete updatePayload.id;

        const { error } = await (supabase as any)
          .from("ebm_settings")
          .update(updatePayload)
          .eq("id", existing.id)
          .eq("tenant_id", payload.tenant_id);

        if (error) throw error;
      } else {
        if (isOfflineId(payload.id)) delete payload.id;

        const { error } = await (supabase as any)
          .from("ebm_settings")
          .insert(payload);

        if (error) throw error;
      }

      await clearPendingAndCached("ebm_settings", item);
      result.synced += 1;
    } catch (error: any) {
      if (isNetworkError(error)) throw error;
      result.failed += 1;
      result.errors.push(
        `EBM settings "${item.tin || item.provider || item.id}": ${error?.message || "sync failed"}`,
      );
    }
  }
}

async function syncWorkspaceMeetings(result: SyncResult) {
  await syncGenericPendingTable(
    result,
    "workspace_meetings",
    "Workspace meeting",
    ["title", "status", "invite_code"],
  );
}

async function syncWorkspaceChannels(result: SyncResult) {
  await syncGenericPendingTable(
    result,
    "workspace_channels",
    "Workspace channel",
    ["name", "title"],
  );
}

async function syncWorkspaceTasks(result: SyncResult) {
  await syncGenericPendingTable(result, "workspace_tasks", "Workspace task", [
    "title",
    "status",
  ]);
}

async function syncWorkspacePolls(result: SyncResult) {
  await syncGenericPendingTable(result, "workspace_polls", "Workspace poll", [
    "question",
    "title",
  ]);
}

async function syncWorkspaceMessageReactions(result: SyncResult) {
  await syncGenericPendingTable(
    result,
    "workspace_message_reactions",
    "Message reaction",
    ["emoji", "message_id", "user_id"],
  );
}

async function syncWorkspaceMessagePins(result: SyncResult) {
  await syncGenericPendingTable(
    result,
    "workspace_message_pins",
    "Message pin",
    ["message_id", "user_id"],
  );
}

export async function syncOfflineData(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    synced: 0,
    failed: 0,
    errors: [],
  };

  if (!isOnline()) {
    result.errors.push("You are offline or Supabase is not reachable yet.");
    return result;
  }

  if (isOfflineMode()) {
    result.errors.push(
      "Online login required before syncing. Please log out of offline mode, then log in using the normal online login tab.",
    );
    return result;
  }

  try {
    await requireOnlineSupabaseSession();
    const syncTenantId = await getSyncTenantId();

    await runSyncStep(result, "Categories", () =>
      syncGenericPendingTable(result, "categories", "Category", ["name"]),
    );
    await runSyncStep(result, "Brands", () =>
      syncGenericPendingTable(result, "brands", "Brand", ["name"]),
    );
    await runSyncStep(result, "Units", () =>
      syncGenericPendingTable(result, "units", "Unit", [
        "name",
        "abbreviation",
      ]),
    );

    await runSyncStep(result, "Products", () => syncProducts(result), true);
    await runSyncStep(result, "Stock batches", () => syncStockBatches(result));
    await runSyncStep(result, "Customers", () => syncCustomers(result));
    await runSyncStep(result, "Suppliers", () => syncSuppliers(result));
    await runSyncStep(result, "Expenses", () => syncExpenses(result));
    await runSyncStep(result, "Purchases", () => syncPurchases(result));

    await runSyncStep(result, "Sales", () => syncSales(result), true);
    await runSyncStep(result, "Queued sale operations", () =>
      syncQueuedSaleOperations(result),
    );
    await runSyncStep(result, "Stock adjustments", () =>
      syncStockAdjustments(result),
    );
    await runSyncStep(result, "Stock movements", () =>
      syncStockMovements(result),
    );

    await runSyncStep(result, "Branches", () => syncBranches(result));
    await runSyncStep(result, "Warehouses", () => syncWarehouses(result));
    await runSyncStep(result, "Transfers", () => syncTransfers(result));
    await runSyncStep(result, "Stock counts", () => syncStockCounts(result));
    await runSyncStep(result, "Quotations", () => syncQuotations(result));
    await runSyncStep(result, "Loyalty", () => syncLoyalty(result));
    await runSyncStep(result, "Loyalty members", () =>
      syncLoyaltyMembers(result),
    );
    await runSyncStep(result, "Staff", () => syncStaff(result));
    await runSyncStep(result, "EBM settings", () => syncEBMSettings(result));

    await runSyncStep(result, "Workspace members", () =>
      syncWorkspaceMembers(result),
    );
    await runSyncStep(result, "Workspace messages", () =>
      syncWorkspaceMessages(result),
    );
    await runSyncStep(result, "Workspace meetings", () =>
      syncWorkspaceMeetings(result),
    );
    await runSyncStep(result, "Workspace channels", () =>
      syncWorkspaceChannels(result),
    );
    await runSyncStep(result, "Workspace tasks", () =>
      syncWorkspaceTasks(result),
    );
    await runSyncStep(result, "Workspace polls", () =>
      syncWorkspacePolls(result),
    );
    await runSyncStep(result, "Workspace reactions", () =>
      syncWorkspaceMessageReactions(result),
    );
    await runSyncStep(result, "Workspace pins", () =>
      syncWorkspaceMessagePins(result),
    );

    await runSyncStep(result, "Refresh online caches", () =>
      refreshOnlineCaches(syncTenantId),
    );

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("shopcore-offline-sync-complete", { detail: result }),
      );
    }

    result.success = result.failed === 0;
    return result;
  } catch (error: any) {
    result.success = false;
    result.failed += 1;
    result.errors.push(error?.message || "Sync failed");
    return result;
  }
}

export async function hasPendingOfflineData() {
  const summary = await getOfflineSummary();
  return summary.total > 0;
}

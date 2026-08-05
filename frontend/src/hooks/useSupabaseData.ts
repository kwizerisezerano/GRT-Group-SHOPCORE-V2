import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brandsApi, categoriesApi, productsApi } from "@/lib/apiClient";
import { useApiMutations, useApiTable } from "@/hooks/useApiData";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCachedProducts,
  getCachedTable,
  getPending,
  isNetworkError,
  isOnline,
  saveCachedTable,
  saveOfflineCustomer,
  saveOfflineExpense,
  saveOfflinePurchase,
  saveOfflineSale,
  saveOfflineSupplier,
  savePending,
  removeCachedRecord,
  patchCachedProductStock,
  upsertCachedRecord,
  clearPending,
  markCachedRecordDeleted,
  saveOfflineSyncError,
  getOfflineSyncErrors,
  getEnterpriseOfflineSummary,
  repairOfflineSyncQueues,
} from "@/lib/offlineStore";
import { toast } from "sonner";
import { isOfflineMode } from "@/lib/offlineAuth";

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

const OFFLINE_OPERATION_TIMEOUT_MS = 10000;
const SUPABASE_OPERATION_TIMEOUT_MS = 18000;
const SCHEMA_BLOCKED_TABLES_KEY = "shopcore_schema_blocked_tables";
const SCHEMA_BLOCK_TTL_MS = 1000 * 60 * 60 * 6;

function withOfflineTimeout<T>(
  promise: Promise<T>,
  message = "Offline operation timeout",
  timeoutMs = OFFLINE_OPERATION_TIMEOUT_MS
): Promise<T> {
  let timeoutId: number | undefined;

  return Promise.race([
    promise.finally(() => {
      if (timeoutId !== undefined && typeof window !== "undefined") {
        window.clearTimeout(timeoutId);
      }
    }),
    new Promise<T>((_, reject) => {
      if (typeof window === "undefined") return;
      timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}


function bumpLocalDataVersion() {
  try {
    localStorage.setItem("shopcore_local_data_version", String(Date.now()));
  } catch {
    // ignore localStorage write failures
  }
}

export interface DbProduct {
  id: string;
  user_id: string | null;
  tenant_id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: string | null;
  category_name?: string | null;
  brand: string | null;
  unit: string | null;
  cost_price: number;
  selling_price: number;
  stock: number;
  stock_quantity?: number | null;
  min_stock: number | null;
  min_stock_level?: number | null;
  max_stock?: number | null;
  tax_rate?: number | null;
  image_url: string | null;
  image?: string | null;
  description: string | null;
  status: string;
  supplier_id?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  expiry_date?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at: string | null;
}

export interface DbSale {
  id: string;
  user_id: string;
  tenant_id: string;
  invoice_no: string;
  receipt_no?: string | null;
  customer_name: string;
  items: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  due: number;
  payment_method: string;
  status: string;
  branch: string;
  cashier: string;
  date: string;
  notes: string | null;
  momo_number?: string | null;
  momo_code?: string | null;
  ebm_status?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_offline_at?: string;
  updated_offline_at?: string;
  customer_phone?: string | null;
  customer_tin?: string | null;
  tin_number?: string | null;
  cost_total?: number | null;
  cogs_total?: number | null;
  gross_profit?: number | null;
  profit?: number | null;
  net_profit?: number | null;
  refunded_at?: string | null;
  cancelled_at?: string | null;
  refund_reason?: string | null;
  cancellation_reason?: string | null;
  line_items?: any[];
  sale_items?: any[];
  items_data?: any[];
  partial_refund_items?: any[];
  restore_stock_on_sync?: boolean;
  restore_reason?: string;
  created_at: string;
}

export interface DbCustomer {
  id: string;
  user_id: string;
  tenant_id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  customer_group: string;
  total_purchases: number;
  total_spent: number;
  outstanding_balance: number;
  credit_limit: number;
  loyalty_points: number;
  loyalty_tier: string;
  status: string;
  address: string;
  city: string;
  join_date: string;
  last_purchase: string | null;
  notes: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
}

export interface DbExpense {
  id: string;
  user_id: string;
  tenant_id: string;
  reference: string;
  title: string;
  category: string;
  amount: number;
  branch: string;
  paid_to: string;
  payment_method: string;
  status: string;
  is_recurring: boolean;
  date: string;
  approved_by: string | null;
  notes: string | null;
  attachments: number;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
}

export interface DbSupplier {
  id: string;
  user_id: string;
  tenant_id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  tax_number: string | null;
  payment_terms: string;
  status: string;
  notes: string | null;
  total_purchases: number;
  outstanding_balance: number;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at: string | null;
}

export interface DbPurchase {
  id: string;
  user_id: string;
  tenant_id: string;
  purchase_no: string;
  supplier_id: string | null;
  supplier_name: string | null;
  status: string;
  date: string;
  expected_delivery: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  shipping: number;
  total: number;
  paid: number;
  due: number;
  payment_method: string;
  branch: string;
  notes: string | null;
  items_count: number;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at: string | null;
}

export interface DbPurchaseItem {
  id: string;
  user_id: string;
  tenant_id: string;
  purchase_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  total: number;
  received_qty: number;
  created_at: string;
}

export interface DbStockBatch {
  id: string;
  tenant_id: string;
  product_id: string;
  batch_no: string | null;
  source_type: string | null;
  source_id: string | null;
  quantity_in: number;
  quantity_remaining: number;
  cost_price: number;
  selling_price: number;
  status: string;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
}

export interface DbSaleRefund {
  id: string;
  tenant_id: string;
  sale_id: string;
  refund_no: string;
  refund_type: string;
  refund_total: number;
  reason: string | null;
  status: string;
  user_id: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
}

export interface DbSaleRefundItem {
  id: string;
  tenant_id: string;
  refund_id: string;
  sale_id: string;
  sale_item_id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total: number;
  batch_id: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
}

export interface DbEBMSettings {
  id: string;
  user_id: string;
  tenant_id: string;
  tin: string | null;
  provider: string | null;
  api_base_url: string | null;
  environment: string | null;
  username: string | null;
  password_secret: string | null;
  device_id: string | null;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

type AuthUser = { id: string } | null;

function requireCtx(user: AuthUser, tenantId: string | null) {
  if (!user) throw new Error("Not signed in");
  if (!tenantId) throw new Error("No active workspace — please refresh");
  return { user_id: user.id, tenant_id: tenantId };
}

function getOfflineModeSafe() {
  try {
    return isOfflineMode();
  } catch {
    return false;
  }
}

function hasOnlineSession(session: any) {
  return isOnline() && !getOfflineModeSafe() && !!session?.access_token;
}

function shouldUseOnlineQuery(session: any) {
  return hasOnlineSession(session);
}

function queryModeKey(session: any) {
  return shouldUseOnlineQuery(session) ? "online" : "cached";
}

function localDataVersionKey() {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem("shopcore_local_data_version") || "0"
      : "0";
  } catch {
    return "0";
  }
}

function queryIsOnline(session: any) {
  return shouldUseOnlineQuery(session);
}

const LOCAL_ONLY_UNTIL_SCHEMA_READY = new Set([
  "stock_adjustments",
  "loyalty",
  "loyalty_members",
  "workspace_tasks",
  "workspace_polls",
  "workspace_message_pins",
]);

function readSchemaBlockedTables(): Record<string, { until: number; message: string }> {
  try {
    return JSON.parse(localStorage.getItem(SCHEMA_BLOCKED_TABLES_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeSchemaBlockedTables(map: Record<string, { until: number; message: string }>) {
  try {
    localStorage.setItem(SCHEMA_BLOCKED_TABLES_KEY, JSON.stringify(map));
  } catch {
    // localStorage can be unavailable; continue with normal query behavior.
  }
}

function isSchemaOrPolicyError(error: unknown) {
  const e = error as any;
  const code = String(e?.code || "");
  const message = String(e?.message || e?.details || e?.hint || error || "").toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    code === "42501" ||
    message.includes("could not find") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("permission denied") ||
    message.includes("violates row-level security") ||
    message.includes("rls")
  );
}

function markTableSchemaBlocked(table: string, error: unknown) {
  if (!isSchemaOrPolicyError(error)) return;

  const e = error as any;
  const map = readSchemaBlockedTables();
  map[table] = {
    until: Date.now() + SCHEMA_BLOCK_TTL_MS,
    message: e?.message || e?.details || "Table/schema is not ready for online access.",
  };
  writeSchemaBlockedTables(map);
}

function isTableTemporarilyBlocked(table: string) {
  const map = readSchemaBlockedTables();
  const row = map[table];
  if (!row) return false;

  if (row.until <= Date.now()) {
    delete map[table];
    writeSchemaBlockedTables(map);
    return false;
  }

  return true;
}

function shouldQueryOnlineTable(table: string, session: any) {
  return (
    shouldUseOnlineQuery(session) &&
    !LOCAL_ONLY_UNTIL_SCHEMA_READY.has(table) &&
    !isTableTemporarilyBlocked(table)
  );
}

function recordOfflineDiagnostic(table: string, operation: string, error: unknown, payload?: any) {
  const e = error as any;
  saveOfflineSyncError({
    table,
    source: `useSupabaseData:${operation}`,
    message: e?.message || e?.details || e?.hint || String(error || "Operation failed"),
    record: {
      ...(payload || {}),
      sync_operation: operation,
    },
  }).catch(() => undefined);
}

function handleError(error: unknown) {
  const e = error as any;
  console.error("Supabase operation failed full error:", e);

  if (shouldSaveOffline(error)) {
    toast.error("Network is not ready. Your change was kept locally and will sync later.");
    return;
  }

  if (isSchemaOrPolicyError(error)) {
    toast.error("This module needs a database/RLS update. Your screen can continue from cache where available.");
    return;
  }

  toast.error(e?.message || e?.details || e?.hint || "Something went wrong");
}

function notifyLocalDataChanged() {
  bumpLocalDataVersion();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
  }
}

function invalidateBusinessQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["products"], exact: false });
  qc.invalidateQueries({ queryKey: ["sales"], exact: false });
  qc.invalidateQueries({ queryKey: ["sale_items"], exact: false });
  qc.invalidateQueries({ queryKey: ["stock_movements"], exact: false });
  qc.invalidateQueries({ queryKey: ["stock_batches"], exact: false });
  qc.invalidateQueries({ queryKey: ["sale_refunds"], exact: false });
  qc.invalidateQueries({ queryKey: ["sale_refund_items"], exact: false });
  qc.invalidateQueries({ queryKey: ["purchases"], exact: false });
  qc.invalidateQueries({ queryKey: ["expenses"], exact: false });
  qc.invalidateQueries({ queryKey: ["customers"], exact: false });
  qc.invalidateQueries({ queryKey: ["suppliers"], exact: false });
  qc.invalidateQueries({ queryKey: ["dashboard"], exact: false });
  qc.invalidateQueries({ queryKey: ["stock_adjustments"], exact: false });
  qc.invalidateQueries({ queryKey: ["purchase_items"], exact: false });
  qc.invalidateQueries({ queryKey: ["categories"], exact: false });
  qc.invalidateQueries({ queryKey: ["brands"], exact: false });
  qc.invalidateQueries({ queryKey: ["units"], exact: false });
  qc.invalidateQueries({ queryKey: ["transfers"], exact: false });
  qc.invalidateQueries({ queryKey: ["stock_counts"], exact: false });
  qc.invalidateQueries({ queryKey: ["quotations"], exact: false });
  qc.invalidateQueries({ queryKey: ["loyalty"], exact: false });
  qc.invalidateQueries({ queryKey: ["loyalty_members"], exact: false });
  qc.invalidateQueries({ queryKey: ["staff"], exact: false });
  qc.invalidateQueries({ queryKey: ["branches"], exact: false });
  qc.invalidateQueries({ queryKey: ["warehouses"], exact: false });
  qc.invalidateQueries({ queryKey: ["workspace_messages"], exact: false });
  qc.invalidateQueries({ queryKey: ["workspace_meetings"], exact: false });
  qc.invalidateQueries({ queryKey: ["reports"], exact: false });
  notifyLocalDataChanged();
}

function shouldSaveOffline(error: unknown) {
  return !isOnline() || getOfflineModeSafe() || isNetworkError(error);
}

function shouldFallbackToCache(error: unknown) {
  return shouldSaveOffline(error) || isSchemaOrPolicyError(error);
}

function sortByCreatedAtDesc(records: any[]) {
  return [...(records || [])].sort((a, b) => {
    const aDate = new Date(a?.created_at || a?.date || a?.created_offline_at || a?.updated_offline_at || 0).getTime();
    const bDate = new Date(b?.created_at || b?.date || b?.created_offline_at || b?.updated_offline_at || 0).getTime();
    return bDate - aDate;
  });
}

function recordKey(record: any) {
  return String(
    record?.id ||
      record?.offline_id ||
      record?.invoice_no ||
      record?.purchase_no ||
      record?.reference ||
      record?.code ||
      record?.sku ||
      ""
  );
}

function dedupeRecords(records: any[]) {
  const map = new Map<string, any>();

  for (const record of records || []) {
    const key = recordKey(record);

    if (!key) {
      map.set(`unknown-${map.size}`, record);
      continue;
    }

    if (!map.has(key)) {
      map.set(key, record);
      continue;
    }

    const existing = map.get(key);
    const existingTime = new Date(existing?.updated_offline_at || existing?.updated_at || existing?.created_at || 0).getTime();
    const nextTime = new Date(record?.updated_offline_at || record?.updated_at || record?.created_at || 0).getTime();

    if (nextTime >= existingTime) map.set(key, record);
  }

  return Array.from(map.values());
}

function stripDeleted(records: any[]) {
  return (records || []).filter((record) => record?.operation !== "delete");
}

function isOfflineDirtyRecord(record: any) {
  if (!record) return false;

  const id = String(record.id || record.offline_id || "");
  const syncStatus = String(record.sync_status || "").toLowerCase();
  const operation = String(record.operation || "").toLowerCase();

  return (
    id.startsWith("offline-") ||
    syncStatus.includes("pending") ||
    ["create", "update", "delete"].includes(operation) ||
    Boolean(record.updated_offline_at) ||
    Boolean(record.created_offline_at) ||
    Boolean(record.restore_stock_on_sync) ||
    Boolean(record.partial_refund_on_sync) ||
    Boolean(record.credit_paid_on_sync)
  );
}

function getOfflineDirtyRecords(records: any[]) {
  return (records || []).filter(isOfflineDirtyRecord);
}


async function getCachedSortedTable<T>(table: string) {
  const [cached, pending] = await Promise.all([
    withOfflineTimeout<any[]>(getCachedTable(table) as Promise<any[]>, `Reading cached ${table} timed out`).catch(() => [] as any[]),
    withOfflineTimeout<any[]>(getPending(table) as Promise<any[]>, `Reading pending ${table} timed out`).catch(() => [] as any[]),
  ]);

  return sortByCreatedAtDesc(stripDeleted(dedupeRecords([...(cached || []), ...(pending || [])]))) as T[];
}

async function getCachedProductsWithPending() {
  const [cached, pending] = await Promise.all([
    withOfflineTimeout<any[]>(getCachedProducts() as Promise<any[]>, "Reading cached products timed out").catch(() => [] as any[]),
    withOfflineTimeout<any[]>(getPending("products") as Promise<any[]>, "Reading pending products timed out").catch(() => [] as any[]),
  ]);

  return normalizeProducts(sortByCreatedAtDesc(stripDeleted(dedupeRecords([...(cached || []), ...(pending || [])]))));
}


async function mergeOnlineTableWithPending<T>(table: string, onlineRecords: any[]) {
  const [pending, cached] = await Promise.all([
    getPending(table).catch(() => []),
    getCachedTable(table).catch(() => []),
  ]);

  const dirtyCached = getOfflineDirtyRecords(cached || []).filter(
    (item: any) => String(item?.sync_status || "").toLowerCase().includes("pending")
  );

  return sortByCreatedAtDesc(
    stripDeleted(dedupeRecords([...(pending || []), ...dirtyCached, ...(onlineRecords || [])]))
  ) as T[];
}


function normalizeProduct(p: any): DbProduct {
  const source = p || {};
  const {
    price,
    purchase_price,
    unit_cost,
    sync_error,
    last_sync_error,
    ...product
  } = source;

  const stock = Math.max(0, Number(product.stock ?? product.stock_quantity ?? 0));
  const minStock = Number(product.min_stock ?? product.min_stock_level ?? 0);

  return {
    ...product,
    user_id: product.user_id ?? null,
    category: product.category ?? product.category_name ?? null,
    brand: product.brand ?? null,
    unit: product.unit ?? "pcs",
    stock,
    stock_quantity: stock,
    min_stock: minStock,
    min_stock_level: minStock,
    cost_price: Number(product.cost_price ?? purchase_price ?? unit_cost ?? 0),
    selling_price: Number(product.selling_price ?? price ?? 0),
    status: product.status ?? (stock <= 0 ? "out_of_stock" : "active"),
    image_url: product.image_url ?? product.image ?? null,
    description: product.description ?? null,
    created_at: product.created_at || new Date().toISOString(),
    updated_at: product.updated_at ?? null,
  } as DbProduct;
}

function normalizeProducts(data: any[]): DbProduct[] {
  return (data || []).map(normalizeProduct);
}

function cleanProductRecord(record: any) {
  return normalizeProduct(record || {});
}

function cleanStockMovementRecord(record: any) {
  const clean = { ...(record || {}) };

  delete clean.selling_price;
  delete clean.unit_cost;
  delete clean.price;
  delete clean.purchase_price;
  delete clean.batch_no;
  delete clean.sku;
  delete clean.barcode;

  if (String(clean.movement_type || "") === "adjustment_in") clean.movement_type = "adjustment";
  if (String(clean.movement_type || "") === "adjustment_out") clean.movement_type = "adjustment";

  return clean;
}

function cleanTableRecord(table: string, record: any) {
  if (table === "products") return cleanProductRecord(record);
  if (table === "stock_movements") return cleanStockMovementRecord(record);
  return record;
}

function cleanTablePayload(table: string, payload: any) {
  const clean = cleanTableRecord(table, payload || {});
  Object.keys(clean || {}).forEach((key) => {
    if (clean[key] === undefined) delete clean[key];
  });
  return clean;
}

function validateOfflinePayload(table: string, payload: any) {
  const cleanTable = String(table || "").trim();

  if (cleanTable === "products") {
    if (!String(payload?.name || "").trim()) return "Product name is required before saving offline.";
    if (!String(payload?.sku || "").trim()) return "Product SKU is required before saving offline.";
  }

  if (["customers", "suppliers", "categories", "brands", "units", "branches", "warehouses", "staff"].includes(cleanTable)) {
    const hasName = String(payload?.name || payload?.full_name || payload?.code || payload?.email || payload?.phone || "").trim();
    if (!hasName) return `${cleanTable.replace(/_/g, " ")} needs a name, code, email, or phone before saving offline.`;
  }

  if (["sales", "purchases"].includes(cleanTable) && !payload?.tenant_id) {
    return `${cleanTable.replace(/_/g, " ")} cannot be saved offline without workspace context.`;
  }

  return null;
}

async function safeSavePending(table: string, payload: any) {
  const validationError = validateOfflinePayload(table, payload);
  if (validationError) {
    await recordOfflineDiagnostic(table, "validation", new Error(validationError), payload);
    throw new Error(validationError);
  }
  return savePending(table, cleanTablePayload(table, payload));
}

async function cacheTableRecord(table: string, record: any) {
  await withOfflineTimeout(upsertCachedRecord(table, cleanTableRecord(table, record)), `Caching ${table} record timed out`);
}

async function updateCachedTableRecord(table: string, id: string, patch: any) {
  const cached = await withOfflineTimeout<any[]>(getCachedTable(table) as Promise<any[]>, `Reading cached ${table} timed out`).catch(() => [] as any[]);
  const current = cached.find((item: any) => String(item.id) === String(id)) || {};
  const updated = {
    ...current,
    ...patch,
    id,
    updated_at: patch.updated_at || current.updated_at || new Date().toISOString(),
    updated_offline_at: new Date().toISOString(),
  };

  const cleanUpdated = cleanTableRecord(table, updated);
  await withOfflineTimeout(upsertCachedRecord(table, cleanUpdated), `Updating cached ${table} timed out`);
  return cleanUpdated;
}

async function removeCachedTableRecord(table: string, id: string) {
  await withOfflineTimeout(removeCachedRecord(table, id), `Removing cached ${table} timed out`);
}

async function queueTableDelete(table: string, id: string, ctx: { user_id: string; tenant_id: string }) {
  if (String(id).startsWith("offline-")) {
    await withOfflineTimeout(clearPending(table, id), `Clearing pending ${table} delete timed out`).catch(() => undefined);
    await removeCachedTableRecord(table, id);
    return { id, sync_status: "removed", operation: "delete" };
  }

  const deleted = await withOfflineTimeout(
    markCachedRecordDeleted(table, id, ctx),
    `Queueing ${table} delete timed out`
  ).catch(async () => {
    await removeCachedTableRecord(table, id);
    return await safeSavePending(table, {
      id,
      ...ctx,
      operation: "delete",
      sync_status: "pending_delete",
      status: "deleted",
      updated_offline_at: new Date().toISOString(),
    });
  });

  return deleted || { id, sync_status: "pending_delete", operation: "delete" };
}





if (typeof window !== "undefined") {
  window.addEventListener("shopcore-offline-sync-complete", () => {
    try {
      localStorage.setItem("shopcore_last_sync_refresh", String(Date.now()));
    } catch {
      // Storage can be unavailable in private browsing or restricted webviews.
    }
  });
}

/* PRODUCTS */

/*
 * Served by backend/src/modules/catalog/ rather than Supabase. The backend
 * owns the rules that used to live in the client: SKU/barcode uniqueness is
 * a database constraint returning 409 instead of a pre-flight SELECT that
 * two concurrent saves could both pass, and stock status is derived from the
 * stored quantity instead of being computed by whichever client wrote last.
 */
export function useProducts() {
  return useApiTable<DbProduct>("products", productsApi as never);
}

export function useProductMutations() {
  return useApiMutations<DbProduct>("products", productsApi as never, "Product");
}


export function useSales() {
  const { user, tenantId, session } = useAuth();
  return useQuery({
    queryKey: ["sales", tenantId, queryModeKey(session), localDataVersionKey()],
    enabled: !!user && !!tenantId,
    staleTime: queryIsOnline(session) ? 0 : 1000 * 60 * 5,
    retry: 0,
    refetchOnReconnect: queryIsOnline(session),
    refetchOnWindowFocus: queryIsOnline(session),
    networkMode: queryIsOnline(session) ? "online" : "always",
    queryFn: async () => {
      if (!hasOnlineSession(session)) return await getCachedSortedTable<DbSale>("sales");
      try {
        const { data, error } = await (supabase as any).from("sales").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        if (error) throw error;
        const merged = await mergeOnlineTableWithPending<DbSale>("sales", data || []);
        await saveCachedTable("sales", merged);
        return merged;
      } catch (error) {
        const cached = await getCachedSortedTable<DbSale>("sales");
        if (cached.length > 0 || shouldFallbackToCache(error)) return cached;
        throw error;
      }
    },
  });
}

export function useSaleMutations() {
  const qc = useQueryClient();
  const { user, tenantId, session } = useAuth();

  const create = useMutation({
    mutationFn: async (sale: Partial<DbSale>) => {
      const ctx = requireCtx(user, tenantId);
      const payload = { ...sale, ...ctx, created_at: (sale as any).created_at || new Date().toISOString() };
      const offlinePayload = { ...payload, id: (sale as any).id || makeLocalId("offline-sale"), operation: "create", status: sale.status || "pending_sync" };
      if (!hasOnlineSession(session)) {
        const saved = await saveOfflineSale(offlinePayload);
        await cacheTableRecord("sales", saved);
        return saved;
      }
      try {
        const { data, error } = await (supabase as any).from("sales").insert(payload).select().single();
        if (error) throw error;
        await cacheTableRecord("sales", data);
        return data;
      } catch (error) {
        if (shouldSaveOffline(error)) {
          const saved = await saveOfflineSale(offlinePayload);
          await cacheTableRecord("sales", saved);
          return saved;
        }
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Sale saved offline" : "Sale recorded");
    },
    onError: handleError,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...sale }: Partial<DbSale> & { id: string }) => {
      const ctx = requireCtx(user, tenantId);
      if (!hasOnlineSession(session) || String(id).startsWith("offline-sale-")) {
        const updated = await updateCachedTableRecord("sales", id, { ...sale, ...ctx, sync_status: "pending" });
        await safeSavePending("sales", { ...updated, operation: String(id).startsWith("offline-sale-") ? "create" : "update", sync_status: "pending" });
        return updated;
      }
      try {
        const onlinePayload = sanitizeSaleUpdatePayload(sale);
        const { error } = await (supabase as any).from("sales").update(onlinePayload).eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await updateCachedTableRecord("sales", id, onlinePayload);
        return { id, ...onlinePayload, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) {
          const updated = await updateCachedTableRecord("sales", id, { ...sale, ...ctx, sync_status: "pending" });
          await safeSavePending("sales", {
            ...updated,
            operation: "update",
            sync_status: "pending",
            updated_offline_at: new Date().toISOString(),
          });
          return updated;
        }
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      if (data?.sync_status === "pending") toast.success("Sale update saved offline");
    },
    onError: handleError,
  });

  return { create, update };
}

/* CUSTOMERS */

export function useCustomers() {
  const { user, tenantId, session } = useAuth();
  return useQuery({
    queryKey: ["customers", tenantId, queryModeKey(session), localDataVersionKey()],
    enabled: !!user && !!tenantId,
    staleTime: queryIsOnline(session) ? 0 : 1000 * 60 * 5,
    retry: 0,
    refetchOnReconnect: queryIsOnline(session),
    refetchOnWindowFocus: queryIsOnline(session),
    networkMode: queryIsOnline(session) ? "online" : "always",
    queryFn: async () => {
      if (!hasOnlineSession(session)) return await getCachedSortedTable<DbCustomer>("customers");
      try {
        const { data, error } = await (supabase as any).from("customers").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        if (error) throw error;
        const merged = await mergeOnlineTableWithPending<DbCustomer>("customers", data || []);
        await saveCachedTable("customers", merged);
        return merged;
      } catch (error) {
        const cached = await getCachedSortedTable<DbCustomer>("customers");
        if (cached.length > 0 || shouldFallbackToCache(error)) return cached;
        throw error;
      }
    },
  });
}

export function useCustomerMutations() {
  const qc = useQueryClient();
  const { user, tenantId, session } = useAuth();

  const create = useMutation({
    mutationFn: async (customer: Omit<DbCustomer, "id" | "user_id" | "tenant_id" | "created_at">) => {
      const ctx = requireCtx(user, tenantId);
      const payload = { ...customer, ...ctx, created_at: new Date().toISOString() };
      const offlinePayload = { ...payload, id: makeLocalId("offline-customer"), operation: "create" };
      if (!hasOnlineSession(session)) return await saveOfflineCustomer(offlinePayload);
      try {
        const { data, error } = await (supabase as any).from("customers").insert(payload).select().single();
        if (error) throw error;
        await cacheTableRecord("customers", data);
        return data;
      } catch (error) {
        if (shouldSaveOffline(error)) return await saveOfflineCustomer(offlinePayload);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Customer saved offline" : "Customer added");
    },
    onError: handleError,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...customer }: Partial<DbCustomer> & { id: string }) => {
      const ctx = requireCtx(user, tenantId);
      if (!hasOnlineSession(session) || String(id).startsWith("offline-customer-")) {
        const updated = await updateCachedTableRecord("customers", id, { ...customer, ...ctx, sync_status: "pending" });
        await safeSavePending("customers", { ...updated, operation: String(id).startsWith("offline-customer-") ? "create" : "update", sync_status: "pending" });
        return updated;
      }
      try {
        const { error } = await (supabase as any).from("customers").update(customer).eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await updateCachedTableRecord("customers", id, customer);
        return { id, ...customer, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) {
          const updated = await updateCachedTableRecord("customers", id, { ...customer, ...ctx, sync_status: "pending" });
          await safeSavePending("customers", { ...updated, operation: "update" });
          return updated;
        }
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Customer update saved offline" : "Customer updated");
    },
    onError: handleError,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const ctx = requireCtx(user, tenantId);
      if (!hasOnlineSession(session) || String(id).startsWith("offline-customer-")) return await queueTableDelete("customers", id, ctx);
      try {
        const { error } = await (supabase as any).from("customers").delete().eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await removeCachedTableRecord("customers", id);
        return { id, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) return await queueTableDelete("customers", id, ctx);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Customer removed locally" : "Customer deleted");
    },
    onError: handleError,
  });

  return { create, update, remove };
}

/* EXPENSES */

export function useExpenses() {
  const { user, tenantId, session } = useAuth();
  return useQuery({
    queryKey: ["expenses", tenantId, queryModeKey(session), localDataVersionKey()],
    enabled: !!user && !!tenantId,
    staleTime: queryIsOnline(session) ? 0 : 1000 * 60 * 5,
    retry: 0,
    refetchOnReconnect: queryIsOnline(session),
    refetchOnWindowFocus: queryIsOnline(session),
    networkMode: queryIsOnline(session) ? "online" : "always",
    queryFn: async () => {
      if (!hasOnlineSession(session)) return await getCachedSortedTable<DbExpense>("expenses");
      try {
        const { data, error } = await (supabase as any).from("expenses").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        if (error) throw error;
        const merged = await mergeOnlineTableWithPending<DbExpense>("expenses", data || []);
        await saveCachedTable("expenses", merged);
        return merged;
      } catch (error) {
        const cached = await getCachedSortedTable<DbExpense>("expenses");
        if (cached.length > 0 || shouldFallbackToCache(error)) return cached;
        throw error;
      }
    },
  });
}

export function useExpenseMutations() {
  const qc = useQueryClient();
  const { user, tenantId, session } = useAuth();

  const create = useMutation({
    mutationFn: async (expense: Omit<DbExpense, "id" | "user_id" | "tenant_id" | "created_at">) => {
      const ctx = requireCtx(user, tenantId);
      const payload = { ...expense, ...ctx, created_at: new Date().toISOString() };
      const offlinePayload = { ...payload, id: makeLocalId("offline-expense"), operation: "create" };
      if (!hasOnlineSession(session)) return await saveOfflineExpense(offlinePayload);
      try {
        const { data, error } = await (supabase as any).from("expenses").insert(payload).select().single();
        if (error) throw error;
        await cacheTableRecord("expenses", data);
        return data;
      } catch (error) {
        if (shouldSaveOffline(error)) return await saveOfflineExpense(offlinePayload);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Expense saved offline" : "Expense recorded");
    },
    onError: handleError,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...expense }: Partial<DbExpense> & { id: string }) => {
      const ctx = requireCtx(user, tenantId);
      if (!hasOnlineSession(session) || String(id).startsWith("offline-expense-")) {
        const updated = await updateCachedTableRecord("expenses", id, { ...expense, ...ctx, sync_status: "pending" });
        await safeSavePending("expenses", { ...updated, operation: String(id).startsWith("offline-expense-") ? "create" : "update", sync_status: "pending" });
        return updated;
      }
      try {
        const { error } = await (supabase as any).from("expenses").update(expense).eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await updateCachedTableRecord("expenses", id, expense);
        return { id, ...expense, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) {
          const updated = await updateCachedTableRecord("expenses", id, { ...expense, ...ctx, sync_status: "pending" });
          await safeSavePending("expenses", { ...updated, operation: "update" });
          return updated;
        }
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Expense update saved offline" : "Expense updated");
    },
    onError: handleError,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const ctx = requireCtx(user, tenantId);
      if (!hasOnlineSession(session) || String(id).startsWith("offline-expense-")) return await queueTableDelete("expenses", id, ctx);
      try {
        const { error } = await (supabase as any).from("expenses").delete().eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await removeCachedTableRecord("expenses", id);
        return { id, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) return await queueTableDelete("expenses", id, ctx);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Expense removed locally" : "Expense deleted");
    },
    onError: handleError,
  });

  return { create, update, remove };
}

/* SUPPLIERS */

export function useSuppliers() {
  const { user, tenantId, session } = useAuth();
  return useQuery({
    queryKey: ["suppliers", tenantId, queryModeKey(session), localDataVersionKey()],
    enabled: !!user && !!tenantId,
    staleTime: queryIsOnline(session) ? 0 : 1000 * 60 * 5,
    retry: 0,
    refetchOnReconnect: queryIsOnline(session),
    refetchOnWindowFocus: queryIsOnline(session),
    networkMode: queryIsOnline(session) ? "online" : "always",
    queryFn: async () => {
      if (!hasOnlineSession(session)) return await getCachedSortedTable<DbSupplier>("suppliers");
      try {
        const { data, error } = await (supabase as any).from("suppliers").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        if (error) throw error;
        const merged = await mergeOnlineTableWithPending<DbSupplier>("suppliers", data || []);
        await saveCachedTable("suppliers", merged);
        return merged;
      } catch (error) {
        const cached = await getCachedSortedTable<DbSupplier>("suppliers");
        if (cached.length > 0 || shouldFallbackToCache(error)) return cached;
        throw error;
      }
    },
  });
}

export function useSupplierMutations() {
  const qc = useQueryClient();
  const { user, tenantId, session } = useAuth();

  const buildSupplierPayload = (supplier: Partial<DbSupplier>) => {
    const ctx = requireCtx(user, tenantId);
    const code = String(supplier.code || "").trim();
    const name = String(supplier.name || "").trim();
    if (!code) throw new Error("Supplier code is required");
    if (!name) throw new Error("Supplier name is required");
    return {
      ...ctx,
      code,
      name,
      email: supplier.email || null,
      phone: supplier.phone || null,
      contact_person: supplier.contact_person || null,
      address: supplier.address || null,
      city: supplier.city || null,
      country: supplier.country || null,
      tax_number: supplier.tax_number || null,
      payment_terms: supplier.payment_terms || "Immediate",
      status: supplier.status || "active",
      notes: supplier.notes || null,
      total_purchases: Number(supplier.total_purchases || 0),
      outstanding_balance: Number(supplier.outstanding_balance || 0),
      created_at: (supplier as any).created_at || new Date().toISOString(),
    };
  };

  const create = useMutation({
    mutationFn: async (supplier: Partial<DbSupplier>) => {
      const payload = buildSupplierPayload(supplier);
      const offlinePayload = { ...payload, id: (supplier as any).id || makeLocalId("offline-supplier"), operation: "create" };
      if (!hasOnlineSession(session)) return await saveOfflineSupplier(offlinePayload);
      try {
        const { data, error } = await (supabase as any).from("suppliers").insert(payload).select().single();
        if (error) throw error;
        await cacheTableRecord("suppliers", data);
        return data;
      } catch (error) {
        if (shouldSaveOffline(error)) return await saveOfflineSupplier(offlinePayload);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Supplier saved offline" : "Supplier added");
    },
    onError: handleError,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...supplier }: Partial<DbSupplier> & { id: string }) => {
      const ctx = requireCtx(user, tenantId);
      const payload = {
        code: supplier.code,
        name: supplier.name,
        email: supplier.email || null,
        phone: supplier.phone || null,
        contact_person: supplier.contact_person || null,
        address: supplier.address || null,
        city: supplier.city || null,
        country: supplier.country || null,
        tax_number: supplier.tax_number || null,
        payment_terms: supplier.payment_terms || "Immediate",
        status: supplier.status || "active",
        notes: supplier.notes || null,
        total_purchases: Number(supplier.total_purchases || 0),
        outstanding_balance: Number(supplier.outstanding_balance || 0),
        updated_at: new Date().toISOString(),
      };
      if (!hasOnlineSession(session) || String(id).startsWith("offline-supplier-")) {
        const updated = await updateCachedTableRecord("suppliers", id, { ...payload, ...ctx, sync_status: "pending" });
        await safeSavePending("suppliers", { ...updated, operation: String(id).startsWith("offline-supplier-") ? "create" : "update", sync_status: "pending" });
        return updated;
      }
      try {
        const { error } = await (supabase as any).from("suppliers").update(payload).eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await updateCachedTableRecord("suppliers", id, payload);
        return { id, ...payload, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) {
          const updated = await updateCachedTableRecord("suppliers", id, { ...payload, ...ctx, sync_status: "pending" });
          await safeSavePending("suppliers", { ...updated, operation: "update" });
          return updated;
        }
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Supplier update saved offline" : "Supplier updated");
    },
    onError: handleError,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const ctx = requireCtx(user, tenantId);
      if (!hasOnlineSession(session) || String(id).startsWith("offline-supplier-")) return await queueTableDelete("suppliers", id, ctx);
      try {
        const { error } = await (supabase as any).from("suppliers").delete().eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await removeCachedTableRecord("suppliers", id);
        return { id, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) return await queueTableDelete("suppliers", id, ctx);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Supplier removed locally" : "Supplier deleted");
    },
    onError: handleError,
  });

  return { create, update, remove };
}

/* PURCHASES */

export function usePurchases() {
  const { user, tenantId, session } = useAuth();
  return useQuery({
    queryKey: ["purchases", tenantId, queryModeKey(session), localDataVersionKey()],
    enabled: !!user && !!tenantId,
    staleTime: queryIsOnline(session) ? 0 : 1000 * 60 * 5,
    retry: 0,
    refetchOnReconnect: queryIsOnline(session),
    refetchOnWindowFocus: queryIsOnline(session),
    networkMode: queryIsOnline(session) ? "online" : "always",
    queryFn: async () => {
      if (!hasOnlineSession(session)) return await getCachedSortedTable<DbPurchase>("purchases");
      try {
        const { data, error } = await (supabase as any).from("purchases").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        if (error) throw error;
        const merged = await mergeOnlineTableWithPending<DbPurchase>("purchases", data || []);
        await saveCachedTable("purchases", merged);
        return merged;
      } catch (error) {
        const cached = await getCachedSortedTable<DbPurchase>("purchases");
        if (cached.length > 0 || shouldFallbackToCache(error)) return cached;
        throw error;
      }
    },
  });
}

export function usePurchaseMutations() {
  const qc = useQueryClient();
  const { user, tenantId, session } = useAuth();

  const create = useMutation({
    mutationFn: async (purchase: Partial<DbPurchase>) => {
      const ctx = requireCtx(user, tenantId);
      const payload = { ...purchase, ...ctx, supplier_id: purchase.supplier_id || null, supplier_name: purchase.supplier_name || "No Supplier", created_at: (purchase as any).created_at || new Date().toISOString() };
      const offlinePayload = { ...payload, id: (purchase as any).id || makeLocalId("offline-purchase"), operation: "create" };
      if (!hasOnlineSession(session)) return await saveOfflinePurchase(offlinePayload);
      try {
        const { data, error } = await (supabase as any).from("purchases").insert(payload).select().single();
        if (error) throw error;
        await cacheTableRecord("purchases", data);
        return data;
      } catch (error) {
        if (shouldSaveOffline(error)) return await saveOfflinePurchase(offlinePayload);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Purchase saved offline" : "Purchase order created");
    },
    onError: handleError,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...purchase }: Partial<DbPurchase> & { id: string }) => {
      const ctx = requireCtx(user, tenantId);
      const payload = { ...purchase, supplier_id: purchase.supplier_id || null, supplier_name: purchase.supplier_name || "No Supplier", updated_at: new Date().toISOString() };
      if (!hasOnlineSession(session) || String(id).startsWith("offline-purchase-")) {
        const updated = await updateCachedTableRecord("purchases", id, { ...payload, ...ctx, sync_status: "pending" });
        await safeSavePending("purchases", { ...updated, operation: String(id).startsWith("offline-purchase-") ? "create" : "update", sync_status: "pending" });
        return updated;
      }
      try {
        const { error } = await (supabase as any).from("purchases").update(payload).eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await updateCachedTableRecord("purchases", id, payload);
        return { id, ...payload, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) {
          const updated = await updateCachedTableRecord("purchases", id, { ...payload, ...ctx, sync_status: "pending" });
          await safeSavePending("purchases", { ...updated, operation: "update" });
          return updated;
        }
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Purchase update saved offline" : "Purchase order updated");
    },
    onError: handleError,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const ctx = requireCtx(user, tenantId);
      if (!hasOnlineSession(session) || String(id).startsWith("offline-purchase-")) return await queueTableDelete("purchases", id, ctx);
      try {
        const { error } = await (supabase as any).from("purchases").delete().eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await removeCachedTableRecord("purchases", id);
        return { id, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) return await queueTableDelete("purchases", id, ctx);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Purchase removed locally" : "Purchase order deleted");
    },
    onError: handleError,
  });

  return { create, update, remove };
}


/* STOCK BATCHES */

function normalizeStockBatch(batch: any): DbStockBatch {
  return {
    ...batch,
    batch_no: batch.batch_no ?? null,
    source_type: batch.source_type ?? "manual",
    source_id: batch.source_id ?? null,
    quantity_in: Number(batch.quantity_in || 0),
    quantity_remaining: Number(batch.quantity_remaining || 0),
    cost_price: Number(batch.cost_price || 0),
    selling_price: Number(batch.selling_price || 0),
    status: batch.status || (Number(batch.quantity_remaining || 0) > 0 ? "active" : "depleted"),
    created_at: batch.created_at || new Date().toISOString(),
  } as DbStockBatch;
}

function normalizeStockBatches(data: any[]): DbStockBatch[] {
  return (data || []).map(normalizeStockBatch);
}

async function getCachedStockBatchesWithPending(productId?: string | null) {
  const [cached, pending] = await Promise.all([
    getCachedTable("stock_batches"),
    getPending("stock_batches").catch(() => []),
  ]);

  const batches = normalizeStockBatches(
    sortByCreatedAtDesc(stripDeleted(dedupeRecords([...(cached || []), ...(pending || [])])))
  );

  return productId ? batches.filter((b) => b.product_id === productId) : batches;
}

async function mergeOnlineStockBatchesWithPending(onlineRecords: any[], productId?: string | null) {
  const pending = await getPending("stock_batches").catch(() => []);

  const batches = normalizeStockBatches(
    sortByCreatedAtDesc(stripDeleted(dedupeRecords([...(pending || []), ...(onlineRecords || [])])))
  );

  return productId ? batches.filter((b) => b.product_id === productId) : batches;
}

export function useStockBatches(productId?: string | null) {
  const { user, tenantId, session } = useAuth();

  return useQuery({
    queryKey: ["stock_batches", tenantId, productId || "all", queryModeKey(session), localDataVersionKey()],
    enabled: !!user && !!tenantId,
    staleTime: queryIsOnline(session) ? 0 : 1000 * 60 * 5,
    retry: 0,
    refetchOnReconnect: queryIsOnline(session),
    refetchOnWindowFocus: queryIsOnline(session),
    networkMode: queryIsOnline(session) ? "online" : "always",
    queryFn: async () => {
      if (!hasOnlineSession(session)) {
        return await getCachedStockBatchesWithPending(productId);
      }

      try {
        let query = (supabase as any)
          .from("stock_batches")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: true });

        if (productId) query = query.eq("product_id", productId);

        const { data, error } = await query;
        if (error) throw error;

        const mapped = normalizeStockBatches(data || []);

        const cachedAll = await getCachedTable("stock_batches");
        const merged = await mergeOnlineStockBatchesWithPending(mapped, productId);
        await saveCachedTable("stock_batches", sortByCreatedAtDesc(dedupeRecords([
          ...merged,
          ...(productId ? (cachedAll || []).filter((item: any) => item.product_id !== productId) : []),
        ])));

        return merged;
      } catch (error) {
        const cached = await getCachedStockBatchesWithPending(productId);
        if (cached.length > 0 || shouldFallbackToCache(error)) return cached;
        throw error;
      }
    },
  });
}

export function useStockBatchMutations() {
  const qc = useQueryClient();
  const { user, tenantId, session } = useAuth();

  const create = useMutation({
    mutationFn: async (batch: Partial<DbStockBatch>) => {
      const ctx = requireCtx(user, tenantId);

      if (!batch.product_id) throw new Error("Product is required for stock batch");

      const payload = {
        ...ctx,
        product_id: batch.product_id,
        batch_no: batch.batch_no || `BATCH-${Date.now().toString().slice(-8)}`,
        source_type: batch.source_type || "manual",
        source_id: batch.source_id || null,
        quantity_in: Number(batch.quantity_in || 0),
        quantity_remaining: Number(batch.quantity_remaining ?? batch.quantity_in ?? 0),
        cost_price: Number(batch.cost_price || 0),
        selling_price: Number(batch.selling_price || 0),
        status: batch.status || "active",
        created_at: (batch as any).created_at || new Date().toISOString(),
      };

      const offlinePayload = {
  ...payload,
  id: (batch as any).id || makeLocalId("offline-stock-batch"),
  operation: "create",
  sync_status: "pending",
};

if (!hasOnlineSession(session)) {
  await cacheTableRecord("stock_batches", offlinePayload);
  return await safeSavePending("stock_batches", offlinePayload);
}

      try {
        const { data, error } = await (supabase as any)
          .from("stock_batches")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        await cacheTableRecord("stock_batches", data);
        return data;
      } catch (error) {
        if (shouldSaveOffline(error)) {
          await cacheTableRecord("stock_batches", offlinePayload);
          return await safeSavePending("stock_batches", offlinePayload);
        }

        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Stock batch saved offline" : "Stock batch created");
    },
    onError: handleError,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...batch }: Partial<DbStockBatch> & { id: string }) => {
      const ctx = requireCtx(user, tenantId);

      const payload: any = {};
      if (batch.batch_no !== undefined) payload.batch_no = batch.batch_no || null;
      if (batch.source_type !== undefined) payload.source_type = batch.source_type || "manual";
      if (batch.source_id !== undefined) payload.source_id = batch.source_id || null;
      if (batch.quantity_in !== undefined) payload.quantity_in = Number(batch.quantity_in || 0);
      if (batch.quantity_remaining !== undefined) payload.quantity_remaining = Number(batch.quantity_remaining || 0);
      if (batch.cost_price !== undefined) payload.cost_price = Number(batch.cost_price || 0);
      if (batch.selling_price !== undefined) payload.selling_price = Number(batch.selling_price || 0);
      if (batch.status !== undefined) payload.status = batch.status || "active";

      if (!hasOnlineSession(session) || String(id).startsWith("offline-stock-batch-")) {
        const updated = await updateCachedTableRecord("stock_batches", id, {
          ...payload,
          ...ctx,
          sync_status: "pending",
        });

        await safeSavePending("stock_batches", {
          ...updated,
          operation: String(id).startsWith("offline-stock-batch-") ? "create" : "update",
          sync_status: "pending",
        });

        return updated;
      }

      try {
        const { error } = await (supabase as any)
          .from("stock_batches")
          .update(payload)
          .eq("id", id)
          .eq("tenant_id", tenantId);

        if (error) throw error;

        await updateCachedTableRecord("stock_batches", id, payload);
        return { id, ...payload, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) {
          const updated = await updateCachedTableRecord("stock_batches", id, {
            ...payload,
            ...ctx,
            sync_status: "pending",
          });

          await safeSavePending("stock_batches", {
            ...updated,
            operation: "update",
            sync_status: "pending",
          });

          return updated;
        }

        throw error;
      }
    },
    onSuccess: () => {
      invalidateBusinessQueries(qc);
    },
    onError: handleError,
  });

  return { create, update };
}


/* EBM SETTINGS */

export function useEBMSettings() {
  const { user, tenantId, session } = useAuth();

  return useQuery({
    queryKey: ["ebm_settings", tenantId, queryModeKey(session), localDataVersionKey()],
    enabled: !!user && !!tenantId,
    staleTime: queryIsOnline(session) ? 0 : 1000 * 60 * 5,
    retry: 0,
    refetchOnReconnect: queryIsOnline(session),
    refetchOnWindowFocus: queryIsOnline(session),
    networkMode: queryIsOnline(session) ? "online" : "always",
    queryFn: async () => {
      if (!hasOnlineSession(session)) {
        const cached = await getCachedSortedTable<DbEBMSettings>("ebm_settings");
        return cached[0] || null;
      }

      try {
        const { data, error } = await (supabase as any)
          .from("ebm_settings")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const merged = await mergeOnlineTableWithPending<DbEBMSettings>("ebm_settings", [data]);
          await saveCachedTable("ebm_settings", merged as any[]);
          return merged[0] || data;
        }

        const cached = await getCachedSortedTable<DbEBMSettings>("ebm_settings");
        await saveCachedTable("ebm_settings", cached as any[]);
        return cached[0] || null;
      } catch (error) {
        const cached = await getCachedSortedTable<DbEBMSettings>("ebm_settings");
        if (cached.length > 0 || shouldFallbackToCache(error)) return cached[0] || null;
        throw error;
      }
    },
  });
}

export function useEBMSettingsMutations() {
  const qc = useQueryClient();
  const { user, tenantId, session } = useAuth();

  const save = useMutation({
    mutationFn: async (settings: Partial<DbEBMSettings>) => {
      const ctx = requireCtx(user, tenantId);
      if (!hasOnlineSession(session)) {
        const offlinePayload = {
          ...settings,
          ...ctx,
          id: (settings as any).id || makeLocalId("offline-ebm-settings"),
          operation: (settings as any).id ? "update" : "create",
          sync_status: "pending",
          updated_offline_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_at: (settings as any).created_at || new Date().toISOString(),
        };

        await upsertCachedRecord("ebm_settings", offlinePayload);
        return await safeSavePending("ebm_settings", offlinePayload);
      }
      const payload = { ...settings, ...ctx, updated_at: new Date().toISOString() };
      const { data: existing, error: findError } = await (supabase as any).from("ebm_settings").select("id").eq("tenant_id", tenantId).maybeSingle();
      if (findError) throw findError;
      if (existing?.id) {
        const { data, error } = await (supabase as any).from("ebm_settings").update(payload).eq("id", existing.id).eq("tenant_id", tenantId).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await (supabase as any).from("ebm_settings").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ebm_settings"] });
      toast.success("EBM settings saved");
    },
    onError: handleError,
  });

  const reset = useMutation({
    mutationFn: async () => {
      const ctx = requireCtx(user, tenantId);
      if (!hasOnlineSession(session)) {
        const cached = await getCachedSortedTable<DbEBMSettings>("ebm_settings");
        const existing = cached[0];
        if (existing?.id) {
          return await queueTableDelete("ebm_settings", existing.id, ctx);
        }
        return { sync_status: "removed" };
      }
      const { error } = await (supabase as any).from("ebm_settings").delete().eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ebm_settings"] });
      toast.success("EBM settings reset");
    },
    onError: handleError,
  });

  return { save, reset };
}


/* GENERIC MASTER DATA */

export type DbSimpleMaster = {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  status?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at?: string | null;
};

function useGenericTable<T = any>(table: string) {
  const { user, tenantId, session } = useAuth();
  const onlineTableReady = shouldQueryOnlineTable(table, session);

  return useQuery({
    queryKey: [table, tenantId, onlineTableReady ? "online" : "cached", localDataVersionKey()],
    enabled: !!user && !!tenantId,
    staleTime: onlineTableReady ? 0 : 1000 * 60 * 5,
    retry: 0,
    refetchOnReconnect: onlineTableReady,
    refetchOnWindowFocus: onlineTableReady,
    networkMode: onlineTableReady ? "online" : "always",
    queryFn: async () => {
      if (!onlineTableReady) return await getCachedSortedTable<T>(table);

      try {
        const { data, error } = await (supabase as any)
          .from(table)
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const merged = await mergeOnlineTableWithPending<T>(table, data || []);
        await saveCachedTable(table, merged as any[]);
        return merged;
      } catch (error) {
        markTableSchemaBlocked(table, error);
        recordOfflineDiagnostic(table, "query", error);
        const cached = await getCachedSortedTable<T>(table);
        if (cached.length > 0 || shouldFallbackToCache(error)) return cached;
        throw error;
      }
    },
  });
}

function useGenericMutations<T extends Record<string, any>>(table: string, offlinePrefix: string, successName: string) {
  const qc = useQueryClient();
  const { user, tenantId, session } = useAuth();

  const create = useMutation({
    mutationFn: async (record: Partial<T>) => {
      const ctx = requireCtx(user, tenantId);
      const payload = cleanTablePayload(table, {
        ...record,
        ...ctx,
        created_at: (record as any).created_at || new Date().toISOString(),
      });

      const offlinePayload = cleanTablePayload(table, {
        ...payload,
        id: (record as any).id || makeLocalId(offlinePrefix),
        operation: "create",
        sync_status: "pending",
      });

      if (!shouldQueryOnlineTable(table, session)) {
        await upsertCachedRecord(table, cleanTableRecord(table, offlinePayload));
        return await safeSavePending(table, cleanTablePayload(table, offlinePayload));
      }

      try {
        const { data, error } = await (supabase as any).from(table).insert(payload).select().single();
        if (error) throw error;
        await upsertCachedRecord(table, data);
        return data;
      } catch (error) {
        if (shouldSaveOffline(error)) {
          await upsertCachedRecord(table, cleanTableRecord(table, offlinePayload));
          return await safeSavePending(table, cleanTablePayload(table, offlinePayload));
        }
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? `${successName} saved offline` : `${successName} saved`);
    },
    onError: handleError,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...record }: Partial<T> & { id: string }) => {
      const ctx = requireCtx(user, tenantId);
      const payload = cleanTablePayload(table, {
        ...record,
        updated_at: new Date().toISOString(),
      });

      if (!shouldQueryOnlineTable(table, session) || String(id).startsWith(`offline-${offlinePrefix}`) || String(id).startsWith(offlinePrefix)) {
        const updated = await updateCachedTableRecord(table, id, {
          ...payload,
          ...ctx,
          sync_status: "pending",
        });

        await safeSavePending(table, cleanTablePayload(table, {
          ...updated,
          operation: String(id).startsWith("offline-") ? "create" : "update",
          sync_status: "pending",
          updated_offline_at: new Date().toISOString(),
        }));

        return updated;
      }

      try {
        const { error } = await (supabase as any).from(table).update(payload).eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await updateCachedTableRecord(table, id, payload);
        return { id, ...payload, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) {
          const updated = await updateCachedTableRecord(table, id, {
            ...payload,
            ...ctx,
            sync_status: "pending",
          });

          await safeSavePending(table, cleanTablePayload(table, {
            ...updated,
            operation: "update",
            sync_status: "pending",
            updated_offline_at: new Date().toISOString(),
          }));

          return updated;
        }

        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? `${successName} update saved offline` : `${successName} updated`);
    },
    onError: handleError,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const ctx = requireCtx(user, tenantId);

      if (!shouldQueryOnlineTable(table, session) || String(id).startsWith("offline-")) {
        return await queueTableDelete(table, id, ctx);
      }

      try {
        const { error } = await (supabase as any).from(table).delete().eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
        await removeCachedTableRecord(table, id);
        return { id, sync_status: "synced" };
      } catch (error) {
        if (shouldSaveOffline(error)) return await queueTableDelete(table, id, ctx);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? `${successName} removed locally` : `${successName} deleted`);
    },
    onError: handleError,
  });

  return { create, update, remove };
}

/*
 * Categories and brands are served by the new backend (backend/src/modules/
 * catalog/), not Supabase. The hook names are unchanged so the pages that
 * consume them did not have to be touched — this file is the seam where a
 * module moves across, and useApiTable/useApiMutations keep the same call
 * shape and the same offline cache as their Supabase counterparts.
 */
export function useCategories() {
  return useApiTable<DbSimpleMaster>("categories", categoriesApi as never);
}

export function useCategoryMutations() {
  return useApiMutations<DbSimpleMaster>("categories", categoriesApi as never, "Category");
}

export function useBrands() {
  return useApiTable<DbSimpleMaster>("brands", brandsApi as never);
}

export function useBrandMutations() {
  return useApiMutations<DbSimpleMaster>("brands", brandsApi as never, "Brand");
}

export function useUnits() {
  return useGenericTable<DbSimpleMaster>("units");
}

export function useUnitMutations() {
  return useGenericMutations<DbSimpleMaster>("units", "offline-unit", "Unit");
}

/* OPERATIONAL MODULE HOOKS */

export interface DbBranch {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  name: string;
  code?: string | null;
  location?: string | null;
  address?: string | null;
  phone?: string | null;
  manager?: string | null;
  status?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at?: string | null;
}

export interface DbWarehouse {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  name: string;
  code?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  location?: string | null;
  address?: string | null;
  manager?: string | null;
  capacity?: number | null;
  status?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at?: string | null;
}

export interface DbTransfer {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  transfer_no?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  from_branch?: string | null;
  to_branch?: string | null;
  from_warehouse?: string | null;
  to_warehouse?: string | null;
  quantity?: number | null;
  status?: string | null;
  notes?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at?: string | null;
}

export interface DbStockCount {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  count_no?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  sku?: string | null;
  system_qty?: number | null;
  counted_qty?: number | null;
  variance?: number | null;
  status?: string | null;
  notes?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at?: string | null;
}

export interface DbQuotation {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  quotation_no?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  status?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  total?: number | null;
  valid_until?: string | null;
  notes?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at?: string | null;
}

export interface DbLoyalty {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  points?: number | null;
  total_points?: number | null;
  redeemed_points?: number | null;
  tier?: string | null;
  status?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at?: string | null;
}

export interface DbStaff {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  department?: string | null;
  branch?: string | null;
  salary?: number | null;
  status?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at?: string | null;
}

export interface DbWorkspaceRecord {
  id: string;
  user_id?: string | null;
  tenant_id?: string | null;
  workspace_id?: string | null;
  title?: string | null;
  message?: string | null;
  type?: string | null;
  status?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at?: string | null;
}

export function useBranches() {
  return useGenericTable<DbBranch>("branches");
}

export function useBranchMutations() {
  return useGenericMutations<DbBranch>("branches", "offline-branch", "Branch");
}

export function useWarehouses() {
  return useGenericTable<DbWarehouse>("warehouses");
}

export function useWarehouseMutations() {
  return useGenericMutations<DbWarehouse>("warehouses", "offline-warehouse", "Warehouse");
}

export function useTransfers() {
  return useGenericTable<DbTransfer>("transfers");
}

export function useTransferMutations() {
  return useGenericMutations<DbTransfer>("transfers", "offline-transfer", "Transfer");
}

export function useStockCounts() {
  return useGenericTable<DbStockCount>("stock_counts");
}

export function useStockCountMutations() {
  return useGenericMutations<DbStockCount>("stock_counts", "offline-stock-count", "Stock count");
}

export function useQuotations() {
  return useGenericTable<DbQuotation>("quotations");
}

export function useQuotationMutations() {
  return useGenericMutations<DbQuotation>("quotations", "offline-quotation", "Quotation");
}

export function useLoyalty() {
  return useGenericTable<DbLoyalty>("loyalty");
}

export function useLoyaltyMutations() {
  return useGenericMutations<DbLoyalty>("loyalty", "offline-loyalty", "Loyalty record");
}

export function useLoyaltyMembers() {
  return useGenericTable<DbLoyalty>("loyalty_members");
}

export function useLoyaltyMemberMutations() {
  return useGenericMutations<DbLoyalty>("loyalty_members", "offline-loyalty-member", "Loyalty member");
}

export function useStaff() {
  return useGenericTable<DbStaff>("staff");
}

export function useStaffMutations() {
  return useGenericMutations<DbStaff>("staff", "offline-staff", "Staff record");
}

export function useWorkspaceMessages() {
  return useGenericTable<DbWorkspaceRecord>("workspace_messages");
}

export function useWorkspaceMessageMutations() {
  return useGenericMutations<DbWorkspaceRecord>("workspace_messages", "offline-workspace-message", "Workspace message");
}

export function useWorkspaceMeetings() {
  return useGenericTable<DbWorkspaceRecord>("workspace_meetings");
}

export function useWorkspaceMeetingMutations() {
  return useGenericMutations<DbWorkspaceRecord>("workspace_meetings", "offline-workspace-meeting", "Workspace meeting");
}



/* STOCK ADJUSTMENTS */

export interface DbStockAdjustment {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  product_id: string;
  product_name?: string | null;
  sku?: string | null;
  adjustment_no?: string | null;
  adjustment_type?: string | null;
  quantity_change: number;
  stock_before?: number | null;
  stock_after?: number | null;
  reason?: string | null;
  notes?: string | null;
  status?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_at: string;
  updated_at?: string | null;
}

export function useStockAdjustments() {
  return useGenericTable<DbStockAdjustment>("stock_adjustments");
}

export function useStockAdjustmentMutations() {
  const qc = useQueryClient();
  const { user, tenantId, session } = useAuth();

  const create = useMutation({
    mutationFn: async (adjustment: Partial<DbStockAdjustment>) => {
      const ctx = requireCtx(user, tenantId);

      if (!adjustment.product_id) throw new Error("Product is required");
      const cachedProducts = await getCachedProductsWithPending();
      const product = cachedProducts.find((p) => String(p.id) === String(adjustment.product_id));
      const stockBefore = Number(product?.stock ?? product?.stock_quantity ?? adjustment.stock_before ?? 0);
      const quantityChange = Number(adjustment.quantity_change || 0);
      const stockAfter = Math.max(0, stockBefore + quantityChange);

      const payload = {
        ...adjustment,
        ...ctx,
        product_name: adjustment.product_name || product?.name || "Product",
        sku: adjustment.sku || product?.sku || null,
        quantity_change: quantityChange,
        stock_before: stockBefore,
        stock_after: stockAfter,
        adjustment_no: adjustment.adjustment_no || `ADJ-${Date.now().toString().slice(-8)}`,
        status: adjustment.status || "completed",
        created_at: (adjustment as any).created_at || new Date().toISOString(),
      };

      const offlinePayload = {
        ...payload,
        id: (adjustment as any).id || makeLocalId("offline-stock-adjustment"),
        operation: "create",
        sync_status: "pending",
      };

      if (!hasOnlineSession(session)) {
        await patchCachedProductStock(payload.product_id!, quantityChange, { sync_status: "pending" });
        await upsertCachedRecord("stock_adjustments", offlinePayload);
        return await safeSavePending("stock_adjustments", offlinePayload);
      }

      try {
        const { error: productError } = await (supabase as any)
          .from("products")
          .update({
            stock: stockAfter,
            stock_quantity: stockAfter,
            status: stockAfter <= 0 ? "out_of_stock" : "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.product_id)
          .eq("tenant_id", tenantId);

        if (productError) throw productError;

        const { data, error } = await (supabase as any)
          .from("stock_adjustments")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        await upsertCachedRecord("stock_adjustments", data);
        await patchCachedProductStock(payload.product_id!, quantityChange);
        return data;
      } catch (error) {
        if (shouldSaveOffline(error)) {
          await patchCachedProductStock(payload.product_id!, quantityChange, { sync_status: "pending" });
          await upsertCachedRecord("stock_adjustments", offlinePayload);
          return await safeSavePending("stock_adjustments", offlinePayload);
        }

        throw error;
      }
    },
    onSuccess: (data: any) => {
      invalidateBusinessQueries(qc);
      toast.success(data?.sync_status === "pending" ? "Stock adjustment saved offline" : "Stock adjustment saved");
    },
    onError: handleError,
  });

  return { create };
}

/* PURCHASE ITEMS */

export interface DbPurchaseItemExt extends DbPurchaseItem {
  sync_status?: string;
  operation?: string;
  offline_id?: string;
}

export function usePurchaseItems(purchaseId?: string | null) {
  const query = useGenericTable<DbPurchaseItemExt>("purchase_items");

  return {
    ...query,
    data: purchaseId ? (query.data || []).filter((item) => item.purchase_id === purchaseId) : query.data || [],
  };
}

export function usePurchaseItemMutations() {
  return useGenericMutations<DbPurchaseItemExt>("purchase_items", "offline-purchase-item", "Purchase item");
}

/* SALE REFUNDS */

export function useSaleRefunds() {
  return useGenericTable<DbSaleRefund>("sale_refunds");
}

export function useSaleRefundItems() {
  return useGenericTable<DbSaleRefundItem>("sale_refund_items");
}

/* STOCK MOVEMENTS */

export interface DbStockMovement {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  product_id: string | null;
  product_name: string | null;
  movement_type: string;
  quantity_change: number;
  stock_before?: number | null;
  stock_after?: number | null;
  reference?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  sync_status?: string;
  operation?: string;
  offline_id?: string;
  created_offline_at?: string;
  updated_offline_at?: string;
  created_at: string;
}

export function useStockMovements(limit = 1000) {
  const query = useGenericTable<DbStockMovement>("stock_movements");

  return {
    ...query,
    data: (query.data || []).slice(0, limit),
  };
}


/* OFFLINE ENGINE STATUS */

export function useOfflineEngineStatus() {
  return useQuery({
    queryKey: ["offline-engine-status", localDataVersionKey()],
    staleTime: 1000 * 10,
    networkMode: "always",
    queryFn: async () => {
      const [summary, errors] = await Promise.all([
        getEnterpriseOfflineSummary(),
        getOfflineSyncErrors().catch(() => []),
      ]);

      return {
        ...summary,
        errors,
        failed: errors.length,
      };
    },
  });
}

export function useOfflineRepairMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => repairOfflineSyncQueues(),
    onSuccess: () => {
      invalidateBusinessQueries(qc);
      qc.invalidateQueries({ queryKey: ["offline-engine-status"], exact: false });
      toast.success("Offline queues repaired and validated.");
    },
    onError: handleError,
  });
}

/* PUBLIC GENERIC OFFLINE HELPERS */

export function useOfflineTable<T = any>(table: string) {
  return useGenericTable<T>(table);
}

export function useOfflineTableMutations<T extends Record<string, any>>(
  table: string,
  offlinePrefix = `offline-${table.replace(/_/g, "-")}`,
  successName = "Record"
) {
  return useGenericMutations<T>(table, offlinePrefix, successName);
}

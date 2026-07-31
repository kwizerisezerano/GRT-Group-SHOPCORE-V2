import localforage from "localforage";

export const offlineDB = localforage.createInstance({
  name: "shopcore-offline-db",
  storeName: "records",
  description: "ShopCore offline cache and pending sync queue",
});

const NETWORK_STATE_KEY = "shopcore_network_state";
const NETWORK_ERROR_COOLDOWN_MS = 15000;
const OFFLINE_SYNC_ERRORS_KEY = "offline_sync_errors";
const OFFLINE_QUARANTINE_KEY = "offline_quarantine";


export const OFFLINE_CORE_TABLES = [
  "products",
  "sales",
  "sale_items",
  "customers",
  "suppliers",
  "expenses",
  "purchases",
  "purchase_items",
  "stock_movements",
  "stock_batches",
  "stock_counts",
  "categories",
  "brands",
  "units",
  "transfers",
  "quotations",
  "loyalty",
  "loyalty_members",
  "staff",
  "branches",
  "warehouses",
  "ebm_settings",
  "workspace_messages",
  "workspace_meetings",
  "workspace_members",
  "workspace_channels",
  "workspace_tasks",
  "workspace_polls",
  "workspace_message_reactions",
  "workspace_message_pins",
] as const;

export const OFFLINE_MODULE_LABELS: Record<string, string> = {
  products: "Products",
  sales: "Sales",
  sale_items: "Sale Items",
  customers: "Customers",
  suppliers: "Suppliers",
  expenses: "Expenses",
  purchases: "Purchases",
  purchase_items: "Purchase Items",
  stock_movements: "Movement History",
  stock_batches: "Stock Batches",
  stock_counts: "Stock Counts",
  categories: "Categories",
  brands: "Brands",
  units: "Units",
  transfers: "Transfers",
  quotations: "Quotations",
  loyalty: "Loyalty",
  loyalty_members: "Loyalty Members",
  staff: "Staff",
  branches: "Branches",
  warehouses: "Warehouses",
  ebm_settings: "EBM Settings",
  workspace_messages: "Workspace Messages",
  workspace_meetings: "Workspace Meetings",
  workspace_members: "Workspace Members",
  workspace_channels: "Workspace Channels",
  workspace_tasks: "Workspace Tasks",
  workspace_polls: "Workspace Polls",
  workspace_message_reactions: "Workspace Reactions",
  workspace_message_pins: "Workspace Pins",
  offline_sync_errors: "Sync Errors",
  offline_quarantine: "Quarantined Records",
};


type NetworkState = {
  reachable: boolean;
  last_error_at?: number;
  last_online_at?: number;
};

type AnyRecord = Record<string, any>;

const PENDING_TABLE_PREFIX = "pending_";

function tableFromQueueKey(key: string) {
  const normalized = String(key || "").trim();
  return normalized.startsWith(PENDING_TABLE_PREFIX)
    ? normalized.slice(PENDING_TABLE_PREFIX.length)
    : normalized;
}

function cleanRecordForQueue(table: string, record: AnyRecord) {
  const normalizedTable = normalizeTableName(table);
  const clean = { ...(record || {}) };

  if (normalizedTable === "products") {
    clean.name = String(clean.name ?? clean.product_name ?? clean.title ?? "").trim();
    clean.selling_price = Number(clean.selling_price ?? clean.price ?? 0) || 0;
    clean.cost_price = Number(clean.cost_price ?? clean.purchase_price ?? clean.unit_cost ?? 0) || 0;
    clean.stock = Number(clean.stock ?? clean.stock_quantity ?? 0) || 0;
    clean.stock_quantity = Number(clean.stock_quantity ?? clean.stock ?? 0) || 0;

    delete clean.product_name;
    delete clean.title;
    delete clean.price;
    delete clean.unit_cost;
    delete clean.purchase_price;
  }

  if (normalizedTable === "stock_movements") {
    delete clean.selling_price;
    delete clean.unit_cost;
    delete clean.price;
    delete clean.purchase_price;
    delete clean.cost_price;
  }

  if (normalizedTable === "stock_batches") {
    clean.cost_price = clean.cost_price ?? clean.unit_cost ?? clean.purchase_price ?? 0;
    clean.selling_price = clean.selling_price ?? clean.price ?? 0;

    delete clean.unit_cost;
    delete clean.purchase_price;
    delete clean.price;
  }

  return clean;
}

function cleanRecordsForQueue(table: string, records: AnyRecord[]) {
  return (records || []).map((record) => cleanRecordForQueue(table, record));
}


function nowIso() {
  return new Date().toISOString();
}

function makeUuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function normalizeTableName(table: string) {
  return String(table || "").trim();
}

function offlineTimeoutMs() {
  return 8000;
}

async function withOfflineTimeout<T>(promise: Promise<T>, label: string, timeoutMs = offlineTimeoutMs()): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Offline storage timeout while ${label}`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function dbGet<T>(key: string, fallback: T, label?: string): Promise<T> {
  try {
    const value = await withOfflineTimeout(offlineDB.getItem(key), label || `reading ${key}`);
    return (value as T) ?? fallback;
  } catch (error) {
    console.error(`[offlineStore] Failed reading ${key}:`, error);
    return fallback;
  }
}

async function dbSet<T>(key: string, value: T, label?: string): Promise<T> {
  await withOfflineTimeout(offlineDB.setItem(key, value), label || `saving ${key}`);
  return value;
}

function getQueueValidationError(table: string, record: AnyRecord) {
  const normalizedTable = normalizeTableName(table);
  const operation = String(record?.operation || "create").toLowerCase();

  if (operation === "delete") return "";

  if (normalizedTable === "products") {
    const name = String(record?.name || record?.product_name || record?.title || "").trim();
    if (!name) return "Product name is required before this record can sync.";
  }

  if (["categories", "brands", "units", "suppliers", "customers", "branches", "warehouses"].includes(normalizedTable)) {
    const name = String(record?.name || record?.display_name || record?.title || "").trim();
    if (!name && normalizedTable !== "customers") return `${OFFLINE_MODULE_LABELS[normalizedTable] || normalizedTable} name is required before this record can sync.`;
  }

  return "";
}

export async function saveOfflineSyncError(input: {
  table: string;
  record?: AnyRecord;
  message: string;
  severity?: "low" | "medium" | "high" | "critical";
  source?: string;
}) {
  const rows = await dbGet<AnyRecord[]>(OFFLINE_SYNC_ERRORS_KEY, [], "reading offline sync errors");
  const row = {
    id: `sync-error-${makeUuid()}`,
    table: normalizeTableName(input.table),
    record_id: input.record?.id || input.record?.offline_id || input.record?.offline_local_id || input.record?.client_id || null,
    message: input.message,
    severity: input.severity || "medium",
    source: input.source || "offlineStore",
    record_snapshot: input.record || null,
    created_at: nowIso(),
  };

  await dbSet(OFFLINE_SYNC_ERRORS_KEY, [row, ...rows].slice(0, 300), "saving offline sync error");
  return row;
}

export async function getOfflineSyncErrors() {
  return dbGet<AnyRecord[]>(OFFLINE_SYNC_ERRORS_KEY, [], "reading offline sync errors");
}

export async function clearOfflineSyncErrors() {
  await dbSet(OFFLINE_SYNC_ERRORS_KEY, [], "clearing offline sync errors");
}

async function quarantineOfflineRecord(table: string, record: AnyRecord, reason: string) {
  const rows = await dbGet<AnyRecord[]>(OFFLINE_QUARANTINE_KEY, [], "reading quarantined offline records");
  const row = {
    id: `quarantine-${makeUuid()}`,
    table: normalizeTableName(table),
    reason,
    record,
    created_at: nowIso(),
  };

  await dbSet(OFFLINE_QUARANTINE_KEY, [row, ...rows].slice(0, 300), "saving quarantined offline record");
  await saveOfflineSyncError({ table, record, message: reason, severity: "high", source: "queue-validation" }).catch(() => undefined);
  return row;
}

export async function getQuarantinedOfflineRecords() {
  return dbGet<AnyRecord[]>(OFFLINE_QUARANTINE_KEY, [], "reading quarantined offline records");
}

export async function clearQuarantinedOfflineRecords() {
  await dbSet(OFFLINE_QUARANTINE_KEY, [], "clearing quarantined offline records");
}

export async function markPendingRecordFailed(table: string, idOrOfflineId: string, message: string) {
  const key = pendingKeyForTable(table);
  const existing = await getPendingRecords(key);
  const target = String(idOrOfflineId || "");

  const next = existing.map((item) =>
    getRecordIdentifiers(item).includes(target)
      ? {
          ...item,
          sync_status: "failed",
          last_sync_error: message,
          updated_offline_at: nowIso(),
        }
      : item
  );

  await setPendingRecords(key, next);
  await patchCachedRecord(table, target, {
    sync_status: "failed",
    last_sync_error: message,
    updated_offline_at: nowIso(),
  }).catch(() => undefined);

  await saveOfflineSyncError({
    table,
    record: existing.find((item) => getRecordIdentifiers(item).includes(target)),
    message,
    severity: "high",
    source: "sync",
  }).catch(() => undefined);
}

function cachedKeyForTable(table: string) {
  return `cached_${normalizeTableName(table)}`;
}

function pendingKeyForTable(table: string) {
  return `pending_${normalizeTableName(table)}`;
}

function readNetworkState(): NetworkState {
  try {
    return JSON.parse(localStorage.getItem(NETWORK_STATE_KEY) || "{}");
  } catch {
    return { reachable: true };
  }
}

function writeNetworkState(state: NetworkState) {
  try {
    localStorage.setItem(NETWORK_STATE_KEY, JSON.stringify(state));
  } catch {
    // localStorage can fail in private mode; offline engine must continue.
  }
}

export function markNetworkReachable() {
  writeNetworkState({
    reachable: true,
    last_online_at: Date.now(),
  });
}

export function markNetworkUnreachable() {
  writeNetworkState({
    reachable: false,
    last_error_at: Date.now(),
  });
}

export function isOnline() {
  if (typeof navigator === "undefined") return true;
  if (!navigator.onLine) return false;

  const state = readNetworkState();

  if (state.reachable === false && state.last_error_at) {
    const age = Date.now() - state.last_error_at;
    if (age < NETWORK_ERROR_COOLDOWN_MS) return false;
  }

  return true;
}

export function isNetworkError(error: unknown) {
  const message = String(
    (error as any)?.message ||
      (error as any)?.details ||
      (error as any)?.hint ||
      (error as any)?.code ||
      (error as any)?.name ||
      error ||
      ""
  ).toLowerCase();

  const networkFailure =
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed") ||
    message.includes("err_name_not_resolved") ||
    message.includes("err_connection_closed") ||
    message.includes("err_connection_reset") ||
    message.includes("err_internet_disconnected") ||
    message.includes("name_not_resolved") ||
    message.includes("dns") ||
    message.includes("fetch") ||
    message.includes("websocket") ||
    message.includes("realtime") ||
    message.includes("timeout") ||
    message.includes("aborterror");

  if (networkFailure) markNetworkUnreachable();

  return networkFailure;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => markNetworkReachable());
  window.addEventListener("offline", () => markNetworkUnreachable());
}

function statusOf(record: AnyRecord) {
  return String(record?.sync_status || "").toLowerCase();
}

function operationOf(record: AnyRecord) {
  return String(record?.operation || "").toLowerCase();
}

function isPendingLike(record: AnyRecord) {
  const status = statusOf(record);
  const operation = operationOf(record);

  return (
    status === "pending" ||
    status === "failed" ||
    operation === "create" ||
    operation === "update" ||
    operation === "delete" ||
    !!record?.created_offline_at ||
    !!record?.updated_offline_at ||
    String(record?.id || "").startsWith("offline-")
  );
}

function getRecordIdentifiers(record: AnyRecord) {
  return [
    record?.id,
    record?.offline_id,
    record?.offline_local_id,
    record?.client_id,
    record?.invoice_no,
    record?.receipt_no,
    record?.purchase_no,
    record?.reference,
    record?.reference_id,
    record?.code,
    record?.sku,
    record?.barcode,
  ]
    .map((value) => String(value || ""))
    .filter(Boolean);
}

function getRecordKey(record: AnyRecord) {
  return String(
    record?.id ||
      record?.offline_id ||
      record?.offline_local_id ||
      record?.client_id ||
      record?.invoice_no ||
      record?.receipt_no ||
      record?.purchase_no ||
      record?.reference ||
      record?.code ||
      record?.sku ||
      record?.barcode ||
      ""
  );
}

function getRecordUpdatedTime(record: AnyRecord) {
  return new Date(
    record?.updated_offline_at ||
      record?.created_offline_at ||
      record?.updated_at ||
      record?.created_at ||
      0
  ).getTime();
}

function shouldPreferIncoming(existing: AnyRecord, incoming: AnyRecord) {
  const existingPending = isPendingLike(existing);
  const incomingPending = isPendingLike(incoming);

  if (incomingPending && !existingPending) return true;
  if (!incomingPending && existingPending) return false;

  return getRecordUpdatedTime(incoming) >= getRecordUpdatedTime(existing);
}

function mergeRecord(existing: AnyRecord, incoming: AnyRecord) {
  if (shouldPreferIncoming(existing, incoming)) {
    return { ...existing, ...incoming };
  }

  return { ...incoming, ...existing };
}

function dedupeRecords(records: AnyRecord[]) {
  const map = new Map<string, AnyRecord>();

  for (const record of records || []) {
    if (!record) continue;

    const key = getRecordKey(record) || `unknown-${map.size}`;

    if (!map.has(key)) {
      map.set(key, record);
      continue;
    }

    map.set(key, mergeRecord(map.get(key) || {}, record));
  }

  return Array.from(map.values());
}

function sortByCreatedOrUpdatedDesc(records: AnyRecord[]) {
  return [...(records || [])].sort((a, b) => getRecordUpdatedTime(b) - getRecordUpdatedTime(a));
}

function makeOfflineRecord(data: AnyRecord) {
  const now = nowIso();
  const operation = data?.operation || (data?.id && !String(data.id).startsWith("offline-") ? "update" : "create");

  return {
    ...data,
    offline_id: data?.offline_id || makeUuid(),
    sync_status: data?.sync_status || "pending",
    operation,
    created_offline_at: data?.created_offline_at || now,
    updated_offline_at: now,
  };
}

async function getRawCachedTable(table: string) {
  return await dbGet<AnyRecord[]>(cachedKeyForTable(table), [], `reading cached ${table}`);
}

async function getPendingRecords(key: string) {
  const table = tableFromQueueKey(key);
  const records = await dbGet<AnyRecord[]>(key, [], `reading pending ${key}`);
  const cleaned = cleanRecordsForQueue(table, records);

  if (JSON.stringify(records) !== JSON.stringify(cleaned)) {
    await dbSet(key, sortByCreatedOrUpdatedDesc(dedupeRecords(cleaned)), `repairing pending ${key}`).catch(() => undefined);
  }

  return cleaned;
}

async function setPendingRecords(key: string, records: AnyRecord[]) {
  const table = tableFromQueueKey(key);
  const cleaned = cleanRecordsForQueue(table, records || []);
  const validRows: AnyRecord[] = [];

  for (const row of cleaned) {
    const validationError = getQueueValidationError(table, row);
    if (validationError) {
      await quarantineOfflineRecord(table, row, validationError).catch(() => undefined);
      continue;
    }
    validRows.push(row);
  }

  await dbSet(key, sortByCreatedOrUpdatedDesc(dedupeRecords(validRows)), `saving pending ${key}`);
}

async function addPendingRecord(key: string, data: AnyRecord) {
  const existing = await getPendingRecords(key);
  const table = tableFromQueueKey(key);
  const record = makeOfflineRecord(cleanRecordForQueue(table, data));
  const validationError = getQueueValidationError(table, record);

  if (validationError) {
    await quarantineOfflineRecord(table, record, validationError).catch(() => undefined);
    return {
      ...record,
      sync_status: "failed",
      last_sync_error: validationError,
      quarantined_at: nowIso(),
    };
  }

  await setPendingRecords(key, [record, ...existing]);
  return record;
}

async function clearPendingRecord(key: string, idOrOfflineId: string) {
  const existing = await getPendingRecords(key);
  const target = String(idOrOfflineId || "");

  if (!target) return;

  await setPendingRecords(
    key,
    existing.filter((item) => !getRecordIdentifiers(item).includes(target))
  );
}

async function replacePendingRecord(key: string, idOrOfflineId: string, data: AnyRecord) {
  const existing = await getPendingRecords(key);
  const table = tableFromQueueKey(key);
  const target = String(idOrOfflineId || "");
  const patch = makeOfflineRecord(cleanRecordForQueue(table, { ...data, offline_id: data?.offline_id || idOrOfflineId }));

  const found = existing.some((item) => getRecordIdentifiers(item).includes(target));

  const next = found
    ? existing.map((item) =>
        getRecordIdentifiers(item).includes(target)
          ? { ...item, ...patch, sync_status: "pending", updated_offline_at: nowIso() }
          : item
      )
    : [patch, ...existing];

  await setPendingRecords(key, next);
  return patch;
}

async function mergePendingIntoCachedTable(table: string, cached: AnyRecord[]) {
  const pending = await getPending(table);
  const merged = dedupeRecords([...(pending || []), ...(cached || [])]);
  return sortByCreatedOrUpdatedDesc(merged);
}

export async function saveCachedTable(table: string, records: AnyRecord[]) {
  const incoming = records || [];
  const key = cachedKeyForTable(table);
  const existing = await getRawCachedTable(table);

  // Never wipe a good cache because an unstable connection returned empty.
  if (incoming.length === 0 && existing.length > 0) return;

  const pending = await getPending(table);

  // Pending rows are first so they stay visible and win until sync clears them.
  const next = dedupeRecords([
    ...(pending || []),
    ...(existing || []).filter(isPendingLike),
    ...(incoming || []),
    ...(existing || []).filter((row) => !isPendingLike(row)),
  ]);

  await dbSet(key, sortByCreatedOrUpdatedDesc(next), `saving cached ${table}`);
}

export async function forceReplaceCachedTable(table: string, records: AnyRecord[]) {
  const pending = await getPending(table);
  const next = dedupeRecords([...(pending || []), ...(records || [])]);
  await dbSet(cachedKeyForTable(table), sortByCreatedOrUpdatedDesc(next), `saving cached ${table}`);
}

export async function getCachedTable(table: string) {
  const cached = await getRawCachedTable(table);
  return mergePendingIntoCachedTable(table, cached);
}

export async function saveCachedProducts(products: AnyRecord[]) {
  return saveCachedTable("products", products);
}

export async function getCachedProducts() {
  return getCachedTable("products");
}

export async function upsertCachedRecord(table: string, record: AnyRecord) {
  const cached = await getRawCachedTable(table);
  const next = dedupeRecords([record, ...cached]);
  await dbSet(cachedKeyForTable(table), sortByCreatedOrUpdatedDesc(next), `saving cached ${table}`);
  return record;
}

export async function patchCachedRecord(table: string, idOrOfflineId: string, patch: AnyRecord) {
  const cached = await getCachedTable(table);
  const target = String(idOrOfflineId || "");
  let found = false;

  const next = cached.map((item) => {
    if (getRecordIdentifiers(item).includes(target)) {
      found = true;
      return {
        ...item,
        ...patch,
        updated_offline_at: patch?.updated_offline_at || nowIso(),
      };
    }

    return item;
  });

  if (!found && patch && Object.keys(patch).length > 0) {
    next.unshift({
      ...patch,
      id: patch?.id || target || `offline-${normalizeTableName(table)}-${makeUuid()}`,
      updated_offline_at: patch?.updated_offline_at || nowIso(),
    });
  }

  await dbSet(cachedKeyForTable(table), sortByCreatedOrUpdatedDesc(dedupeRecords(next)), `patching cached ${table}`);
  return next;
}

export async function removeCachedRecord(table: string, idOrOfflineId: string) {
  const cached = await getRawCachedTable(table);
  const target = String(idOrOfflineId || "");

  if (!target) return;

  await dbSet(
    cachedKeyForTable(table),
    cached.filter((item) => !getRecordIdentifiers(item).includes(target)),
    `removing cached ${table}`
  );
}

export async function clearSyncedDirtyCacheRecord(table: string, idOrOfflineId: string) {
  await removeCachedRecord(table, idOrOfflineId);
}

export async function clearPendingAndCached(table: string, idOrOfflineId: string) {
  await clearPending(table, idOrOfflineId);
  await removeCachedRecord(table, idOrOfflineId);
}

export async function savePending(table: string, record: AnyRecord) {
  const pendingRecord = await addPendingRecord(pendingKeyForTable(table), record);
  await upsertCachedRecord(table, pendingRecord);
  return pendingRecord;
}

export async function savePendingMany(table: string, records: AnyRecord[]) {
  const saved: AnyRecord[] = [];

  for (const record of records || []) {
    saved.push(await savePending(table, record));
  }

  return saved;
}

export async function markCachedRecordDeleted(table: string, idOrOfflineId: string, patch: AnyRecord = {}) {
  const cached = await getCachedTable(table);
  const target = String(idOrOfflineId || "");
  const now = nowIso();

  const record = cached.find((item) => getRecordIdentifiers(item).includes(target));
  if (!record) return null;

  if (String(record.id || "").startsWith("offline-")) {
    await removeCachedRecord(table, target);
    await clearPending(table, target);
    return { ...record, sync_status: "removed" };
  }

  const deletedRecord = {
    ...record,
    ...patch,
    operation: "delete",
    sync_status: "pending_delete",
    status: "deleted",
    updated_at: patch?.updated_at || now,
    updated_offline_at: patch?.updated_offline_at || now,
  };

  await savePending(table, deletedRecord);
  await patchCachedRecord(table, target, deletedRecord);

  return deletedRecord;
}

export async function getPending(table: string) {
  return getPendingRecords(pendingKeyForTable(table));
}

export async function clearPending(table: string, idOrOfflineId: string) {
  return clearPendingRecord(pendingKeyForTable(table), idOrOfflineId);
}

async function saveTypedOfflineRecord(table: string, prefix: string, record: AnyRecord, defaults: AnyRecord = {}) {
  const offlineRecord = await savePending(table, {
    ...defaults,
    ...record,
    id: record?.id || `offline-${prefix}-${makeUuid()}`,
  });

  await upsertCachedRecord(table, offlineRecord);
  return offlineRecord;
}

export async function saveOfflineProduct(product: AnyRecord) {
  return saveTypedOfflineRecord("products", "product", product, { status: "active" });
}

export async function getPendingProducts() {
  return getPendingRecords("pending_products");
}

export async function clearPendingProduct(idOrOfflineId: string) {
  await clearPendingRecord("pending_products", idOrOfflineId);
}

export async function updateOfflineProduct(idOrOfflineId: string, product: AnyRecord) {
  const record = await replacePendingRecord("pending_products", idOrOfflineId, product);
  await patchCachedRecord("products", idOrOfflineId, record);
  return record;
}

export async function saveOfflineSale(sale: AnyRecord) {
  return saveTypedOfflineRecord("sales", "sale", sale, { status: "pending_sync" });
}

export async function getPendingSales() {
  return getPendingRecords("pending_sales");
}

export async function clearPendingSale(idOrOfflineId: string) {
  await clearPendingRecord("pending_sales", idOrOfflineId);
}

export async function saveOfflineCustomer(customer: AnyRecord) {
  return saveTypedOfflineRecord("customers", "customer", customer);
}

export async function getPendingCustomers() {
  return getPendingRecords("pending_customers");
}

export async function clearPendingCustomer(idOrOfflineId: string) {
  await clearPendingRecord("pending_customers", idOrOfflineId);
}

export async function saveOfflineSupplier(supplier: AnyRecord) {
  return saveTypedOfflineRecord("suppliers", "supplier", supplier);
}

export async function getPendingSuppliers() {
  return getPendingRecords("pending_suppliers");
}

export async function clearPendingSupplier(idOrOfflineId: string) {
  await clearPendingRecord("pending_suppliers", idOrOfflineId);
}

export async function saveOfflineExpense(expense: AnyRecord) {
  return saveTypedOfflineRecord("expenses", "expense", expense);
}

export async function getPendingExpenses() {
  return getPendingRecords("pending_expenses");
}

export async function clearPendingExpense(idOrOfflineId: string) {
  await clearPendingRecord("pending_expenses", idOrOfflineId);
}

export async function saveOfflinePurchase(purchase: AnyRecord) {
  return saveTypedOfflineRecord("purchases", "purchase", purchase);
}

export async function getPendingPurchases() {
  return getPendingRecords("pending_purchases");
}

export async function clearPendingPurchase(idOrOfflineId: string) {
  await clearPendingRecord("pending_purchases", idOrOfflineId);
}

export async function saveOfflineStockMovement(movement: AnyRecord) {
  return saveTypedOfflineRecord("stock_movements", "stock-movement", {
    ...movement,
    id: movement?.id || `offline-stock-movement-${makeUuid()}`,
    operation: movement?.operation || "create",
    sync_status: movement?.sync_status || "pending",
  });
}

export async function getPendingStockMovements() {
  return getPendingRecords("pending_stock_movements");
}

export async function clearPendingStockMovement(idOrOfflineId: string) {
  await clearPendingRecord("pending_stock_movements", idOrOfflineId);
}

export async function saveOfflineStockBatch(batch: AnyRecord) {
  return saveTypedOfflineRecord("stock_batches", "stock-batch", {
    ...batch,
    id: batch?.id || `offline-stock-batch-${makeUuid()}`,
    operation: batch?.operation || "create",
    sync_status: batch?.sync_status || "pending",
  }, { status: "active" });
}

export async function saveOfflineStockAdjustment(adjustment: AnyRecord) {
  return saveOfflineStockMovement({
    ...adjustment,
    movement_type: adjustment?.movement_type || "adjustment",
    reference: adjustment?.reference || adjustment?.adjustment_no || "Stock adjustment",
  });
}

export async function patchCachedProductStock(productId: string, quantityChange: number, extraPatch: AnyRecord = {}) {
  const cachedProducts = await getCachedProducts();
  const target = String(productId || "");
  const now = nowIso();

  let found = false;

  const nextProducts = cachedProducts.map((product: AnyRecord) => {
    if (String(product?.id || "") !== target) return product;

    found = true;

    const currentStock = Number(product.stock ?? product.stock_quantity ?? 0);
    const nextStock = Math.max(0, currentStock + Number(quantityChange || 0));

    return {
      ...product,
      ...extraPatch,
      stock: nextStock,
      stock_quantity: nextStock,
      status: nextStock <= 0 ? "out_of_stock" : extraPatch?.status || (product.status === "out_of_stock" ? "active" : product.status),
      updated_offline_at: extraPatch?.updated_offline_at || now,
      sync_status: extraPatch?.sync_status || product.sync_status,
    };
  });

  if (!found && extraPatch?.id) {
    const nextStock = Math.max(0, Number(extraPatch.stock ?? extraPatch.stock_quantity ?? 0) + Number(quantityChange || 0));
    nextProducts.unshift({
      ...extraPatch,
      id: extraPatch.id,
      stock: nextStock,
      stock_quantity: nextStock,
      status: nextStock <= 0 ? "out_of_stock" : extraPatch.status || "active",
      updated_offline_at: now,
    });
  }

  await saveCachedProducts(nextProducts);

  const changedProduct = nextProducts.find((product: AnyRecord) => String(product?.id || "") === target);
  if (changedProduct) {
    await replacePendingRecord("pending_products", target, {
      ...changedProduct,
      operation: String(changedProduct.id || "").startsWith("offline-") ? "create" : "update",
      sync_status: "pending",
      updated_offline_at: now,
    });
  }

  return nextProducts;
}

export async function applyLocalStockChange(input: {
  tenant_id?: string | null;
  user_id?: string | null;
  product_id: string;
  product_name?: string | null;
  quantity_change: number;
  movement_type: string;
  reference?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  extra_product_patch?: AnyRecord;
}) {
  const products = await getCachedProducts();
  const product = products.find((row: AnyRecord) => String(row.id) === String(input.product_id));
  const currentStock = Number(product?.stock ?? product?.stock_quantity ?? 0);
  const nextStock = Math.max(0, currentStock + Number(input.quantity_change || 0));
  const now = nowIso();

  await patchCachedProductStock(input.product_id, input.quantity_change, {
    ...(input.extra_product_patch || {}),
    sync_status: "pending",
  });

  const movement = await saveOfflineStockMovement({
    id: `offline-stock-movement-${makeUuid()}`,
    tenant_id: input.tenant_id || product?.tenant_id || null,
    user_id: input.user_id || null,
    product_id: input.product_id,
    product_name: input.product_name || product?.name || "Unknown Product",
    movement_type: input.movement_type,
    quantity_change: input.quantity_change,
    stock_before: currentStock,
    stock_after: nextStock,
    reference: input.reference || null,
    reference_id: input.reference_id || null,
    notes: input.notes || null,
    created_at: now,
    created_offline_at: now,
    operation: "create",
    sync_status: "pending",
  });

  return { product: { ...(product || {}), stock: nextStock, stock_quantity: nextStock }, movement };
}


export async function saveOfflineCategory(category: AnyRecord) {
  return saveTypedOfflineRecord("categories", "category", category, { status: "active" });
}

export async function saveOfflineBrand(brand: AnyRecord) {
  return saveTypedOfflineRecord("brands", "brand", brand, { status: "active" });
}

export async function saveOfflineUnit(unit: AnyRecord) {
  return saveTypedOfflineRecord("units", "unit", unit, { status: "active" });
}

export async function saveOfflineTransfer(transfer: AnyRecord) {
  return saveTypedOfflineRecord("transfers", "transfer", transfer, { status: "pending_sync" });
}

export async function saveOfflineStockCount(count: AnyRecord) {
  return saveTypedOfflineRecord("stock_counts", "stock-count", count, { status: "pending_sync" });
}

export async function saveOfflineQuotation(quotation: AnyRecord) {
  return saveTypedOfflineRecord("quotations", "quotation", quotation, { status: "draft" });
}

export async function saveOfflineLoyalty(record: AnyRecord) {
  return saveTypedOfflineRecord("loyalty", "loyalty", record, { status: "active" });
}

export async function saveOfflineLoyaltyMember(record: AnyRecord) {
  return saveTypedOfflineRecord("loyalty_members", "loyalty-member", record, { status: "active" });
}

export async function saveOfflineStaff(record: AnyRecord) {
  return saveTypedOfflineRecord("staff", "staff", record, { status: "active" });
}

export async function saveOfflineBranch(record: AnyRecord) {
  return saveTypedOfflineRecord("branches", "branch", record, { status: "active" });
}

export async function saveOfflineWarehouse(record: AnyRecord) {
  return saveTypedOfflineRecord("warehouses", "warehouse", record, { status: "active" });
}

export async function saveOfflineWorkspaceMessage(record: AnyRecord) {
  return saveTypedOfflineRecord("workspace_messages", "workspace-message", record);
}

export async function saveOfflineWorkspaceMeeting(record: AnyRecord) {
  return saveTypedOfflineRecord("workspace_meetings", "workspace-meeting", record, { status: "pending_sync" });
}

export async function getCachedTableWithPending(table: string) {
  return getCachedTable(table);
}

export async function getPendingTableCount(table: string) {
  return (await getPending(table)).length;
}

export async function getCachedTableCount(table: string) {
  return (await getCachedTable(table)).length;
}

export async function primeOfflineTable(table: string, records: AnyRecord[]) {
  await saveCachedTable(table, records || []);
  return getCachedTable(table);
}

export async function getEnterpriseOfflineSummary() {
  const entries = await Promise.all(
    OFFLINE_CORE_TABLES.map(async (table) => {
      const [pending, cached] = await Promise.all([
        getPending(String(table)).catch(() => []),
        getCachedTable(String(table)).catch(() => []),
      ]);

      return {
        table: String(table),
        label: OFFLINE_MODULE_LABELS[String(table)] || String(table),
        pending: pending.length,
        cached: cached.length,
      };
    })
  );

  const totalPending = entries.reduce((sum, item) => sum + item.pending, 0);
  const totalCached = entries.reduce((sum, item) => sum + item.cached, 0);
  const syncErrors = await getOfflineSyncErrors().catch(() => []);
  const quarantined = await getQuarantinedOfflineRecords().catch(() => []);
  const coveredModules = entries.filter((item) => item.cached > 0 || item.pending > 0).length;

  return {
    entries,
    totalPending,
    totalCached,
    totalErrors: syncErrors.length,
    totalQuarantined: quarantined.length,
    coveredModules,
    totalModules: entries.length,
    coveragePercent: entries.length ? Math.round((coveredModules / entries.length) * 100) : 0,
  };
}

export async function getOfflineSummary() {
  const [
    pendingProducts,
    pendingSales,
    pendingCustomers,
    pendingSuppliers,
    pendingExpenses,
    pendingPurchases,
    pendingStockMovements,
    pendingCategories,
    pendingBrands,
    pendingUnits,
    pendingStockBatches,
    pendingSaleItems,
    pendingRefunds,
    pendingRefundItems,
    pendingWorkspaceMessages,
    pendingWorkspaceMembers,
    pendingTransfers,
    pendingStockCounts,
    pendingQuotations,
    pendingLoyalty,
    pendingLoyaltyMembers,
    pendingStaff,
    pendingBranches,
    pendingWarehouses,
    pendingEbmSettings,
    pendingWorkspaceMeetings,
    pendingWorkspaceChannels,
    pendingWorkspaceTasks,
    pendingWorkspacePolls,
    pendingWorkspaceReactions,
    pendingWorkspacePins,
  ] = await Promise.all([
    getPendingProducts(),
    getPendingSales(),
    getPendingCustomers(),
    getPendingSuppliers(),
    getPendingExpenses(),
    getPendingPurchases(),
    getPendingStockMovements(),
    getPending("categories"),
    getPending("brands"),
    getPending("units"),
    getPending("stock_batches"),
    getPending("sale_items"),
    getPending("sale_refunds"),
    getPending("sale_refund_items"),
    getPending("workspace_messages"),
    getPending("workspace_members"),
    getPending("transfers"),
    getPending("stock_counts"),
    getPending("quotations"),
    getPending("loyalty"),
    getPending("loyalty_members"),
    getPending("staff"),
    getPending("branches"),
    getPending("warehouses"),
    getPending("ebm_settings"),
    getPending("workspace_meetings"),
    getPending("workspace_channels"),
    getPending("workspace_tasks"),
    getPending("workspace_polls"),
    getPending("workspace_message_reactions"),
    getPending("workspace_message_pins"),
  ]);

  return {
    products: pendingProducts.length,
    sales: pendingSales.length,
    customers: pendingCustomers.length,
    suppliers: pendingSuppliers.length,
    expenses: pendingExpenses.length,
    purchases: pendingPurchases.length,
    stockMovements: pendingStockMovements.length,
    categories: pendingCategories.length,
    brands: pendingBrands.length,
    units: pendingUnits.length,
    stockBatches: pendingStockBatches.length,
    saleItems: pendingSaleItems.length,
    refunds: pendingRefunds.length,
    refundItems: pendingRefundItems.length,
    workspaceMessages: pendingWorkspaceMessages.length,
    workspaceMembers: pendingWorkspaceMembers.length,
    transfers: pendingTransfers.length,
    stockCounts: pendingStockCounts.length,
    quotations: pendingQuotations.length,
    loyalty: pendingLoyalty.length,
    loyaltyMembers: pendingLoyaltyMembers.length,
    staff: pendingStaff.length,
    branches: pendingBranches.length,
    warehouses: pendingWarehouses.length,
    ebmSettings: pendingEbmSettings.length,
    workspaceMeetings: pendingWorkspaceMeetings.length,
    workspaceChannels: pendingWorkspaceChannels.length,
    workspaceTasks: pendingWorkspaceTasks.length,
    workspacePolls: pendingWorkspacePolls.length,
    workspaceReactions: pendingWorkspaceReactions.length,
    workspacePins: pendingWorkspacePins.length,
    total:
      pendingProducts.length +
      pendingSales.length +
      pendingCustomers.length +
      pendingSuppliers.length +
      pendingExpenses.length +
      pendingPurchases.length +
      pendingStockMovements.length +
      pendingCategories.length +
      pendingBrands.length +
      pendingUnits.length +
      pendingStockBatches.length +
pendingSaleItems.length +
      pendingRefunds.length +
      pendingRefundItems.length +
      pendingWorkspaceMessages.length +
      pendingWorkspaceMembers.length +
      pendingTransfers.length +
      pendingStockCounts.length +
      pendingQuotations.length +
      pendingLoyalty.length +
      pendingLoyaltyMembers.length +
      pendingStaff.length +
      pendingBranches.length +
      pendingWarehouses.length +
      pendingEbmSettings.length +
      pendingWorkspaceMeetings.length +
      pendingWorkspaceChannels.length +
      pendingWorkspaceTasks.length +
      pendingWorkspacePolls.length +
      pendingWorkspaceReactions.length +
      pendingWorkspacePins.length,
  };
}


export async function repairOfflineSyncQueues() {
  const queueTables = [
    "products",
    "stock_movements",
    "stock_batches",
    "sales",
    "sale_items",
    "customers",
    "suppliers",
    "expenses",
    "purchases",
    "purchase_items",
    "categories",
    "brands",
    "units",
    "transfers",
    "stock_counts",
    "quotations",
    "branches",
    "warehouses",
    "ebm_settings",
    "workspace_messages",
    "workspace_meetings",
    "workspace_members",
    "workspace_channels",
    "workspace_message_reactions",
    "workspace_tasks",
    "workspace_polls",
    "workspace_message_pins",
    "loyalty",
    "loyalty_members",
    "staff",
  ];

  for (const table of queueTables) {
    const key = pendingKeyForTable(table);
    const rows = await dbGet<AnyRecord[]>(key, [], `reading pending ${table}`);
    await setPendingRecords(key, rows);
  }

  const legacyAdjustments = await dbGet<AnyRecord[]>(pendingKeyForTable("stock_adjustments"), [], "reading legacy adjustment queue");
  for (const adjustment of legacyAdjustments) {
    await savePending("stock_movements", {
      ...adjustment,
      movement_type: adjustment?.movement_type || "adjustment",
      reference: adjustment?.reference || adjustment?.adjustment_no || "Stock adjustment",
    });
  }
  await dbSet(pendingKeyForTable("stock_adjustments"), [], "clearing legacy adjustment queue");

  return getOfflineSummary();
}

export async function clearAllOfflineData() {
  await withOfflineTimeout(offlineDB.clear(), "clearing offline data", 12000);
}

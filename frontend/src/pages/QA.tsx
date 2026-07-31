import { useMemo, useState } from "react";
import {
  ShieldCheck,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Database,
  Package,
  ShoppingCart,
  ToggleLeft,
  Activity,
  RefreshCcw,
  Search,
  FileDown,
  Bug,
  Shield,
  ClipboardCheck,
  TestTube2,
  Server,
  Lock,
  HardDrive,
  Gauge,
  FileCheck2,
  Wifi,
  WifiOff,
  UploadCloud,
  ServerCog,
  Receipt,
  Users,
  Wrench,
  RotateCcw,
  FileText,
  Zap,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

const NAVY = "#0b3d5c";
const QA_CACHE_KEY = "qa_results_v2";

type TestStatus = "pending" | "running" | "pass" | "fail" | "warning";
type TestSeverity = "low" | "medium" | "high" | "critical";
type TestArea =
  | "Security"
  | "Workspace"
  | "Database"
  | "Offline Cache"
  | "Sync Queue"
  | "Inventory"
  | "POS"
  | "EBM"
  | "Storage"
  | "Reports"
  | "Performance"
  | "Compliance"
  | "Data Quality";

interface QATest {
  id: string;
  name: string;
  area: TestArea;
  description: string;
  status: TestStatus;
  severity: TestSeverity;
  detail?: string;
  recommendation?: string;
  count?: number;
  updated_at?: string;
}

type SafeCountMap = Record<string, number>;

const initialTests: QATest[] = [
  { id: "auth", name: "Authentication Context", area: "Security", description: "Verify logged-in user, active session, and role.", status: "pending", severity: "critical" },
  { id: "workspace", name: "Workspace Context", area: "Workspace", description: "Verify active tenant/workspace scope.", status: "pending", severity: "critical" },
  { id: "products-table", name: "Products Table Access", area: "Database", description: "Check products table access for current tenant.", status: "pending", severity: "high" },
  { id: "sales-table", name: "Sales Table Access", area: "Database", description: "Check sales table access for current tenant.", status: "pending", severity: "high" },
  { id: "purchases-table", name: "Purchases Table Access", area: "Database", description: "Check purchases table access for current tenant.", status: "pending", severity: "medium" },
  { id: "suppliers-table", name: "Suppliers Table Access", area: "Database", description: "Check suppliers table access without schema/RLS errors.", status: "pending", severity: "medium" },
  { id: "offline-products-cache", name: "Products Offline Cache", area: "Offline Cache", description: "Verify products exist in IndexedDB for offline POS and inventory.", status: "pending", severity: "critical" },
  { id: "offline-sales-cache", name: "Sales Offline Cache", area: "Offline Cache", description: "Verify sales cache exists for dashboard, reports, and sales screen.", status: "pending", severity: "high" },
  { id: "offline-customers-cache", name: "Customers Offline Cache", area: "Offline Cache", description: "Verify customers cache exists for offline customer selection.", status: "pending", severity: "medium" },
  { id: "sync-pending-sales", name: "Pending Sales Queue", area: "Sync Queue", description: "Check sales records waiting to upload.", status: "pending", severity: "high" },
  { id: "sync-pending-products", name: "Pending Products Queue", area: "Sync Queue", description: "Check product creates/updates/deletes waiting to sync.", status: "pending", severity: "high" },
  { id: "inventory-negative-stock", name: "Negative Stock Check", area: "Inventory", description: "Detect products with negative stock quantities.", status: "pending", severity: "critical" },
  { id: "inventory-missing-price", name: "Missing Product Prices", area: "Inventory", description: "Detect products missing selling price or cost price.", status: "pending", severity: "high" },
  { id: "inventory-duplicate-sku", name: "Duplicate SKU / Barcode", area: "Inventory", description: "Detect duplicate SKUs and barcodes.", status: "pending", severity: "high" },
  { id: "pos-readiness", name: "POS Readiness", area: "POS", description: "Verify POS has products and cached data needed to sell.", status: "pending", severity: "critical" },
  { id: "ebm-settings", name: "EBM Settings Readiness", area: "EBM", description: "Verify fiscal settings such as TIN, provider, device ID, and branch ID.", status: "pending", severity: "high" },
  { id: "storage-buckets", name: "Storage Readiness", area: "Storage", description: "Check configured storage buckets used by ShopCore.", status: "pending", severity: "medium" },
  { id: "reports-data", name: "Reports Data Availability", area: "Reports", description: "Verify sales, expenses, and products are available for reports.", status: "pending", severity: "medium" },
  { id: "performance-cache", name: "Cache Performance Index", area: "Performance", description: "Estimate whether offline cache has enough operational data for fast screens.", status: "pending", severity: "medium" },
  { id: "performance-data-volume", name: "Data Volume Readiness", area: "Performance", description: "Check if large tables can be loaded safely without blocking the UI.", status: "pending", severity: "medium" },
  { id: "compliance-tenant-scope", name: "Tenant Isolation Readiness", area: "Compliance", description: "Confirm data checks are scoped by tenant/workspace where possible.", status: "pending", severity: "critical" },
  { id: "compliance-ebm-docs", name: "EBM Certification Document Readiness", area: "Compliance", description: "Confirm core EBM certification fields are prepared for RRA VSDC review.", status: "pending", severity: "high" },
  { id: "data-quality-products", name: "Product Data Quality", area: "Data Quality", description: "Check products for missing names, SKU/barcode gaps, pricing gaps, and inactive data quality issues.", status: "pending", severity: "high" },
  { id: "data-quality-sales", name: "Sales Data Quality", area: "Data Quality", description: "Check sales records for missing totals, dates, payment method, and profit fields.", status: "pending", severity: "high" },
];

function safeNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getProductStock(product: any) {
  return safeNumber(product?.stock ?? product?.stock_quantity);
}

function getProductCost(product: any) {
  return safeNumber(product?.cost_price ?? product?.purchase_price ?? product?.unit_cost);
}

function getProductPrice(product: any) {
  return safeNumber(product?.selling_price ?? product?.price ?? product?.sale_price);
}

function isDeletedRecord(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted"
  );
}

function isPendingSync(row: any) {
  const status = String(row?.sync_status || "").toLowerCase();
  return (
    String(row?.id || "").startsWith("offline-") ||
    !!row?.offline_id ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at ||
    status.includes("pending")
  );
}

function scoreFromTests(tests: QATest[], area?: TestArea) {
  const scoped = area ? tests.filter((test) => test.area === area) : tests;
  if (!scoped.length) return 0;
  const points = scoped.reduce((sum, test) => {
    if (test.status === "pass") return sum + 1;
    if (test.status === "warning") return sum + 0.55;
    return sum;
  }, 0);
  return Math.round((points / scoped.length) * 100);
}

async function readCachedRows(key: string) {
  const rows = await getCachedTable(key);
  return Array.isArray(rows) ? rows.filter((row: any) => !isDeletedRecord(row)) : [];
}

async function countOnlineTable(table: string, tenantId?: string | null) {
  if (!tenantId) return { count: 0, error: new Error("No active tenant") };
  const { count, error } = await (supabase as any)
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  return { count: count ?? 0, error };
}

async function fetchOnlineRows(table: string, tenantId?: string | null, columns = "*") {
  if (!tenantId) return { data: [], error: new Error("No active tenant") };
  const { data, error } = await (supabase as any)
    .from(table)
    .select(columns)
    .eq("tenant_id", tenantId)
    .limit(5000);
  return { data: data || [], error };
}

function findDuplicates(values: any[]) {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  values
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
    .forEach((value) => {
      if (seen.has(value)) dupes.add(value);
      else seen.add(value);
    });
  return Array.from(dupes);
}

function getStatusBadge(status: TestStatus) {
  if (status === "pass") return <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600">Pass</Badge>;
  if (status === "fail") return <Badge variant="outline" className="rounded-full border-rose-500/30 bg-rose-500/10 text-rose-600">Fail</Badge>;
  if (status === "warning") return <Badge variant="outline" className="rounded-full border-orange-500/30 bg-orange-500/10 text-orange-600">Warning</Badge>;
  if (status === "running") return <Badge variant="outline" className="rounded-full border-sky-500/30 bg-sky-500/10 text-sky-600">Running</Badge>;
  return <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600">Pending</Badge>;
}

function getSeverityBadge(severity: TestSeverity) {
  if (severity === "critical") return <Badge variant="outline" className="rounded-full border-rose-600/30 bg-rose-600/10 text-rose-700">Critical</Badge>;
  if (severity === "high") return <Badge variant="outline" className="rounded-full border-rose-500/30 bg-rose-500/10 text-rose-600">High</Badge>;
  if (severity === "medium") return <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600">Medium</Badge>;
  return <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600">Low</Badge>;
}

function getStatusIcon(status: TestStatus) {
  if (status === "pass") return CheckCircle2;
  if (status === "fail") return XCircle;
  if (status === "warning") return AlertTriangle;
  if (status === "running") return RefreshCcw;
  return Clock;
}

function getAreaIcon(area: string) {
  const value = area.toLowerCase();
  if (value.includes("security")) return Lock;
  if (value.includes("workspace")) return Users;
  if (value.includes("database")) return Database;
  if (value.includes("offline")) return HardDrive;
  if (value.includes("sync")) return UploadCloud;
  if (value.includes("inventory")) return Package;
  if (value.includes("pos")) return ShoppingCart;
  if (value.includes("ebm")) return ServerCog;
  if (value.includes("storage")) return Server;
  if (value.includes("reports")) return FileText;
  if (value.includes("performance")) return Gauge;
  if (value.includes("compliance")) return ShieldCheck;
  if (value.includes("quality")) return FileCheck2;
  return TestTube2;
}

export default function QA() {
  const { user, tenantId, role, session } = useAuth();
  const qc = useQueryClient();

  const onlineReady = isOnline() && !isOfflineMode() && !!session?.access_token;

  const [tests, setTests] = useState<QATest[]>(initialTests);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [activeArea, setActiveArea] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastRun, setLastRun] = useState<string | null>(null);

  const counts = useQuery({
    queryKey: ["qa-v2-counts", tenantId, onlineReady ? "online" : "offline"],
    enabled: !!tenantId || !onlineReady,
    retry: onlineReady ? 1 : 0,
    refetchOnWindowFocus: onlineReady,
    queryFn: async (): Promise<SafeCountMap> => {
      const tables = ["products", "sales", "purchases", "suppliers", "customers", "expenses", "stock_movements"];
      const result: SafeCountMap = {};

      if (!onlineReady) {
        for (const table of tables) result[table] = (await readCachedRows(table)).length;
        return result;
      }

      for (const table of tables) {
        try {
          const { count } = await countOnlineTable(table, tenantId);
          result[table] = count;
        } catch {
          result[table] = 0;
        }
      }
      return result;
    },
  });

  const updateTest = (id: string, patch: Partial<QATest>) => {
    setTests((prev) => prev.map((test) => (test.id === id ? { ...test, ...patch, updated_at: new Date().toISOString() } : test)));
  };

  const setRunningTest = (id: string) => updateTest(id, { status: "running", detail: "Running check..." });

  const completeTest = (id: string, status: TestStatus, detail: string, recommendation?: string, count?: number) => {
    updateTest(id, { status, detail, recommendation, count });
  };

  const getProductsForQA = async () => {
    if (onlineReady) {
      try {
        const { data, error } = await fetchOnlineRows(
          "products",
          tenantId,
          "id, name, sku, barcode, stock, stock_quantity, selling_price, price, cost_price, purchase_price, status"
        );
        if (!error) {
          await saveCachedTable("products", data);
          return data;
        }
      } catch (error: any) {
        if (!isNetworkError(error)) throw error;
      }
    }
    return readCachedRows("products");
  };

  const getCachedOrOnlineRows = async (table: string) => {
    if (onlineReady) {
      try {
        const { data, error } = await fetchOnlineRows(table, tenantId);
        if (!error) {
          await saveCachedTable(table, data);
          return data;
        }
      } catch (error: any) {
        if (!isNetworkError(error)) throw error;
      }
    }
    return readCachedRows(table);
  };

  const runEnterpriseQA = async () => {
    setRunning(true);
    setTests(initialTests.map((test) => ({ ...test, status: "pending", detail: undefined, recommendation: undefined })));

    try {
      setRunningTest("auth");
      if (!user || (!session?.access_token && !isOfflineMode())) {
        completeTest("auth", "fail", "Missing authenticated user or active online session.", "Login online once, then reopen the app to create a valid offline session.");
      } else {
        completeTest("auth", "pass", `User ${user.email ?? user.id} · role ${role ?? "viewer"} · ${onlineReady ? "online" : "offline"} mode`);
      }

      setRunningTest("workspace");
      if (!tenantId) completeTest("workspace", "fail", "No active workspace/tenant ID found.", "Check AuthContext workspace loading and cached workspace fallback.");
      else completeTest("workspace", "pass", `Active tenant found: ${tenantId}`);

      const tableChecks = [
        ["products-table", "products"],
        ["sales-table", "sales"],
        ["purchases-table", "purchases"],
        ["suppliers-table", "suppliers"],
      ] as const;

      for (const [testId, table] of tableChecks) {
        setRunningTest(testId);
        if (onlineReady) {
          const { count, error } = await countOnlineTable(table, tenantId);
          completeTest(
            testId,
            error ? "fail" : "pass",
            error ? `${error.message}. Check schema cache, table columns, and RLS.` : `${count} ${table} records found online`,
            error ? `Review ${table} RLS policies and confirm tenant_id exists.` : undefined,
            count
          );
        } else {
          const cached = await readCachedRows(table);
          completeTest(testId, cached.length > 0 ? "pass" : "warning", `${cached.length} cached ${table} records found`, cached.length > 0 ? undefined : `Open ${table} online once to populate offline cache.`, cached.length);
        }
      }

      const cacheChecks = [
        ["offline-products-cache", "products", "Products cache supports offline POS and Products module."],
        ["offline-sales-cache", "sales", "Sales cache supports offline Dashboard, Sales, and Reports."],
        ["offline-customers-cache", "customers", "Customers cache supports offline customer selection."],
      ] as const;

      for (const [testId, table, okMessage] of cacheChecks) {
        setRunningTest(testId);
        const cached = await readCachedRows(table);
        completeTest(testId, cached.length > 0 ? "pass" : "warning", cached.length > 0 ? `${cached.length} cached records. ${okMessage}` : `No cached ${table} records found.`, cached.length > 0 ? undefined : `Visit the ${table} module online once, then sync/cache data.`, cached.length);
      }

      const syncChecks = [["sync-pending-sales", "sales"], ["sync-pending-products", "products"]] as const;
      for (const [testId, table] of syncChecks) {
        setRunningTest(testId);
        const cached = await readCachedRows(table);
        const pending = cached.filter(isPendingSync);
        completeTest(testId, pending.length === 0 ? "pass" : "warning", `${pending.length} pending ${table} record(s) waiting to sync.`, pending.length === 0 ? undefined : "Click Sync Data when internet returns and confirm the success toast.", pending.length);
      }

      const products = await getProductsForQA();

      setRunningTest("inventory-negative-stock");
      const negativeStock = products.filter((product: any) => getProductStock(product) < 0);
      completeTest("inventory-negative-stock", negativeStock.length === 0 ? "pass" : "fail", negativeStock.length === 0 ? "No products with negative stock found." : `${negativeStock.length} product(s) have negative stock.`, negativeStock.length === 0 ? undefined : "Review stock movements, refunds, and offline sale sync reversal logic.", negativeStock.length);

      setRunningTest("inventory-missing-price");
      const missingPrice = products.filter((product: any) => getProductPrice(product) <= 0 || getProductCost(product) <= 0);
      completeTest("inventory-missing-price", missingPrice.length === 0 ? "pass" : "warning", missingPrice.length === 0 ? "All products have selling and cost prices." : `${missingPrice.length} product(s) missing selling price or cost price.`, missingPrice.length === 0 ? undefined : "Update product selling_price and cost_price to keep profit calculations accurate.", missingPrice.length);

      setRunningTest("inventory-duplicate-sku");
      const duplicateSkus = findDuplicates(products.map((product: any) => product.sku));
      const duplicateBarcodes = findDuplicates(products.map((product: any) => product.barcode));
      const duplicateCount = duplicateSkus.length + duplicateBarcodes.length;
      completeTest("inventory-duplicate-sku", duplicateCount === 0 ? "pass" : "fail", duplicateCount === 0 ? "No duplicate SKU or barcode values found." : `${duplicateSkus.length} duplicate SKU(s), ${duplicateBarcodes.length} duplicate barcode(s).`, duplicateCount === 0 ? undefined : "Make SKU and barcode unique to prevent POS scanning and product lookup confusion.", duplicateCount);

      setRunningTest("pos-readiness");
      const cachedCustomers = await readCachedRows("customers");
      const activeProducts = products.filter((product: any) => !isDeletedRecord(product) && String(product.status || "active") !== "deleted");
      const sellableProducts = activeProducts.filter((product: any) => getProductStock(product) > 0 && getProductPrice(product) > 0);
      const posWarnings: string[] = [];
      if (!activeProducts.length) posWarnings.push("no products");
      if (!sellableProducts.length) posWarnings.push("no sellable stocked products");
      if (!cachedCustomers.length) posWarnings.push("no cached customers");
      completeTest("pos-readiness", posWarnings.length === 0 ? "pass" : "warning", posWarnings.length === 0 ? `POS ready: ${sellableProducts.length} sellable products and ${cachedCustomers.length} cached customers.` : `POS warning: ${posWarnings.join(", ")}.`, posWarnings.length === 0 ? undefined : "Cache products/customers online and confirm products have stock and selling prices.", sellableProducts.length);

      setRunningTest("ebm-settings");
      const ebmRows = await readCachedRows("ebm_settings");
      const ebm = ebmRows[0] || {};
      const ebmMissing = ["tin", "provider", "device_id", "branch_id"].filter((key) => !String(ebm?.[key] || "").trim());
      completeTest("ebm-settings", ebmMissing.length === 0 ? "pass" : "warning", ebmMissing.length === 0 ? "EBM settings contain TIN, provider, device ID, and branch ID." : `Missing EBM fields: ${ebmMissing.join(", ")}.`, ebmMissing.length === 0 ? undefined : "Open EBM Settings and complete the fiscal setup before live invoice sync.", ebmMissing.length);

      setRunningTest("storage-buckets");
      if (!onlineReady) {
        completeTest("storage-buckets", "warning", "Storage bucket check skipped in offline mode.", "Run this QA check online to verify product-images and qa-screenshots buckets.");
      } else {
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        const bucketNames = (buckets ?? []).map((bucket) => bucket.name);
        const hasProductImages = bucketNames.includes("product-images");
        const hasQaScreenshots = bucketNames.includes("qa-screenshots");
        completeTest("storage-buckets", bucketError ? "fail" : hasProductImages ? "pass" : "warning", bucketError ? bucketError.message : hasQaScreenshots ? "product-images and qa-screenshots buckets found." : hasProductImages ? "product-images found. qa-screenshots missing; screenshot QA disabled." : "product-images bucket missing.", bucketError || !hasProductImages ? "Create missing Supabase Storage buckets or review storage permissions." : undefined);
      }

      setRunningTest("reports-data");
      const salesRows = await getCachedOrOnlineRows("sales");
      const expenseRows = await getCachedOrOnlineRows("expenses");
      const reportIssues: string[] = [];
      if (!salesRows.length) reportIssues.push("sales");
      if (!products.length) reportIssues.push("products");
      if (!expenseRows.length) reportIssues.push("expenses");
      completeTest("reports-data", reportIssues.length === 0 ? "pass" : "warning", reportIssues.length === 0 ? "Reports have sales, expenses, and product data available." : `Reports missing/empty data sources: ${reportIssues.join(", ")}.`, reportIssues.length === 0 ? undefined : "Open and sync missing modules online to populate report cache.", reportIssues.length);

      setRunningTest("performance-cache");
      const cacheTables = ["products", "customers", "sales", "purchases", "suppliers", "expenses", "ebm_settings"];
      const cacheCounts: Record<string, number> = {};
      for (const table of cacheTables) cacheCounts[table] = (await readCachedRows(table)).length;
      const populatedCaches = Object.values(cacheCounts).filter((count) => count > 0).length;
      completeTest(
        "performance-cache",
        populatedCaches >= 4 ? "pass" : populatedCaches >= 2 ? "warning" : "fail",
        `${populatedCaches}/${cacheTables.length} major caches populated: ${Object.entries(cacheCounts).map(([key, value]) => `${key}:${value}`).join(", ")}.`,
        populatedCaches >= 4 ? undefined : "Open major modules online once and click Sync Data to populate offline cache for faster screens.",
        populatedCaches
      );

      setRunningTest("performance-data-volume");
      const totalOperationalRows = products.length + salesRows.length + expenseRows.length + (await readCachedRows("purchases")).length + (await readCachedRows("stock_movements")).length;
      completeTest(
        "performance-data-volume",
        totalOperationalRows < 10000 ? "pass" : totalOperationalRows < 25000 ? "warning" : "fail",
        `${totalOperationalRows} cached/loaded operational records detected.`,
        totalOperationalRows < 10000 ? undefined : "Add pagination, virtualized lists, and background aggregation for very large tenants.",
        totalOperationalRows
      );

      setRunningTest("compliance-tenant-scope");
      completeTest(
        "compliance-tenant-scope",
        tenantId ? "pass" : "fail",
        tenantId ? "Tenant scope is available for QA, data access, and export filtering." : "Tenant scope is missing.",
        tenantId ? undefined : "Fix AuthContext tenant loading and offline tenant fallback before production use."
      );

      setRunningTest("compliance-ebm-docs");
      const ebmDocsReady = ebmMissing.length === 0 && products.length > 0;
      completeTest(
        "compliance-ebm-docs",
        ebmDocsReady ? "pass" : "warning",
        ebmDocsReady ? "Core EBM readiness data exists for certification preparation." : "EBM readiness is incomplete for certification workflow.",
        ebmDocsReady ? undefined : "Complete TIN, provider, branch/device IDs, test cases, support SLA, and product mapping before RRA certification.",
        ebmMissing.length
      );

      setRunningTest("data-quality-products");
      const badProductRows = products.filter((product: any) => !String(product.name || "").trim() || (!String(product.sku || "").trim() && !String(product.barcode || "").trim()) || getProductPrice(product) <= 0);
      completeTest(
        "data-quality-products",
        badProductRows.length === 0 ? "pass" : badProductRows.length < 5 ? "warning" : "fail",
        badProductRows.length === 0 ? "Product master data looks clean." : `${badProductRows.length} product record(s) need data cleanup.`,
        badProductRows.length === 0 ? undefined : "Fix missing product names, SKU/barcodes, and selling prices before EBM/POS go-live.",
        badProductRows.length
      );

      setRunningTest("data-quality-sales");
      const badSalesRows = salesRows.filter((sale: any) => safeNumber(sale.total ?? sale.amount) <= 0 || !String(sale.created_at || sale.date || "").trim());
      completeTest(
        "data-quality-sales",
        badSalesRows.length === 0 ? "pass" : badSalesRows.length < 5 ? "warning" : "fail",
        badSalesRows.length === 0 ? "Sales data quality looks good." : `${badSalesRows.length} sale record(s) have missing totals or dates.`,
        badSalesRows.length === 0 ? undefined : "Review offline sale sync and ensure every sale stores total, date, payment method, cost, and profit fields.",
        badSalesRows.length
      );

      const report = {
        tenantId: tenantId || null,
        user: user?.email ?? user?.id ?? null,
        role: role || null,
        generatedAt: new Date().toISOString(),
        onlineReady,
        tests,
      };
      await saveCachedTable(QA_CACHE_KEY, [report]);
      await savePending("qa_results", { ...report, operation: "create", sync_status: "pending" } as any).catch(() => undefined);

      const now = new Date().toLocaleString();
      setLastRun(now);
      qc.invalidateQueries({ queryKey: ["qa-v2-counts", tenantId] });
      toast.success("QA v2.0 Enterprise verification completed");
    } catch (error: any) {
      toast.error(error?.message || "QA run failed");
    } finally {
      setRunning(false);
    }
  };

  const runAutoFix = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["products"] }),
      qc.invalidateQueries({ queryKey: ["sales"] }),
      qc.invalidateQueries({ queryKey: ["customers"] }),
      qc.invalidateQueries({ queryKey: ["suppliers"] }),
      qc.invalidateQueries({ queryKey: ["purchases"] }),
      qc.invalidateQueries({ queryKey: ["expenses"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    await saveCachedTable("qa_last_autofix", [{ id: `qa-autofix-${Date.now()}`, tenant_id: tenantId || null, user_id: user?.id || null, action: "refresh_queries", created_at: new Date().toISOString() }]);
    toast.success("Auto-fix completed: data queries refreshed and QA marker saved.");
  };

  const stats = useMemo(() => {
    const passed = tests.filter((test) => test.status === "pass").length;
    const failed = tests.filter((test) => test.status === "fail").length;
    const warnings = tests.filter((test) => test.status === "warning").length;
    const pending = tests.filter((test) => test.status === "pending").length;
    const runningCount = tests.filter((test) => test.status === "running").length;
    const completed = passed + failed + warnings;
    const progress = Math.round((completed / tests.length) * 100);
    const healthScore = scoreFromTests(tests);
    const offlineScore = scoreFromTests(tests, "Offline Cache");
    const syncScore = scoreFromTests(tests, "Sync Queue");
    const posScore = scoreFromTests(tests, "POS");
    const ebmScore = scoreFromTests(tests, "EBM");
    return { passed, failed, warnings, pending, runningCount, completed, progress, healthScore, offlineScore, syncScore, posScore, ebmScore };
  }, [tests]);

  const commandScores = useMemo(() => [
    { label: "Security", area: "Security" as TestArea, value: scoreFromTests(tests, "Security"), icon: Lock, color: "bg-rose-500/10 text-rose-700" },
    { label: "Database", area: "Database" as TestArea, value: scoreFromTests(tests, "Database"), icon: Database, color: "bg-blue-500/10 text-blue-700" },
    { label: "Offline", area: "Offline Cache" as TestArea, value: scoreFromTests(tests, "Offline Cache"), icon: HardDrive, color: "bg-emerald-500/10 text-emerald-700" },
    { label: "Sync", area: "Sync Queue" as TestArea, value: scoreFromTests(tests, "Sync Queue"), icon: UploadCloud, color: "bg-violet-500/10 text-violet-700" },
    { label: "Inventory", area: "Inventory" as TestArea, value: scoreFromTests(tests, "Inventory"), icon: Package, color: "bg-amber-500/10 text-amber-700" },
    { label: "EBM", area: "EBM" as TestArea, value: scoreFromTests(tests, "EBM"), icon: Receipt, color: "bg-orange-500/10 text-orange-700" },
    { label: "Performance", area: "Performance" as TestArea, value: scoreFromTests(tests, "Performance"), icon: Gauge, color: "bg-sky-500/10 text-sky-700" },
    { label: "Compliance", area: "Compliance" as TestArea, value: scoreFromTests(tests, "Compliance"), icon: ShieldCheck, color: "bg-indigo-500/10 text-indigo-700" },
  ], [tests]);

  const statusDistribution = useMemo(() => [
    { label: "Passed", value: stats.passed, className: "bg-emerald-500" },
    { label: "Warnings", value: stats.warnings, className: "bg-orange-500" },
    { label: "Failed", value: stats.failed, className: "bg-rose-500" },
    { label: "Pending", value: stats.pending, className: "bg-slate-400" },
  ], [stats]);

  const areas = useMemo(() => ["all", ...Array.from(new Set(tests.map((test) => test.area)))], [tests]);

  const filteredTests = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tests.filter((test) => {
      const matchesSearch = !q || test.name.toLowerCase().includes(q) || test.area.toLowerCase().includes(q) || test.description.toLowerCase().includes(q) || test.detail?.toLowerCase().includes(q) || test.recommendation?.toLowerCase().includes(q);
      const matchesArea = activeArea === "all" || test.area === activeArea;
      const matchesStatus = statusFilter === "all" || test.status === statusFilter;
      return matchesSearch && matchesArea && matchesStatus;
    });
  }, [tests, search, activeArea, statusFilter]);

  const failedOrWarningTests = tests.filter((test) => ["fail", "warning"].includes(test.status));
  const criticalIssues = tests.filter((test) => test.status === "fail" && ["critical", "high"].includes(test.severity));

  const exportRows = tests.map((test) => ({
    id: test.id,
    name: test.name,
    area: test.area,
    status: test.status,
    severity: test.severity,
    detail: test.detail || "",
    recommendation: test.recommendation || "",
    count: test.count ?? "",
  }));

  const exportCols = [
    { key: "id" as const, label: "ID" },
    { key: "name" as const, label: "Check" },
    { key: "area" as const, label: "Area" },
    { key: "status" as const, label: "Status" },
    { key: "severity" as const, label: "Severity" },
    { key: "detail" as const, label: "Detail" },
    { key: "recommendation" as const, label: "Recommendation" },
    { key: "count" as const, label: "Count" },
  ];

  const exportJson = () => {
    const payload = { tenantId, user: user?.email ?? user?.id ?? null, role, lastRun, onlineReady, stats, tests, generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `shopcore-qa-enterprise-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const resetQA = () => {
    setTests(initialTests);
    setLastRun(null);
    toast.info("QA checks reset");
  };

  return (
    <PageShell title="Verification / QA" description="Enterprise Quality Assurance Center for validating system health, online/offline functionality, synchronization reliability, POS operations, inventory integrity, EBM compliance readiness, security controls, and business continuity.">
      <PageBackground image={warehouseBg} opacity={0.04}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="relative overflow-hidden rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm xl:col-span-7">
              <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-blue-200/70" />
              <div className="pointer-events-none absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-cyan-200/40" />

              <div className="relative flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                  <ShieldCheck className="h-7 w-7" />
                  <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-4 border-blue-50 ${onlineReady ? "bg-emerald-500" : "bg-orange-500"}`} />
                </div>

                <div className="min-w-0">
                  <Badge className="mb-3 rounded-full bg-blue-600 px-4 py-1 text-white hover:bg-blue-600">
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    Quality Assurance Center
                  </Badge>
                  <h1 className="max-w-xl text-3xl font-black leading-tight tracking-tight text-slate-950">
                    Enterprise Verification Center
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Validate authentication, workspace scope, database access, offline cache, sync queues,
                    inventory integrity, POS readiness, EBM compliance, storage, reports, and performance.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-400 bg-rose-300 p-3">
                      <p className="text-xs font-medium text-emerald-900">System Health</p>
                      <p className="mt-1 text-base font-black text-emerald-700">{stats.healthScore}%</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-300 p-3">
                      <p className="text-xs font-medium text-cyan-700">Mode</p>
                      <p className="mt-1 truncate text-base font-black text-cyan-700">{onlineReady ? "Online Live" : "Offline Cache"}</p>
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-300 p-3">
                      <p className="text-xs font-medium text-violet-700">Last Run</p>
                      <p className="mt-1 truncate text-base font-black text-violet-700">{lastRun ?? "Not run"}</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-300 p-3">
                      <p className="text-xs font-medium text-orange-700">Tenant</p>
                      <p className="mt-1 truncate text-base font-black text-orange-700">{tenantId ? tenantId.slice(0, 8) : "Missing"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:col-span-5">
              <div className="relative h-[132px] overflow-hidden rounded-3xl bg-blue-600 p-5 text-white shadow-sm">
                <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15" />
                <div className="relative flex h-full flex-col justify-between">
                  <CheckCircle2 className="h-6 w-6" />
                  <div><p className="text-sm font-bold">Passed</p><p className="font-data text-3xl font-black">{stats.passed}</p><p className="mt-1 w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-bold">successful checks</p></div>
                </div>
              </div>
              <div className="relative h-[132px] overflow-hidden rounded-3xl bg-emerald-600 p-5 text-white shadow-sm">
                <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15" />
                <div className="relative flex h-full flex-col justify-between">
                  <AlertTriangle className="h-6 w-6" />
                  <div><p className="text-sm font-bold">Warnings</p><p className="font-data text-3xl font-black">{stats.warnings}</p><p className="mt-1 w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-bold">needs review</p></div>
                </div>
              </div>
              <div className="relative h-[132px] overflow-hidden rounded-3xl bg-orange-600 p-5 text-white shadow-sm">
                <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15" />
                <div className="relative flex h-full flex-col justify-between">
                  <XCircle className="h-6 w-6" />
                  <div><p className="text-sm font-bold">Failed</p><p className="font-data text-3xl font-black">{stats.failed}</p><p className="mt-1 w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-bold">blocking checks</p></div>
                </div>
              </div>
              <div className="relative h-[132px] overflow-hidden rounded-3xl bg-violet-600 p-5 text-white shadow-sm">
                <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15" />
                <div className="relative flex h-full flex-col justify-between">
                  <Activity className="h-6 w-6" />
                  <div><p className="text-sm font-bold">Running</p><p className="font-data text-3xl font-black">{stats.runningCount}</p><p className="mt-1 w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-bold">live checks</p></div>
                </div>
              </div>
            </div>
          </div>

          {!onlineReady && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70"><WifiOff className="h-5 w-5" /></div>
                <div><p className="font-bold">QA is running in offline mode</p><p className="text-sm opacity-90">Online table and storage checks will use cached records or show warnings until internet and online login return.</p></div>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-5">
            {[
              { label: "QA Progress", value: stats.progress, icon: Gauge, helper: `${stats.completed}/${tests.length} completed`, box: "border-blue-200 bg-blue-50 text-blue-700" },
              { label: "Offline Ready", value: stats.offlineScore, icon: HardDrive, helper: "cache coverage", box: "border-emerald-200 bg-emerald-50 text-emerald-700" },
              { label: "Sync Ready", value: stats.syncScore, icon: UploadCloud, helper: "queue health", box: "border-cyan-200 bg-cyan-50 text-cyan-700" },
              { label: "POS Ready", value: stats.posScore, icon: ShoppingCart, helper: "sales readiness", box: "border-orange-200 bg-orange-50 text-orange-700" },
              { label: "EBM Ready", value: stats.ebmScore, icon: Receipt, helper: "fiscal setup", box: "border-violet-200 bg-violet-50 text-violet-700" },
            ].map((item) => (
              <div key={item.label} className={`rounded-3xl border p-4 shadow-sm ${item.box}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold">{item.value}%</span>
                </div>
                <p className="mt-3 text-sm font-bold">{item.label}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
                  <div className="h-full rounded-full bg-current" style={{ width: `${item.value}%` }} />
                </div>
                <p className="mt-2 truncate text-xs font-medium opacity-80">{item.helper}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border bg-blue-50 p-4 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b3d5c]/10 text-[#0b3d5c]">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black">Enterprise Health Command Grid</h3>
                    <p className="text-xs text-muted-foreground">Area-by-area readiness scoring for production decisions.</p>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full">{stats.healthScore}% overall</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {commandScores.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveArea(item.area)}
                    className={`rounded-3xl border p-4 text-left transition hover:-translate-y-1 hover:shadow-md ${item.color}`}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold">{item.value}%</span>
                    </div>
                    <p className="text-sm font-black">{item.label}</p>
                    <div className="mt-3 h-2 rounded-full bg-white/70">
                      <div className="h-2 rounded-full bg-current" style={{ width: `${item.value}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border bg-violet-50 p-4 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
                  <Gauge className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black">Result Distribution</h3>
                  <p className="text-xs text-muted-foreground">Visual QA outcome balance.</p>
                </div>
              </div>

              <div className="space-y-4">
                {statusDistribution.map((item) => {
                  const percent = tests.length > 0 ? Math.round((Number(item.value) / tests.length) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{item.label}</span>
                        <span className="font-bold">{item.value} · {percent}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${item.className}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="relative overflow-hidden rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm xl:col-span-2">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl" />
                <div className="absolute -right-20 -top-16 h-72 w-72 rounded-full bg-violet-200/35 blur-3xl" />
                <div className="absolute bottom-[-7rem] left-1/3 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/90 via-sky-50/65 to-emerald-50/55" />
              </div>

              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <Badge className="mb-3 rounded-full border border-cyan-200 bg-white/75 px-3 py-1 text-[#0b3d5c] shadow-sm hover:bg-white/75">
                    <Zap className="mr-1 h-3.5 w-3.5 text-cyan-600" />
                    One-Click Repair Center
                  </Badge>
                  <h3 className="max-w-3xl text-2xl font-black leading-tight text-slate-950">
                    Repair cache, refresh dashboards, recheck sync, and prepare production readiness.
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Use this command center after fixing errors, changing schema, updating RLS, importing products, or reconnecting from offline mode.
                  </p>
                </div>
                <Button
                  onClick={runAutoFix}
                  className="rounded-2xl bg-gradient-to-r from-cyan-600 to-[#0b3d5c] px-6 text-white shadow-lg shadow-cyan-900/20 hover:from-cyan-700 hover:to-[#08304a]"
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  Run Smart Repair
                </Button>
              </div>

              <div className="relative mt-5 grid gap-3 md:grid-cols-4">
                {[
                  { label: "Refresh Queries", helper: "Products, sales, reports", tone: "from-cyan-50 to-white border-cyan-100 text-cyan-700" },
                  { label: "Cache Marker", helper: "Offline QA marker", tone: "from-emerald-50 to-white border-emerald-100 text-emerald-700" },
                  { label: "Sync Review", helper: `${stats.pending} pending checks`, tone: "from-blue-50 to-white border-blue-100 text-blue-700" },
                  { label: "Risk Review", helper: `${criticalIssues.length} priority issue(s)`, tone: "from-amber-50 to-white border-amber-100 text-amber-700" },
                ].map((item) => (
                  <div key={item.label} className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm backdrop-blur ${item.tone}`}>
                    <p className="font-black text-slate-950">{item.label}</p>
                    <p className="mt-1 text-xs font-medium opacity-80">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black">Executive Decision</h3>
                  <p className="text-xs text-muted-foreground">Go-live readiness signal.</p>
                </div>
              </div>
              <div className={`rounded-3xl border p-5 ${stats.failed > 0 ? "border-rose-200 bg-rose-50 text-rose-800" : stats.warnings > 0 ? "border-orange-200 bg-orange-50 text-orange-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                <p className="text-sm font-medium">Recommendation</p>
                <p className="mt-2 text-2xl font-black">
                  {stats.failed > 0 ? "Fix Before Launch" : stats.warnings > 0 ? "Launch With Caution" : "Production Ready"}
                </p>
                <p className="mt-2 text-sm opacity-80">
                  {stats.failed > 0 ? "Critical checks failed and should be repaired before client handover." : stats.warnings > 0 ? "Core system works, but warnings should be reviewed." : "No blocking QA issues detected."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-h-[48px] flex-1 items-center gap-3 rounded-2xl bg-muted/50 px-4">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input placeholder="Search QA checks, areas, details, or recommendations..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-12 rounded-2xl xl:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="running">Running</SelectItem><SelectItem value="pass">Pass</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="fail">Fail</SelectItem>
                </SelectContent>
              </Select>

              <Button className="h-12 rounded-2xl border border-orange-200 bg-orange-50 px-5 text-orange-700 hover:bg-orange-100" onClick={resetQA}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button>
              <Button className="h-12 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-emerald-700 hover:bg-emerald-100" onClick={runAutoFix}><Wrench className="mr-2 h-4 w-4" />Auto-Fix</Button>
              <Button onClick={runEnterpriseQA} disabled={running} className="h-12 rounded-2xl bg-blue-600 px-5 text-white hover:bg-blue-700">{running ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}Run QA v2.0</Button>
              <Button className="h-12 rounded-2xl border border-violet-200 bg-violet-50 px-5 text-violet-700 hover:bg-violet-100" onClick={exportJson}><FileDown className="mr-2 h-4 w-4" />JSON</Button>
              <ExportMenu onCSV={() => exportToCSV(exportRows, "qa_v2_enterprise", exportCols)} onPDF={() => exportToPDF(exportRows, "qa_v2_enterprise", "ShopCore QA v2.0 Enterprise Report", exportCols, { subtitle: `${tests.length} enterprise QA checks`, summary: [{ label: "System Health", value: `${stats.healthScore}%` }, { label: "Offline Ready", value: `${stats.offlineScore}%` }, { label: "Sync Ready", value: `${stats.syncScore}%` }, { label: "POS Ready", value: `${stats.posScore}%` }, { label: "EBM Ready", value: `${stats.ebmScore}%` }, { label: "Failed", value: String(stats.failed) }, { label: "Warnings", value: String(stats.warnings) }] })} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {areas.map((area) => (
                <button key={area} type="button" onClick={() => setActiveArea(area)} className={`rounded-full border px-4 py-2 text-xs font-medium transition ${activeArea === area ? "bg-[#0b3d5c] text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>{area === "all" ? "All Checks" : area}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {filteredTests.length === 0 ? (
                <div className="rounded-3xl border bg-card py-16 text-center text-muted-foreground shadow-sm"><TestTube2 className="mx-auto mb-3 h-12 w-12 opacity-30" /><p className="font-medium">No QA checks found</p><p className="text-sm">Try a different search, status, or area filter.</p></div>
              ) : (
                filteredTests.map((test) => {
                  const StatusIcon = getStatusIcon(test.status);
                  const AreaIcon = getAreaIcon(test.area);
                  return (
                    <div key={test.id} className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm transition hover:shadow-md">
                      <div className="flex gap-4">
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${test.status === "pass" ? "bg-emerald-500/10 text-emerald-600" : test.status === "fail" ? "bg-rose-500/10 text-rose-600" : test.status === "warning" ? "bg-orange-500/10 text-orange-600" : test.status === "running" ? "bg-sky-500/10 text-sky-600" : "bg-amber-500/10 text-amber-600"}`}>
                          <StatusIcon className={`h-6 w-6 ${test.status === "running" ? "animate-spin" : ""}`} />
                        </div>
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{test.name}</h3>{getStatusBadge(test.status)}{getSeverityBadge(test.severity)}<Badge variant="outline" className="rounded-full"><AreaIcon className="mr-1 h-3 w-3" />{test.area}</Badge></div>
                          <p className="text-sm leading-6 text-muted-foreground">{test.description}</p>
                          {test.detail && <div className={`mt-3 rounded-2xl border p-3 text-xs ${test.status === "fail" ? "border-rose-500/20 bg-rose-500/10 text-rose-700" : test.status === "warning" ? "border-orange-500/20 bg-orange-500/10 text-orange-700" : "bg-muted/50 text-muted-foreground"}`}>{test.detail}</div>}
                          {test.recommendation && <div className="mt-3 rounded-2xl border bg-blue-500/10 p-3 text-xs text-blue-700"><b>Recommended fix:</b> {test.recommendation}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600"><Database className="h-5 w-5" /></div><div><h3 className="font-black">Current Counts</h3><p className="text-xs text-muted-foreground">{onlineReady ? "Online counts" : "Cached counts"} by table.</p></div></div>
                <div className="space-y-3">
                  {[["Products", counts.data?.products ?? 0, "text-sky-700 bg-sky-500/10"], ["Sales", counts.data?.sales ?? 0, "text-emerald-700 bg-emerald-500/10"], ["Purchases", counts.data?.purchases ?? 0, "text-amber-700 bg-amber-500/10"], ["Customers", counts.data?.customers ?? 0, "text-blue-700 bg-blue-500/10"], ["Expenses", counts.data?.expenses ?? 0, "text-rose-700 bg-rose-500/10"], ["Stock Movements", counts.data?.stock_movements ?? 0, "text-purple-700 bg-purple-500/10"]].map(([label, value, color]) => <div key={String(label)} className={`flex items-center justify-between rounded-2xl p-3 ${color}`}><span className="text-sm">{label}</span><span className="font-bold">{value}</span></div>)}
                </div>
              </div>

              <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600"><Bug className="h-5 w-5" /></div><div><h3 className="font-black">Issues & Warnings</h3><p className="text-xs text-muted-foreground">Failed and warning checks.</p></div></div>
                {failedOrWarningTests.length === 0 ? <div className="rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-700">No failed checks or warnings yet.</div> : <div className="space-y-3">{failedOrWarningTests.map((test) => <div key={test.id} className={`rounded-2xl p-3 ${test.status === "fail" ? "bg-rose-500/10" : "bg-orange-500/10"}`}><p className={`font-semibold ${test.status === "fail" ? "text-rose-700" : "text-orange-700"}`}>{test.name}</p><p className={`mt-1 text-xs ${test.status === "fail" ? "text-rose-700/80" : "text-orange-700/80"}`}>{test.detail || test.description}</p></div>)}</div>}
              </div>

              <div className="rounded-3xl border bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600"><Zap className="h-5 w-5" /></div><div><h3 className="font-black">Priority Actions</h3><p className="text-xs text-muted-foreground">Most important fixes first.</p></div></div>
                {criticalIssues.length === 0 ? <div className="rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-700">No critical failed checks.</div> : <div className="space-y-3 text-sm text-muted-foreground">{criticalIssues.map((test) => <div key={test.id} className="rounded-2xl bg-muted/50 p-3"><b>{test.name}:</b> {test.recommendation || test.detail || "Needs review."}</div>)}</div>}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="border-b p-5"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600"><ClipboardCheck className="h-5 w-5" /></div><div><h3 className="font-black">QA Directory</h3><p className="text-xs text-muted-foreground">Compact enterprise verification list.</p></div></div></div>
            <div className="overflow-x-auto"><div className="min-w-[1000px]"><div className="grid grid-cols-12 gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase text-muted-foreground"><div className="col-span-3">Check</div><div className="col-span-2">Area</div><div className="col-span-2">Status</div><div className="col-span-1">Severity</div><div className="col-span-4">Result</div></div>{filteredTests.map((test) => <div key={test.id} className="grid grid-cols-12 items-center gap-4 border-b px-5 py-4 last:border-b-0"><div className="col-span-3 flex items-center gap-2"><TestTube2 className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{test.name}</span></div><div className="col-span-2 text-sm text-muted-foreground">{test.area}</div><div className="col-span-2">{getStatusBadge(test.status)}</div><div className="col-span-1">{getSeverityBadge(test.severity)}</div><div className="col-span-4 truncate text-sm text-muted-foreground">{test.detail || test.description}</div></div>)}</div></div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-sm"><div className="grid gap-4 text-sm md:grid-cols-5"><div><p className="text-xs text-muted-foreground">Verified By</p><p className="font-semibold">{user?.email ?? user?.id ?? "Unknown"}</p></div><div><p className="text-xs text-muted-foreground">Role</p><p className="font-semibold uppercase">{role ?? "viewer"}</p></div><div><p className="text-xs text-muted-foreground">Tenant</p><p className="truncate font-semibold">{tenantId ?? "No tenant"}</p></div><div><p className="text-xs text-muted-foreground">Mode</p><p className="font-semibold">{onlineReady ? "Online" : "Offline"}</p></div><div><p className="text-xs text-muted-foreground">Version</p><p className="font-semibold">QA v2.0 Enterprise</p></div></div></div>
        </div>
      </PageBackground>
    </PageShell>
  );
}

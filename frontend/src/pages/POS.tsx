import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  ShoppingBag,
  X,
  Minus,
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  User,
  CheckCircle2,
  ScanBarcode,
  Printer,
  Package,
  Phone,
  FileDigit,
  Store,
  RotateCcw,
  Check,
  QrCode,
  MousePointerClick,
  Calculator,
  Wallet,
  WifiOff,
  Wifi,
  UploadCloud,
  Activity,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Gauge,
  PackageCheck,
  PackageX,
  Download,
  ReceiptText,
  Layers3,
  Clock3,
} from "lucide-react";
import { useProducts, type DbProduct } from "@/hooks/useSupabaseData";
import { salesApi } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { isOfflineMode } from "@/lib/offlineAuth";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import {
  getCachedProducts,
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedProducts,
  saveCachedTable,
  saveOfflineSale,
} from "@/lib/offlineStore";
import { toast } from "sonner";
import boutiqueBg from "@/assets/bg-boutique.jpg";

interface StockBatch {
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
  created_at: string;
  sync_status?: string;
  offline_id?: string;
}

interface CartItem {
  product: DbProduct;
  quantity: number;
  discount: number;

  unitPrice: number;
  unitCost: number;
  stockBefore: number;
  batchId?: string | null;
  batchNo?: string | null;
  batchRemaining?: number;
  priceSource?: "product" | "batch" | "manual";
}

interface ReceiptSale {
  receiptNo: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  customerTin: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  costTotal: number;
  grossProfit: number;
  paid: number;
  due: number;
  method: string;
  change: number;
  momoNumber?: string;
  momoCode?: string;
  date: string;
  offline?: boolean;
  syncStatus?: string;
  ebmStatus?: "not_synced" | "not_configured" | "pending" | "success" | "failed" | "pending_sync";
  ebmReceiptNo?: string | null;
  ebmQrCode?: string | null;
  ebmVerificationCode?: string | null;
  ebmResponse?: any;
}


interface HeldSale {
  id: string;
  tenant_id: string | null;
  cashier_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_tin: string;
  cart: CartItem[];
  selected_product_ids: string[];
  total: number;
  items: number;
  created_at: string;
  updated_at: string;
}

type SplitPayment = {
  method: "cash" | "card" | "mobile" | "bank";
  amount: number;
  reference?: string;
};

type CashSession = {
  id: string;
  opened_at: string;
  opening_cash: number;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  status: "open" | "closed";
};

const HELD_SALES_KEY = "shopcore_pos_held_sales";
const CASH_SESSION_KEY = "shopcore_pos_cash_session";

const BUSINESS_NAME = "ShopCore POS";
const BUSINESS_TIN = "TIN: Not configured";
const BRANCH_NAME = "Main Branch";
const RECEIPT_NOTICE = "NOT A FISCAL EBM RECEIPT";

const paymentMethods = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "mobile", label: "Mobile Money", icon: Smartphone },
  { id: "bank", label: "Bank Transfer", icon: Building2 },
  { id: "split", label: "Split Payment", icon: Layers3 },
  { id: "layaway", label: "Layaway", icon: Wallet },
];

function getPaymentButtonClass(methodId: string, selectedPayment: string) {
  if (selectedPayment !== methodId) return "border-border bg-background hover:bg-muted";

  switch (methodId) {
    case "cash":
      return "border-emerald-600 bg-emerald-50 text-emerald-700";
    case "card":
      return "border-violet-600 bg-violet-50 text-violet-700";
    case "mobile":
      return "border-cyan-600 bg-cyan-50 text-cyan-700";
    case "bank":
      return "border-blue-600 bg-blue-50 text-blue-700";
    case "split":
      return "border-orange-600 bg-orange-50 text-orange-700";
    case "layaway":
      return "border-rose-600 bg-rose-50 text-rose-700";
    default:
      return "border-emerald-600 bg-emerald-50 text-emerald-700";
  }
}

function money(value: number) {
  return `RWF ${Number(value || 0).toLocaleString()}`;
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getProductSellingPrice(product: DbProduct) {
  return safeNumber(
    (product as any).selling_price ||
      (product as any).sale_price ||
      (product as any).price ||
      0
  );
}

function getProductCost(product: DbProduct) {
  return safeNumber(
    (product as any).cost_price ||
      (product as any).purchase_price ||
      (product as any).unit_cost ||
      (product as any).average_cost ||
      0
  );
}

function getProductStock(product: DbProduct) {
  return safeNumber((product as any).stock ?? (product as any).stock_quantity ?? 0);
}

function getTaxRate(product: DbProduct) {
  return safeNumber((product as any).taxRate || (product as any).tax_rate || 0);
}

function makeCartItem(product: DbProduct, quantity = 1, batch?: StockBatch | null): CartItem {
  return {
    product,
    quantity,
    discount: 0,
    unitPrice: batch ? safeNumber(batch.selling_price) : getProductSellingPrice(product),
    unitCost: batch ? safeNumber(batch.cost_price) : getProductCost(product),
    stockBefore: getProductStock(product),
    batchId: batch?.id || null,
    batchNo: batch?.batch_no || null,
    batchRemaining: batch ? safeNumber(batch.quantity_remaining) : getProductStock(product),
    priceSource: batch ? "batch" : "product",
  };
}

function getCartKey(item: CartItem) {
  return `${item.product.id}:${item.batchId || "product"}`;
}

function getBatchStockLimit(item: CartItem) {
  return safeNumber(item.batchRemaining || getProductStock(item.product));
}

function getCartUnitPrice(item: CartItem) {
  return safeNumber(item.unitPrice || getProductSellingPrice(item.product));
}

function getCartUnitCost(item: CartItem) {
  return safeNumber(item.unitCost || getProductCost(item.product));
}

function getCartStockBefore(item: CartItem) {
  return safeNumber(item.stockBefore || getProductStock(item.product));
}

function getPaymentLabel(method: string) {
  return paymentMethods.find((p) => p.id === method)?.label || method;
}

function getLineTotal(item: CartItem) {
  const price = getCartUnitPrice(item);
  return price * item.quantity * (1 - item.discount / 100);
}

function shouldUseOfflineStorage() {
  return !isOnline() || isOfflineMode();
}

function shouldSaveSaleOffline(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();

  /*
   * A sale the server actively refused must never be queued for later.
   *
   * The checks below are deliberately loose — they match on message text — so
   * without this an "insufficient stock" 409 would be filed as an offline sale
   * and replayed against the same stock that was not there the first time. Any
   * answer from the server means the server was reached, so there is nothing
   * to retry offline; only a failure to reach it at all qualifies.
   */
  const status = (error as any)?.status;
  if (typeof status === "number" && status >= 400 && status !== 401) return false;

  return (
    shouldUseOfflineStorage() ||
    isNetworkError(error) ||
    // The API client reports an unreachable backend as status 0.
    status === 0 ||
    message.includes("cannot reach the shopcore api") ||
    message.includes("you appear to be offline") ||
    message.includes("failed to fetch") ||
    message.includes("err_name_not_resolved") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed") ||
    message.includes("401") ||
    message.includes("unauthorized") ||
    message.includes("jwt") ||
    message.includes("session")
  );
}

function getRecordId(record: any) {
  return String(record?.id || record?.offline_id || "");
}

function mergeRecordsById<T extends Record<string, any>>(records: T[]) {
  const map = new Map<string, T>();

  for (const record of records || []) {
    const key = getRecordId(record) || `unknown-${map.size}`;

    if (!map.has(key)) {
      map.set(key, record);
      continue;
    }

    const existing = map.get(key)!;
    const existingTime = new Date(
      existing?.updated_offline_at ||
        existing?.updated_at ||
        existing?.created_at ||
        existing?.created_offline_at ||
        0
    ).getTime();

    const nextTime = new Date(
      record?.updated_offline_at ||
        record?.updated_at ||
        record?.created_at ||
        record?.created_offline_at ||
        0
    ).getTime();

    if (nextTime >= existingTime) map.set(key, record);
  }

  return Array.from(map.values());
}

function sortNewestFirst<T extends Record<string, any>>(records: T[]) {
  return [...(records || [])].sort((a, b) => {
    const aTime = new Date(
      a?.created_at || a?.date || a?.created_offline_at || a?.updated_offline_at || 0
    ).getTime();
    const bTime = new Date(
      b?.created_at || b?.date || b?.created_offline_at || b?.updated_offline_at || 0
    ).getTime();

    return bTime - aTime;
  });
}


function getProductLifecycleStatus(product: any) { return String(product?.status || "active").toLowerCase().trim(); }
function isProductArchived(product: any) { const status = getProductLifecycleStatus(product); const operation = String(product?.operation || "").toLowerCase(); const syncStatus = String(product?.sync_status || "").toLowerCase(); return ["inactive", "archived", "deleted", "disabled", "blocked", "discontinued", "pending_delete"].includes(status) || operation === "delete" || syncStatus === "pending_delete"; }
function isProductSellable(product: any) { return !!product?.id && !isProductArchived(product) && getProductStock(product) > 0 && getProductSellingPrice(product) > 0; }
function getUnsellableCartItems(items: CartItem[]) { return (items || []).filter((item) => !isProductSellable(item.product)); }
function stripUnsellableCartItems(items: CartItem[]) { return (items || []).filter((item) => isProductSellable(item.product)); }

function normalizeProductStock(product: any, stock: number) {
  const safeStock = Math.max(0, safeNumber(stock));
  const minStock = safeNumber(product?.min_stock ?? product?.min_stock_level ?? 0);

  return {
    ...product,
    stock: safeStock,
    stock_quantity: safeStock,
    status:
      safeStock <= 0
        ? "out_of_stock"
        : safeStock <= minStock
          ? "low_stock"
          : "active",
    updated_offline_at: new Date().toISOString(),
  };
}


function readHeldSales(): HeldSale[] {
  try {
    return JSON.parse(localStorage.getItem(HELD_SALES_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeHeldSales(rows: HeldSale[]) {
  try {
    localStorage.setItem(HELD_SALES_KEY, JSON.stringify(rows || []));
  } catch {
    // localStorage may be unavailable in restricted browser modes.
  }
}

function readCashSession(): CashSession | null {
  try {
    return JSON.parse(localStorage.getItem(CASH_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function writeCashSession(session: CashSession | null) {
  try {
    if (!session) localStorage.removeItem(CASH_SESSION_KEY);
    else localStorage.setItem(CASH_SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage may be unavailable in restricted browser modes.
  }
}

function getFiscalStatusLabel(sale?: ReceiptSale | null) {
  const status = String(sale?.ebmStatus || sale?.syncStatus || "").toLowerCase();
  if (sale?.offline) return "OFFLINE / QUEUED";
  if (status === "success") return "FISCALIZED";
  if (status === "failed") return "FAILED";
  if (status === "not_configured") return "NOT CONFIGURED";
  if (status.includes("pending")) return "PENDING";
  return "NOT SYNCED";
}

function getFiscalReceiptNo(sale?: ReceiptSale | null) {
  return sale?.ebmReceiptNo || "Pending";
}

function getFiscalQrText(sale?: ReceiptSale | null) {
  return sale?.ebmQrCode || sale?.ebmVerificationCode || "Pending";
}

async function submitSaleToEBM(tenantId: string, saleId: string) {
  const { data, error } = await supabase.functions.invoke("ebm-vsdc", { body: { action: "submit_invoice", tenant_id: tenantId, sale_id: saleId } });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data?.message || "EBM submission failed");
  return data || {};
}

async function getActiveEBMSettings(tenantId: string) {
  try {
    const { data, error } = await (supabase as any)
      .from("ebm_settings")
      .select("id,tin,provider,api_base_url,username,password_secret,device_id,branch_id,is_active")
      .eq("tenant_id", tenantId)
      .limit(1);

    if (error) {
      console.warn("EBM settings lookup failed:", error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    const hasRequiredSetup =
      String(row.tin || "").trim() &&
      String(row.provider || "").trim() &&
      String(row.api_base_url || "").trim() &&
      String(row.username || "").trim() &&
      String(row.password_secret || "").trim() &&
      String(row.device_id || "").trim() &&
      String(row.branch_id || "").trim();

    return hasRequiredSetup ? row : null;
  } catch (error) {
    console.warn("EBM settings lookup failed:", error);
    return null;
  }
}



function buildReceiptPrintHtml(sale: ReceiptSale) {
  const itemsHtml = sale.items
    .map((item) => {
      const unitPrice = getCartUnitPrice(item);
      const lineTotal = getLineTotal(item);

      return `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(item.product.name)}</div>
            <div class="muted">${item.quantity} x ${money(unitPrice)}${
              item.discount > 0 ? ` · Disc ${item.discount}%` : ""
            }</div>
          </td>
          <td class="right">${money(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(sale.receiptNo)}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #fff;
            color: #111;
            font-family: "Courier New", monospace;
            font-size: 11px;
            line-height: 1.35;
          }
          .receipt { width: 72mm; margin: 0 auto; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: 700; }
          .muted { color: #555; font-size: 10px; }
          .line { border-top: 1px dashed #111; margin: 8px 0; }
          .double { border-top: 2px solid #111; margin: 8px 0; }
          .notice {
            border: 1px solid #111;
            padding: 6px;
            text-align: center;
            font-weight: 700;
            margin: 8px 0;
          }
          table { width: 100%; border-collapse: collapse; }
          td { vertical-align: top; padding: 3px 0; }
          .item-name {
            font-weight: 700;
            max-width: 46mm;
            word-break: break-word;
          }
          .summary td { padding: 2px 0; }
          .total td {
            font-size: 14px;
            font-weight: 700;
            border-top: 1px solid #111;
            padding-top: 6px;
          }
          .qr {
            width: 70px;
            height: 70px;
            border: 2px solid #111;
            margin: 8px auto 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="center">
            <div class="bold" style="font-size:16px;">${escapeHtml(BUSINESS_NAME)}</div>
            <div>${escapeHtml(BUSINESS_TIN)}</div>
            <div>${escapeHtml(BRANCH_NAME)}</div>
            <div>Tel: Not configured</div>
          </div>

          <div class="double"></div>

          <div class="center bold">SALES RECEIPT</div>
          <div class="notice">
            ${sale.ebmStatus === "success" ? "FISCAL EBM RECEIPT" : sale.offline ? "OFFLINE RECEIPT" : sale.ebmStatus === "not_configured" ? "STANDARD RECEIPT" : RECEIPT_NOTICE}
            <br>
            <span class="muted">
              ${sale.ebmStatus === "success" ? "Verified fiscal receipt" : sale.offline ? "Pending sync when internet returns" : sale.ebmStatus === "not_configured" ? "EBM not configured for this workspace" : "Awaiting EBM submission"}
            </span>
          </div>

          <table>
            <tr><td>Receipt No</td><td class="right">${escapeHtml(sale.receiptNo)}</td></tr>
            <tr><td>Invoice No</td><td class="right">${escapeHtml(sale.invoiceNo)}</td></tr>
            <tr><td>Date</td><td class="right">${escapeHtml(sale.date)}</td></tr>
            <tr><td>Payment</td><td class="right">${escapeHtml(getPaymentLabel(sale.method))}</td></tr>
          </table>

          <div class="line"></div>

          <table>
            <tr><td>Customer</td><td class="right">${escapeHtml(sale.customerName)}</td></tr>
            ${
              sale.customerPhone
                ? `<tr><td>Phone</td><td class="right">${escapeHtml(sale.customerPhone)}</td></tr>`
                : ""
            }
            ${
              sale.customerTin
                ? `<tr><td>Customer TIN</td><td class="right">${escapeHtml(sale.customerTin)}</td></tr>`
                : ""
            }
          </table>

          <div class="line"></div>

          <table>${itemsHtml}</table>

          <div class="line"></div>

          <table class="summary">
            <tr><td>Subtotal</td><td class="right">${money(sale.subtotal)}</td></tr>
            <tr><td>Discount</td><td class="right">${money(sale.discount)}</td></tr>
            <tr><td>VAT/Tax</td><td class="right">${money(sale.tax)}</td></tr>
            <tr class="total"><td>TOTAL</td><td class="right">${money(sale.total)}</td></tr>
            <tr><td>Paid</td><td class="right">${money(sale.paid)}</td></tr>
            ${sale.change > 0 ? `<tr><td>Change</td><td class="right">${money(sale.change)}</td></tr>` : ""}
          </table>

          <div class="line"></div>

          <div class="center">
            <div>EBM Status: ${escapeHtml(getFiscalStatusLabel(sale))}</div>
            <div>EBM Receipt No: ${escapeHtml(getFiscalReceiptNo(sale))}</div>
            <div class="qr">${sale.ebmQrCode ? "QR<br>Verified<br>EBM" : "QR<br>Pending<br>EBM Sync"}</div>
            <div class="muted">Verification: ${escapeHtml(getFiscalQrText(sale))}</div>
          </div>

          <div class="line"></div>

          <div class="center">
            <div>Thank you for shopping with us.</div>
            <div class="muted">Powered by ShopCore MSystem</div>
          </div>
        </div>

        <script>
          window.onload = function () {
            window.focus();
            window.print();
            setTimeout(function () { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `;
}
function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export default function POS() {
  const { user, tenantId } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();

  const { data: stockBatches = [] } = useQuery({
    queryKey: ["stock_batches", tenantId],
    enabled: !!user && !!tenantId,
    retry: 1,
    networkMode: "always",
    queryFn: async () => {
      const cached = await getCachedTable("stock_batches");

      if (shouldUseOfflineStorage()) {
        return cached as StockBatch[];
      }

      try {
        const { data, error } = await (supabase as any)
          .from("stock_batches")
          .select("*")
          .eq("tenant_id", tenantId)
          .gt("quantity_remaining", 0)
          .eq("status", "active")
          .order("created_at", { ascending: true });

        if (error) throw error;

        const onlineBatches = (data || []) as StockBatch[];
        const pendingCachedBatches = (cached || []).filter(
          (batch: any) => batch?.sync_status === "pending" || batch?.offline_id
        );
        const merged = [...pendingCachedBatches, ...onlineBatches].sort(
          (a: any, b: any) =>
            new Date(a.created_at || a.created_offline_at || 0).getTime() -
            new Date(b.created_at || b.created_offline_at || 0).getTime()
        );

        await saveCachedTable("stock_batches", merged);
        return merged as StockBatch[];
      } catch (error) {
        if (cached.length > 0 || shouldSaveSaleOffline(error)) return cached as StockBatch[];
        throw error;
      }
    },
  });

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [heldSalesOpen, setHeldSalesOpen] = useState(false);
  const [cashSessionOpen, setCashSessionOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([
    { method: "cash", amount: 0 },
    { method: "mobile", amount: 0 },
  ]);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState("cash");
  const [amountTendered, setAmountTendered] = useState("");

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastSale, setLastSale] = useState<ReceiptSale | null>(null);

  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerTin, setCustomerTin] = useState("");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [momoNumber, setMomoNumber] = useState("");
  const [momoCode, setMomoCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saleSignals, setSaleSignals] = useState({
    salesToday: 0,
    revenueToday: 0,
    pendingSales: 0,
    pendingMovements: 0,
    lastReceipt: "No sale yet",
  });

  useEffect(() => {
    setHeldSales(readHeldSales());
    setCashSession(readCashSession());
  }, []);

  useEffect(() => {
    const refreshLocalData = () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale_items"] });
      queryClient.invalidateQueries({ queryKey: ["stock_batches"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    };

    window.addEventListener("shopcore-local-data-changed", refreshLocalData);
    window.addEventListener("shopcore-offline-data-changed", refreshLocalData);
    window.addEventListener("shopcore-sync-completed", refreshLocalData);
    window.addEventListener("online", refreshLocalData);

    return () => {
      window.removeEventListener("shopcore-local-data-changed", refreshLocalData);
      window.removeEventListener("shopcore-offline-data-changed", refreshLocalData);
      window.removeEventListener("shopcore-sync-completed", refreshLocalData);
      window.removeEventListener("online", refreshLocalData);
    };
  }, [queryClient]);

  useEffect(() => {
    let mounted = true;

    const loadSaleSignals = async () => {
      const todayKey = new Date().toISOString().slice(0, 10);
      const cachedSales = await getCachedTable("sales");
      const cachedMovements = await getCachedTable("stock_movements");

      const salesToday = (cachedSales || []).filter((sale: any) => {
        const rawDate = sale?.date || sale?.created_at || sale?.created_offline_at;
        const parsed = rawDate ? new Date(rawDate) : null;
        return parsed && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === todayKey;
      });

      const pendingSales = (cachedSales || []).filter((sale: any) => {
        const status = String(sale?.sync_status || sale?.status || "").toLowerCase();
        return status.includes("pending") || String(sale?.id || "").startsWith("offline-") || !!sale?.created_offline_at;
      }).length;

      const pendingMovements = (cachedMovements || []).filter((movement: any) => {
        const status = String(movement?.sync_status || "").toLowerCase();
        return status.includes("pending") || String(movement?.id || "").startsWith("offline-") || !!movement?.created_offline_at;
      }).length;

      const latestSale = [...(cachedSales || [])].sort((a: any, b: any) => {
        const aTime = new Date(a?.date || a?.created_at || a?.created_offline_at || 0).getTime();
        const bTime = new Date(b?.date || b?.created_at || b?.created_offline_at || 0).getTime();
        return bTime - aTime;
      })[0];

      if (!mounted) return;

      setSaleSignals({
        salesToday: salesToday.length,
        revenueToday: salesToday.reduce((sum: number, sale: any) => sum + safeNumber(sale?.total), 0),
        pendingSales,
        pendingMovements,
        lastReceipt: latestSale?.receipt_no || latestSale?.invoice_no || "No sale yet",
      });
    };

    void loadSaleSignals();

    const refreshSignals = () => void loadSaleSignals();
    window.addEventListener("shopcore-local-data-changed", refreshSignals);
    window.addEventListener("shopcore-offline-data-changed", refreshSignals);
    window.addEventListener("shopcore-sync-completed", refreshSignals);

    return () => {
      mounted = false;
      window.removeEventListener("shopcore-local-data-changed", refreshSignals);
      window.removeEventListener("shopcore-offline-data-changed", refreshSignals);
      window.removeEventListener("shopcore-sync-completed", refreshSignals);
    };
  }, [receiptOpen]);


  const batchesByProduct = useMemo(() => {
    const map = new Map<string, StockBatch[]>();

    for (const batch of stockBatches || []) {
      if (safeNumber(batch.quantity_remaining) <= 0) continue;
      if (batch.status && batch.status !== "active") continue;

      const list = map.get(batch.product_id) || [];
      list.push(batch);
      map.set(batch.product_id, list);
    }

    for (const [productId, list] of map.entries()) {
      map.set(
        productId,
        [...list].sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
        )
      );
    }

    return map;
  }, [stockBatches]);

  const getNextAvailableBatch = (product: DbProduct) => {
    const batches = batchesByProduct.get(product.id) || [];
    return batches.find((batch) => safeNumber(batch.quantity_remaining) > 0) || null;
  };

  const getDisplayPrice = (product: DbProduct) => {
    const batch = getNextAvailableBatch(product);
    return batch ? safeNumber(batch.selling_price) : getProductSellingPrice(product);
  };

  const getDisplayCost = (product: DbProduct) => {
    const batch = getNextAvailableBatch(product);
    return batch ? safeNumber(batch.cost_price) : getProductCost(product);
  };

  const availableProducts = useMemo(() => mergeRecordsById(products as any[]).filter((p: any) => isProductSellable(p)) as DbProduct[], [products]);

  const posCategories = [
    "All",
    ...new Set(availableProducts.map((p) => p.category || "Uncategorized")),
  ];

  const filteredProducts = useMemo(() => {
    return availableProducts.filter((p) => {
      const q = search.toLowerCase().trim();
      const barcode = p.barcode || "";
      const sku = p.sku || "";
      const category = p.category || "Uncategorized";

      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        barcode.includes(search) ||
        sku.toLowerCase().includes(q) ||
        String((p as any).brand || "").toLowerCase().includes(q) ||
        category.toLowerCase().includes(q);

      const matchCat = activeCat === "All" || category === activeCat;
      return matchSearch && matchCat;
    });
  }, [search, activeCat, availableProducts]);

  const selectedProducts = useMemo(() => availableProducts.filter((p) => selectedProductIds.includes(p.id)), [availableProducts, selectedProductIds]);

  const subtotal = cart.reduce((sum, c) => sum + getLineTotal(c), 0);

  const cartDiscount = cart.reduce((sum, c) => {
    const price = getCartUnitPrice(c);
    return sum + price * c.quantity * (c.discount / 100);
  }, 0);

  const taxAmount = cart.reduce(
    (sum, c) => sum + getLineTotal(c) * (getTaxRate(c.product) / 100),
    0
  );

  const total = subtotal + taxAmount;
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);

  const costTotal = cart.reduce(
    (sum, c) => sum + getCartUnitCost(c) * c.quantity,
    0
  );

  const grossProfit = subtotal - costTotal;
  const splitPaidTotal = splitPayments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
  const splitBalance = Math.max(0, total - splitPaidTotal);
  const isLayawaySale = selectedPayment === "layaway";

  const toggleProductSelection = (product: DbProduct) => {
    if (!isProductSellable(product)) return toast.error(`${product.name || "Product"} is archived, inactive, out of stock, or not priced for sale.`);
    setSelectedProductIds((prev) => prev.includes(product.id) ? prev.filter((id) => id !== product.id) : [...prev, product.id]);
  };

  const addToCart = (product: DbProduct) => {
    if (!isProductSellable(product)) return toast.error(`${product.name || "Product"} is archived, inactive, out of stock, or not priced for sale.`);
    setCart((prev) => {
      const batch = getNextAvailableBatch(product);
      const nextItem = makeCartItem(product, 1, batch);
      const nextKey = getCartKey(nextItem);
      const existing = prev.find((c) => getCartKey(c) === nextKey);
      const stockLimit = getBatchStockLimit(nextItem);

      if (existing) {
        if (existing.quantity >= stockLimit) {
          toast.error(`Only ${stockLimit} available for this price batch`);
          return prev;
        }

        return prev.map((c) =>
          getCartKey(c) === nextKey ? { ...c, quantity: c.quantity + 1 } : c
        );
      }

      return [...prev, nextItem];
    });
  };

  const mergeSelectedIntoCart = () => {
    let nextCart = stripUnsellableCartItems(cart);
    const blocked = selectedProductIds.length - selectedProducts.length;
    if (blocked > 0) toast.warning(`${blocked} archived or unavailable product(s) were skipped.`);

    selectedProducts.forEach((product) => {
      const batch = getNextAvailableBatch(product);
      const nextItem = makeCartItem(product, 1, batch);
      const nextKey = getCartKey(nextItem);
      const existing = nextCart.find((c) => getCartKey(c) === nextKey);
      const stockLimit = getBatchStockLimit(nextItem);

      if (existing) {
        if (existing.quantity < stockLimit) {
          nextCart = nextCart.map((c) =>
            getCartKey(c) === nextKey ? { ...c, quantity: c.quantity + 1 } : c
          );
        } else {
          toast.error(`Only ${stockLimit} available for ${product.name} in this price batch`);
        }
      } else {
        nextCart.push(nextItem);
      }
    });

    return nextCart;
  };

  const addSelectedToCart = () => {
    if (selectedProductIds.length === 0) {
      toast.error("Select products first");
      return;
    }

    const nextCart = mergeSelectedIntoCart();
    setCart(nextCart);
    setSelectedProductIds([]);
    toast.success("Selected products added to current sale");
  };

  const openPaymentApproval = () => {
    const sourceCart = selectedProductIds.length > 0 ? mergeSelectedIntoCart() : cart;
    const blockedItems = getUnsellableCartItems(sourceCart);
    const nextCart = stripUnsellableCartItems(sourceCart);
    if (blockedItems.length > 0) toast.warning(`${blockedItems.length} archived or unavailable item(s) were removed from the sale.`);

    if (nextCart.length === 0) {
      toast.error("Add products before completing sale");
      return;
    }

    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    const nextSubtotal = nextCart.reduce((sum, c) => sum + getLineTotal(c), 0);
    const nextTax = nextCart.reduce(
      (sum, c) => sum + getLineTotal(c) * (getTaxRate(c.product) / 100),
      0
    );

    setCart(nextCart);
    setSelectedProductIds([]);
    setSelectedPayment("cash");
    setAmountTendered(String(Math.ceil(nextSubtotal + nextTax)));
    setSplitPayments([
      { method: "cash", amount: Math.ceil((nextSubtotal + nextTax) / 2) },
      { method: "mobile", amount: Math.floor((nextSubtotal + nextTax) / 2) },
    ]);
    setMomoNumber("");
    setMomoCode("");
    setPaymentOpen(true);
  };

  const handleBarcodeScan = (code: string) => {
    const product = availableProducts.find((p) => p.barcode === code || p.sku === code);

    if (product && isProductSellable(product)) {
      addToCart(product);
      toast.success(`Scanned and added: ${product.name}`);
      setSearch("");
    } else {
      toast.error(`No product found for code: ${code}`);
    }
  };

  const updateQty = (cartKey: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (getCartKey(c) !== cartKey) return c;

        const newQty = c.quantity + delta;
        const stock = getBatchStockLimit(c);

        if (newQty <= 0) return c;

        if (newQty > stock) {
          toast.error(`Only ${stock} available for this price batch`);
          return c;
        }

        return { ...c, quantity: newQty };
      })
    );
  };

  const updateDiscount = (cartKey: string, discount: number) => {
    setCart((prev) =>
      prev.map((c) =>
        getCartKey(c) === cartKey
          ? { ...c, discount: Math.max(0, Math.min(100, discount || 0)) }
          : c
      )
    );
  };

  const removeFromCart = (cartKey: string) => {
    setCart((prev) => prev.filter((c) => getCartKey(c) !== cartKey));
  };

  const resetCustomer = () => {
    setCustomerName("Walk-in Customer");
    setCustomerPhone("");
    setCustomerTin("");
  };

  const clearCart = () => {
    setCart([]);
    setSelectedProductIds([]);
    resetCustomer();
    setAmountTendered("");
    setMomoNumber("");
    setMomoCode("");
    setSelectedPayment("cash");
  };

  const holdCurrentSale = () => {
    if (cart.length === 0 && selectedProductIds.length === 0) {
      toast.error("Add products before holding this sale");
      return;
    }

    const holdCart = selectedProductIds.length > 0 ? mergeSelectedIntoCart() : cart;
    const now = new Date().toISOString();

    const heldSale: HeldSale = {
      id: makeLocalId("held-sale"),
      tenant_id: tenantId || null,
      cashier_id: user?.id || null,
      customer_name: customerName.trim() || "Walk-in Customer",
      customer_phone: customerPhone.trim(),
      customer_tin: customerTin.trim(),
      cart: holdCart,
      selected_product_ids: [],
      total: holdCart.reduce((sum, item) => sum + getLineTotal(item), 0),
      items: holdCart.reduce((sum, item) => sum + item.quantity, 0),
      created_at: now,
      updated_at: now,
    };

    const next = [heldSale, ...heldSales].slice(0, 25);
    writeHeldSales(next);
    setHeldSales(next);
    clearCart();
    toast.success("Sale held. You can recall it from the held sales list.");
  };

  const recallHeldSale = (heldSale: HeldSale) => {
    const restoredCart = stripUnsellableCartItems(heldSale.cart || []);
    const blockedCount = (heldSale.cart || []).length - restoredCart.length;
    if (blockedCount > 0) toast.warning(`${blockedCount} archived or unavailable item(s) were not restored.`);
    setCart(restoredCart);
    setCustomerName(heldSale.customer_name || "Walk-in Customer");
    setCustomerPhone(heldSale.customer_phone || "");
    setCustomerTin(heldSale.customer_tin || "");
    setSelectedProductIds([]);
    const next = heldSales.filter((row) => row.id !== heldSale.id);
    writeHeldSales(next);
    setHeldSales(next);
    setHeldSalesOpen(false);
    toast.success("Held sale recalled to the current register.");
  };

  const removeHeldSale = (heldSaleId: string) => {
    const next = heldSales.filter((row) => row.id !== heldSaleId);
    writeHeldSales(next);
    setHeldSales(next);
    toast.success("Held sale removed.");
  };

  const openCashSession = () => {
    const openingCash = safeNumber(openingCashInput);
    const session: CashSession = {
      id: makeLocalId("cash-session"),
      opened_at: new Date().toISOString(),
      opening_cash: openingCash,
      expected_cash: openingCash,
      actual_cash: openingCash,
      variance: 0,
      status: "open",
    };

    writeCashSession(session);
    setCashSession(session);
    setCashSessionOpen(false);
    setOpeningCashInput("");
    toast.success("Cash drawer session opened.");
  };

  const closeCashSession = () => {
    if (!cashSession) return;
    const actualCash = safeNumber(openingCashInput || cashSession.expected_cash);
    const closedSession: CashSession = {
      ...cashSession,
      actual_cash: actualCash,
      variance: actualCash - safeNumber(cashSession.expected_cash),
      status: "closed",
    };

    writeCashSession(closedSession);
    setCashSession(closedSession);
    setCashSessionOpen(false);
    setOpeningCashInput("");
    toast.success("Cash drawer session closed.");
  };

  const updateSplitPayment = (index: number, patch: Partial<SplitPayment>) => {
    setSplitPayments((current) =>
      current.map((payment, i) => (i === index ? { ...payment, ...patch } : payment))
    );
  };

  const addSplitPaymentLine = () => {
    setSplitPayments((current) => [...current, { method: "cash", amount: splitBalance }]);
  };

  const removeSplitPaymentLine = (index: number) => {
    setSplitPayments((current) => current.filter((_, i) => i !== index));
  };

  const createReceiptSnapshot = ({
    receiptNo,
    invoiceNo,
    paid,
    change,
    offline,
    ebmStatus,
    ebmReceiptNo,
    ebmQrCode,
    ebmVerificationCode,
    ebmResponse,
  }: {
    receiptNo: string;
    invoiceNo: string;
    paid: number;
    change: number;
    offline?: boolean;
    ebmStatus?: ReceiptSale["ebmStatus"];
    ebmReceiptNo?: string | null;
    ebmQrCode?: string | null;
    ebmVerificationCode?: string | null;
    ebmResponse?: any;
  }): ReceiptSale => ({
    receiptNo,
    invoiceNo,
    customerName: customerName.trim() || "Walk-in Customer",
    customerPhone: customerPhone.trim(),
    customerTin: customerTin.trim(),
    items: [...cart],
    subtotal,
    tax: taxAmount,
    discount: cartDiscount,
    total,
    costTotal,
    grossProfit,
    paid,
    due: 0,
    method: selectedPayment,
    change,
    momoNumber: selectedPayment === "mobile" ? momoNumber.trim() : undefined,
    momoCode: selectedPayment === "mobile" ? momoCode.trim() : undefined,
    offline,
    syncStatus: offline ? "pending" : "synced",
    ebmStatus: ebmStatus || (offline ? "pending_sync" : "not_synced"),
    ebmReceiptNo: ebmReceiptNo || null,
    ebmQrCode: ebmQrCode || null,
    ebmVerificationCode: ebmVerificationCode || null,
    ebmResponse: ebmResponse || null,
    date: new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  const completeOfflineSale = async (tendered: number) => {
    const receiptNo = `OFF-${Date.now().toString().slice(-8)}`;
    const invoiceNo = `OFF-INV-${Date.now().toString().slice(-8)}`;
    const change = selectedPayment === "cash" ? tendered - total : 0;

    const offlineLineItems = cart.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      sku: item.product.sku || null,
      quantity: item.quantity,
      unit_price: getCartUnitPrice(item),
      unit_cost: getCartUnitCost(item),
      discount_percent: item.discount,
      subtotal: getCartUnitPrice(item) * item.quantity,
      discount: getCartUnitPrice(item) * item.quantity * (item.discount / 100),
      tax: getLineTotal(item) * (getTaxRate(item.product) / 100),
      total: getLineTotal(item),
      cost_total: getCartUnitCost(item) * item.quantity,
      gross_profit: getLineTotal(item) - getCartUnitCost(item) * item.quantity,
      stock_before: getCartStockBefore(item),
      stock_after: getCartStockBefore(item) - item.quantity,
      batch_id: item.batchId || null,
      batch_no: item.batchNo || null,
      batch_remaining_before: item.batchRemaining ?? null,
      batch_remaining_after:
        item.batchRemaining !== undefined && item.batchRemaining !== null
          ? Math.max(0, Number(item.batchRemaining || 0) - item.quantity)
          : null,
      price_source: item.priceSource || "product",
      refunded_quantity: 0,
      refund_status: "none",
      created_at: new Date().toISOString(),
    }));

    const offlineSale = await saveOfflineSale({
      tenant_id: tenantId,
      user_id: user?.id,
      invoice_no: invoiceNo,
      receipt_no: receiptNo,
      customer_name: customerName.trim() || "Walk-in Customer",
      customer_phone: customerPhone.trim() || null,
      customer_tin: customerTin.trim() || null,
      tin_number: customerTin.trim() || null,
      items: totalItems,
      line_items: offlineLineItems,
      subtotal,
      tax: taxAmount,
      discount: cartDiscount,
      total,
      cost_total: costTotal,
      cogs_total: costTotal,
      gross_profit: grossProfit,
      profit: grossProfit,
      net_profit: grossProfit,
      paid: tendered,
      due: 0,
      payment_method: selectedPayment,
      status: "pending_sync",
      branch: BRANCH_NAME,
      cashier: user?.email || "Cashier",
      date: new Date().toISOString(),
      ebm_status: "pending_sync",
      ebm_receipt_no: null,
      ebm_qr_code: null,
      ebm_response: null,
      momo_number: selectedPayment === "mobile" ? momoNumber.trim() : null,
      momo_code: selectedPayment === "mobile" ? momoCode.trim() : null,
      notes: customerTin.trim()
        ? `TIN: ${customerTin.trim()}`
        : customerPhone.trim()
          ? `Phone: ${customerPhone.trim()}`
          : "",
    });

    const offlineSaleAny = offlineSale as any;
    const offlineSaleId = offlineSaleAny?.id || offlineSaleAny?.offline_id;
    const cachedSales = await getCachedTable("sales");
    const cachedSaleItems = await getCachedTable("sale_items");
    const cachedProductsRaw = await getCachedProducts();
    const cachedProducts = mergeRecordsById([
      ...(cachedProductsRaw || []),
      ...((products as any[]) || []),
    ]);
    const cachedBatches = await getCachedTable("stock_batches");

    const offlineSaleForCache = {
      ...offlineSaleAny,
      id: offlineSaleId,
      line_items: offlineLineItems,
      sale_items: offlineLineItems,
      items_data: offlineLineItems,
      sync_status: "pending",
      operation: "create",
      created_offline_at: new Date().toISOString(),
    };

    await saveCachedTable(
      "sales",
      sortNewestFirst(mergeRecordsById([offlineSaleForCache, ...cachedSales]))
    );

    const nextSaleItems = offlineSaleId
      ? offlineLineItems.map((line: any) => ({
          ...line,
          id: `offline-sale-item-${crypto.randomUUID()}`,
          sale_id: offlineSaleId,
          tenant_id: tenantId,
          sync_status: "pending",
          operation: "create",
          offline_id: `offline-sale-item-${crypto.randomUUID()}`,
          created_offline_at: new Date().toISOString(),
        }))
      : [];

    if (nextSaleItems.length > 0) {
      await saveCachedTable(
        "sale_items",
        sortNewestFirst(mergeRecordsById([...nextSaleItems, ...cachedSaleItems]))
      );
    }

    const soldByProduct = new Map<string, number>();

    for (const item of cart) {
      soldByProduct.set(
        item.product.id,
        (soldByProduct.get(item.product.id) || 0) + item.quantity
      );
    }

    const nextProducts = cachedProducts.map((product: any) => {
      const soldQty = soldByProduct.get(product.id) || 0;
      if (!soldQty) return product;

      const currentStock = safeNumber(product.stock ?? product.stock_quantity);
      return normalizeProductStock(product, currentStock - soldQty);
    });

    await saveCachedProducts(nextProducts);

    const nextBatches = cachedBatches.map((batch: any) => {
      const soldQty = cart
        .filter((item) => item.batchId && item.batchId === batch.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (!soldQty) return batch;

      const remaining = Math.max(0, safeNumber(batch.quantity_remaining) - soldQty);

      return {
        ...batch,
        quantity_remaining: remaining,
        status: remaining <= 0 ? "depleted" : "active",
        sync_status: "pending",
        updated_offline_at: new Date().toISOString(),
      };
    });

    await saveCachedTable("stock_batches", nextBatches);

    const movementRows = cart.map((item) => {
      const currentStock = getCartStockBefore(item);
      const nextStock = Math.max(0, currentStock - item.quantity);

      return {
        id: `offline-stock-movement-${crypto.randomUUID()}`,
        tenant_id: tenantId,
        user_id: user?.id,
        product_id: item.product.id,
        product_name: item.product.name,
        movement_type: "sale",
        quantity_change: -item.quantity,
        stock_before: currentStock,
        stock_after: nextStock,
        reference: invoiceNo,
        reference_id: offlineSaleId || null,
        notes: item.batchNo
          ? `Offline POS sale receipt ${receiptNo} · Batch ${item.batchNo}`
          : `Offline POS sale receipt ${receiptNo}`,
        sync_status: "pending",
        operation: "create",
        created_at: new Date().toISOString(),
        created_offline_at: new Date().toISOString(),
      };
    });

    if (movementRows.length > 0) {
      const cachedMovements = await getCachedTable("stock_movements");
      await saveCachedTable(
        "stock_movements",
        sortNewestFirst(mergeRecordsById([...movementRows, ...cachedMovements]))
      );
    }

    queryClient.setQueriesData({ queryKey: ["products"] }, (old: any) => {
      if (!Array.isArray(old)) return nextProducts;
      return old.map((product: any) => {
        const updated = nextProducts.find((item: any) => item.id === product.id);
        return updated || product;
      });
    });

    queryClient.setQueriesData({ queryKey: ["stock_batches"] }, (old: any) => {
      if (!Array.isArray(old)) return nextBatches;
      return old.map((batch: any) => {
        const updated = nextBatches.find((item: any) => item.id === batch.id);
        return updated || batch;
      });
    });

    queryClient.setQueriesData({ queryKey: ["sales"] }, (old: any) => {
      if (!Array.isArray(old)) return [offlineSaleForCache];
      return sortNewestFirst(mergeRecordsById([offlineSaleForCache, ...old]));
    });

    if (nextSaleItems.length > 0) {
      queryClient.setQueriesData({ queryKey: ["sale_items"] }, (old: any) => {
        if (!Array.isArray(old)) return nextSaleItems;
        return sortNewestFirst(mergeRecordsById([...nextSaleItems, ...old]));
      });
    }

    if (movementRows.length > 0) {
      queryClient.setQueriesData({ queryKey: ["stock_movements"] }, (old: any) => {
        if (!Array.isArray(old)) return movementRows;
        return sortNewestFirst(mergeRecordsById([...movementRows, ...old]));
      });
    }

    setLastSale(
      createReceiptSnapshot({
        receiptNo,
        invoiceNo,
        paid: tendered,
        change,
        offline: true,
      })
    );

    if (selectedPayment === "cash" && cashSession?.status === "open") {
      const nextSession = {
        ...cashSession,
        expected_cash: safeNumber(cashSession.expected_cash) + total,
      };
      writeCashSession(nextSession);
      setCashSession(nextSession);
    }

    setPaymentOpen(false);
    setReceiptOpen(true);
    setCart([]);
    setSelectedProductIds([]);
    resetCustomer();
    setMomoNumber("");
    setMomoCode("");
    setAmountTendered("");
    setSelectedPayment("cash");

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["sales"] }),
      queryClient.invalidateQueries({ queryKey: ["sale_items"] }),
      queryClient.invalidateQueries({ queryKey: ["stock_batches"] }),
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]);

    window.dispatchEvent(new CustomEvent("shopcore-offline-data-changed", { detail: { table: "sales" } }));
    window.dispatchEvent(new CustomEvent("shopcore-local-data-changed", { detail: { table: "products" } }));
    toast.success("Sale saved offline, stock updated locally, and added to Sales. It will sync when internet returns.");
  };

  const completeSale = async () => {
    if (!tenantId) return toast.error("No active workspace");
    if (!user?.id) return toast.error("You must be signed in");

    const tendered =
      selectedPayment === "cash"
        ? parseFloat(amountTendered) || 0
        : selectedPayment === "split"
          ? splitPaidTotal
          : selectedPayment === "layaway"
            ? parseFloat(amountTendered) || 0
            : total;

    const blockedItems = getUnsellableCartItems(cart);
    if (cart.length === 0) return toast.error("Add at least one item before completing sale");
    if (blockedItems.length > 0) { setCart(stripUnsellableCartItems(cart)); return toast.error(`${blockedItems.length} archived, inactive, out-of-stock, or unpriced item(s) were removed. Review the cart before completing sale.`); }
    if (!customerName.trim()) return toast.error("Customer name is required");
    if (selectedPayment === "cash" && tendered < total) {
      return toast.error("Amount tendered is less than total");
    }
    if (selectedPayment === "split" && splitPaidTotal < total) {
      return toast.error("Split payment total is less than the sale total");
    }
    if (selectedPayment === "layaway" && tendered <= 0) {
      return toast.error("Enter the layaway deposit amount");
    }
    if (selectedPayment === "mobile" && !momoNumber.trim()) {
      return toast.error("Enter MoMo payment number");
    }
    if (selectedPayment === "mobile" && !momoCode.trim()) {
      return toast.error("Enter MoMo transaction code");
    }

    try {
      setIsSaving(true);

      if (shouldUseOfflineStorage()) {
        await completeOfflineSale(tendered);
        return;
      }

      const receiptNo = `RCT-${Date.now().toString().slice(-8)}`;

      /*
       * One call, one transaction.
       *
       * This replaced roughly a hundred and ninety lines of separate writes:
       * a sale row, its line items, a live re-read and update per product, a
       * batch update and a stock movement — each its own round trip, none of
       * them related. Any failure partway left the shop with some of a sale:
       * stock taken off for lines that were never recorded, or a sale whose
       * inventory never moved. Two tills selling the last unit at the same
       * moment both read the same stock and both succeeded.
       *
       * The server does all of it inside one transaction with the product row
       * locked, so a checkout either completes whole or leaves nothing behind,
       * and the last unit can only be sold once. It also prices and costs
       * every line from the catalogue and derives the totals itself — the
       * numbers computed on this screen are for showing the cashier, not for
       * deciding what gets recorded.
       */
      const sale = await salesApi.checkout({
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: getCartUnitPrice(item),
          unit_cost: getCartUnitCost(item),
          // The cart holds a percentage; the API takes an amount.
          discount: getCartUnitPrice(item) * item.quantity * (item.discount / 100),
          tax_rate: getTaxRate(item.product),
          batch_id: item.batchId || null,
        })),
        customer_name: customerName.trim() || "Walk-in Customer",
        customer_phone: customerPhone.trim() || null,
        customer_tin: customerTin.trim() || null,
        payment_method: selectedPayment,
        momo_number: selectedPayment === "mobile" ? momoNumber.trim() : null,
        momo_code: selectedPayment === "mobile" ? momoCode.trim() : null,
        paid: tendered,
        discount: cartDiscount,
        branch: BRANCH_NAME,
        cashier: user.email || "Cashier",
        receipt_no: receiptNo,
        notes: customerTin.trim()
          ? `TIN: ${customerTin.trim()}`
          : customerPhone.trim()
            ? `Phone: ${customerPhone.trim()}`
            : "",
      });

      // The server's numbers, not the screen's. The invoice number in
      // particular is allocated from a per-tenant counter and is the one that
      // belongs on the receipt.
      const invoiceNo = sale.invoice_no;
      const change = safeNumber(sale.change_given);
      const saleItems = sale.sale_items || [];

      /*
       * Stock is already correct in the database; this is only so the screen
       * updates before the refetch below lands. Derived from what was sold
       * rather than re-read, because the authoritative answer is already on
       * its way.
       *
       * Batch quantities are not decremented here any more. There is no
       * stock_batches table behind the API yet — the batch a line came from is
       * recorded on the sale item, and depleting the batch belongs with the
       * batches module, alongside the purchase receipts that create them.
       */
      const soldByProduct = new Map<string, { product: DbProduct; quantity: number }>();

      for (const item of cart) {
        const existing = soldByProduct.get(item.product.id);
        soldByProduct.set(item.product.id, {
          product: item.product,
          quantity: (existing?.quantity || 0) + item.quantity,
        });
      }

      const updatedProductRows: any[] = [];

      for (const { product, quantity } of soldByProduct.values()) {
        const newStock = Math.max(0, getProductStock(product) - quantity);
        const minStock = safeNumber((product as any).min_stock ?? (product as any).min_stock_level ?? 0);

        updatedProductRows.push({
          ...product,
          stock: newStock,
          stock_quantity: newStock,
          status: newStock <= 0 ? "out_of_stock" : newStock <= minStock ? "low_stock" : "active",
          updated_at: new Date().toISOString(),
        });
      }

      let fiscalSalePatch: any = { ebm_status: "not_configured", ebm_response: { message: "EBM not configured for this workspace" } };
      const activeEBMSettings = await getActiveEBMSettings(tenantId);

      if (activeEBMSettings) {
        try {
          const fiscalResult = await submitSaleToEBM(tenantId, sale.id);
          fiscalSalePatch = {
            ebm_status: "success",
            ebm_receipt_no: fiscalResult.receipt_number || fiscalResult.receiptNo || fiscalResult.data?.receipt_number || fiscalResult.data?.receiptNo || null,
            ebm_qr_code: fiscalResult.qr_code || fiscalResult.qrCode || fiscalResult.data?.qr_code || fiscalResult.data?.qrCode || fiscalResult.data?.verificationUrl || null,
            ebm_verification_code: fiscalResult.verification_code || fiscalResult.verificationCode || fiscalResult.data?.verification_code || fiscalResult.data?.verificationCode || null,
            ebm_response: fiscalResult.data || fiscalResult,
            ebm_synced_at: new Date().toISOString(),
          };

          const { error: fiscalUpdateError } = await (supabase as any)
            .from("sales")
            .update(fiscalSalePatch)
            .eq("id", sale.id)
            .eq("tenant_id", tenantId);

          if (fiscalUpdateError) console.warn("EBM fiscal status could not be saved:", fiscalUpdateError);
          toast.success("Sale completed and fiscalized.");
        } catch (ebmError: any) {
          fiscalSalePatch = { ebm_status: "failed", ebm_response: { error: ebmError?.message || "EBM submission failed" } };

          try {
            const { error: fiscalUpdateError } = await (supabase as any)
              .from("sales")
              .update(fiscalSalePatch)
              .eq("id", sale.id)
              .eq("tenant_id", tenantId);

            if (fiscalUpdateError) console.warn("EBM failure status could not be saved:", fiscalUpdateError);
          } catch (fiscalUpdateError) {
            console.warn("EBM failure status could not be saved:", fiscalUpdateError);
          }

          toast.warning(ebmError?.message ? `Sale saved, but EBM failed: ${ebmError.message}` : "Sale saved, but EBM submission failed.");
        }
      } else {
        try {
          const { error: fiscalUpdateError } = await (supabase as any)
            .from("sales")
            .update(fiscalSalePatch)
            .eq("id", sale.id)
            .eq("tenant_id", tenantId);

          if (fiscalUpdateError) console.warn("EBM not-configured status could not be saved:", fiscalUpdateError);
        } catch (fiscalUpdateError) {
          console.warn("EBM not-configured status could not be saved:", fiscalUpdateError);
        }

        console.info("EBM not configured. Sale completed without fiscal submission.");
      }
      const saleWithFiscal = { ...sale, ...fiscalSalePatch };

      const cachedProductsRaw = await getCachedProducts();
      const currentProductsForCache = mergeRecordsById([
        ...(cachedProductsRaw || []),
        ...((products as any[]) || []),
      ]);

      const nextProductsForCache = currentProductsForCache.map((product: any) => {
        const updated = updatedProductRows.find((row) => String(row.id) === String(product.id));
        return updated ? { ...product, ...updated } : product;
      });

      await saveCachedProducts(nextProductsForCache);

      const cachedSales = await getCachedTable("sales");
      await saveCachedTable("sales", sortNewestFirst(mergeRecordsById([{ ...saleWithFiscal, sale_items: saleItems, line_items: saleItems, sync_status: "synced" }, ...cachedSales])));

      const cachedSaleItems = await getCachedTable("sale_items");
      await saveCachedTable("sale_items", sortNewestFirst(mergeRecordsById([
        ...saleItems.map((item: any, index: number) => ({
          ...item,
          id: item.id || `${sale.id}-item-${index}`,
          sale_id: sale.id,
          sync_status: "synced",
        })),
        ...cachedSaleItems,
      ])));

      queryClient.setQueriesData({ queryKey: ["products"] }, (old: any) => {
        if (!Array.isArray(old)) return nextProductsForCache;
        return old.map((product: any) => {
          const updated = updatedProductRows.find((row) => String(row.id) === String(product.id));
          return updated ? { ...product, ...updated } : product;
        });
      });

      queryClient.setQueriesData({ queryKey: ["sales"] }, (old: any) => {
        const cachedSale = { ...saleWithFiscal, sale_items: saleItems, line_items: saleItems, sync_status: "synced" };
        if (!Array.isArray(old)) return [cachedSale];
        return sortNewestFirst(mergeRecordsById([cachedSale, ...old]));
      });

      setLastSale(
        createReceiptSnapshot({
          receiptNo,
          invoiceNo,
          paid: tendered,
          change,
          offline: false,
          ebmStatus: saleWithFiscal.ebm_status || "not_synced",
          ebmReceiptNo: saleWithFiscal.ebm_receipt_no || null,
          ebmQrCode: saleWithFiscal.ebm_qr_code || null,
          ebmVerificationCode: saleWithFiscal.ebm_verification_code || null,
          ebmResponse: saleWithFiscal.ebm_response || null,
        })
      );

      if (selectedPayment === "cash" && cashSession?.status === "open") {
        const nextSession = {
          ...cashSession,
          expected_cash: safeNumber(cashSession.expected_cash) + total,
        };
        writeCashSession(nextSession);
        setCashSession(nextSession);
      }

      setPaymentOpen(false);
      setReceiptOpen(true);
      setCart([]);
      setSelectedProductIds([]);
      resetCustomer();
      setMomoNumber("");
      setMomoCode("");
      setAmountTendered("");
      setSelectedPayment("cash");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["sale_items"] }),
        queryClient.invalidateQueries({ queryKey: ["stock_batches"] }),
        queryClient.invalidateQueries({ queryKey: ["stock_movements"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);

      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed", { detail: { table: "sales" } }));
      toast.success("Sale completed successfully");
    } catch (error: any) {
      console.error("SALE ERROR FULL:", error);

      if (shouldSaveSaleOffline(error)) {
        await completeOfflineSale(tendered);
        return;
      }

      toast.error(error?.message || "Failed to save sale");
    } finally {
      setIsSaving(false);
    }
  };

  const printReceipt = () => {
    if (!lastSale) return toast.error("No receipt available");

    const printWindow = window.open("", "_blank", "width=420,height=720");

    if (!printWindow) {
      toast.error("Allow popups to print the receipt");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildReceiptPrintHtml(lastSale));
    printWindow.document.close();
    toast.success("Receipt sent to printer");
  };

  const downloadReceipt = () => {
    if (!lastSale) return toast.error("No receipt available");

    const plainItems = lastSale.items
      .map((item) => {
        const unitPrice = getCartUnitPrice(item);
        const lineTotal = getLineTotal(item);
        return `${item.product.name}\n  ${item.quantity} x ${money(unitPrice)} = ${money(lineTotal)}`;
      })
      .join("\n");

    const content = [
      BUSINESS_NAME,
      BUSINESS_TIN,
      BRANCH_NAME,
      "",
      `Receipt: ${lastSale.receiptNo}`,
      `Invoice: ${lastSale.invoiceNo}`,
      `Date: ${lastSale.date}`,
      `Customer: ${lastSale.customerName}`,
      `Payment: ${getPaymentLabel(lastSale.method)}`,
      "",
      plainItems,
      "",
      `Subtotal: ${money(lastSale.subtotal)}`,
      `Discount: ${money(lastSale.discount)}`,
      `Tax: ${money(lastSale.tax)}`,
      `Total: ${money(lastSale.total)}`,
      `Paid: ${money(lastSale.paid)}`,
      lastSale.change > 0 ? `Change: ${money(lastSale.change)}` : "",
      "",
      `EBM Status: ${getFiscalStatusLabel(lastSale)}`,
      `EBM Receipt No: ${getFiscalReceiptNo(lastSale)}`,
      `Verification: ${getFiscalQrText(lastSale)}`,
      "Powered by ShopCore MSystem",
    ]
      .filter(Boolean)
      .join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${lastSale.receiptNo || "receipt"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const quickAmounts = [1000, 2000, 5000, 10000, 20000];

  const lowStockProducts = availableProducts.filter((product) => getProductStock(product) <= 5);
  const readyProducts = availableProducts.filter((product) => getProductStock(product) > 5);
  const stockReadiness = availableProducts.length > 0 ? Math.round((readyProducts.length / availableProducts.length) * 100) : 100;
  const averageCartPrice = totalItems > 0 ? total / totalItems : 0;
  const marginPercent = subtotal > 0 ? Math.round((grossProfit / subtotal) * 100) : 0;

  const categoryStockChart = posCategories
    .filter((category) => category !== "All")
    .slice(0, 6)
    .map((category) => {
      const categoryProducts = availableProducts.filter((product) => (product.category || "Uncategorized") === category);
      return {
        category,
        count: categoryProducts.length,
        stock: categoryProducts.reduce((sum, product) => sum + getProductStock(product), 0),
      };
    });

  const hotProducts = [...availableProducts]
    .sort((a, b) => getProductStock(b) - getProductStock(a))
    .slice(0, 5);

  const pendingOfflineRecords = saleSignals.pendingSales + saleSignals.pendingMovements;

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        openPaymentApproval();
      }

      if (event.key === "F2") {
        event.preventDefault();
        setScannerOpen(true);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  return (
    <div className="animate-fade-in min-h-[calc(100vh-5rem)] flex flex-col relative overflow-y-auto">
      <div
        className="pointer-events-none absolute inset-0 -m-6 bg-cover bg-center opacity-[0.08]"
        style={{ backgroundImage: `url(${boutiqueBg})` }}
      />
      <div className="pointer-events-none absolute inset-0 -m-6 bg-gradient-to-br from-background via-background/95 to-muted/80" />

      <div className="relative z-10 flex flex-col gap-4 pb-4 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/20">
                POS Terminal
              </Badge>
              {shouldUseOfflineStorage() ? (
                <Badge className="rounded-full bg-amber-500/10 text-amber-700 border-amber-500/20">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Offline Mode
                </Badge>
              ) : (
                <Badge className="rounded-full bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                  <Wifi className="w-3 h-3 mr-1" />
                  Online Mode
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Point of Sale</h1>
            <p className="text-sm text-muted-foreground">
              Powerful checkout and sales management with offline-first operations, intelligent pricing, inventory validation, profit visibility, and professional receipt workflows.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="px-4 py-2 rounded-2xl bg-card border shadow-sm text-sm">
              <span className="text-muted-foreground">Cashier: </span>
              <span className="font-medium">{user?.email || "Cashier"}</span>
            </div>

            <div className="px-4 py-2 rounded-2xl bg-card border shadow-sm text-sm flex items-center gap-2">
              <Store className="w-4 h-4 text-muted-foreground" />
              Register #1
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-blue-200 bg-blue-50 shadow-sm">
          <div className="relative grid grid-cols-1 2xl:grid-cols-[1fr_430px] gap-4 p-4 lg:p-5">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="rounded-3xl bg-blue-600 p-4 text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center">
                    <MousePointerClick className="h-5 w-5" />
                  </div>
                  <Badge className="rounded-full bg-white/20 text-white border-white/20 text-[10px]">Selection</Badge>
                </div>
                <p className="mt-4 text-3xl font-black font-data">{selectedProductIds.length}</p>
                <p className="text-xs text-white/80">Products selected</p>
              </div>

              <div className="rounded-3xl bg-emerald-600 p-4 text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <Badge className="rounded-full bg-white/20 text-white border-white/20 text-[10px]">Cart</Badge>
                </div>
                <p className="mt-4 text-3xl font-black font-data">{totalItems}</p>
                <p className="text-xs text-white/80">Items in current sale</p>
              </div>

              <div className="rounded-3xl bg-orange-600 p-4 text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <Badge className="rounded-full bg-white/20 text-white border-white/20 text-[10px]">Subtotal</Badge>
                </div>
                <p className="mt-4 text-xl font-black font-data break-words">{money(subtotal)}</p>
                <p className="text-xs text-white/80">Before tax</p>
              </div>

              <div className="rounded-3xl bg-violet-600 p-4 text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <Badge className="rounded-full bg-white/20 text-white border-white/20 text-[10px]">Profit</Badge>
                </div>
                <p className="mt-4 text-xl font-black font-data break-words">{money(grossProfit)}</p>
                <p className="text-xs text-white/80">{marginPercent}% margin</p>
              </div>

              <div className="rounded-3xl bg-cyan-600 p-4 text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center">
                    <ReceiptText className="h-5 w-5" />
                  </div>
                  <Badge className="rounded-full bg-white/20 text-white border-white/20 text-[10px]">Today</Badge>
                </div>
                <p className="mt-4 text-3xl font-black font-data">{saleSignals.salesToday}</p>
                <p className="text-xs text-white/80">Sales completed</p>
              </div>

              <div className="rounded-3xl bg-rose-600 p-4 text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <Badge className="rounded-full bg-white/20 text-white border-white/20 text-[10px]">Sync</Badge>
                </div>
                <p className="mt-4 text-3xl font-black font-data">{pendingOfflineRecords}</p>
                <p className="text-xs text-white/80">Pending records</p>
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-cyan-950 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-700" />
                    Checkout Command Center
                  </p>
                  <p className="mt-1 text-xs text-cyan-800">Fast actions for cashier flow, scanning, cart control, and payment approval.</p>
                </div>
                <Badge className="rounded-full bg-cyan-600 text-white hover:bg-cyan-600">F2 Scan</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button type="button" className="h-12 rounded-2xl bg-blue-600 text-white hover:bg-blue-700" onClick={addSelectedToCart}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Selected
                </Button>

                <Button type="button" className="h-12 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={holdCurrentSale}>
                  <Clock3 className="w-4 h-4 mr-2" />
                  Hold Sale
                </Button>

                <Button type="button" className="h-12 rounded-2xl bg-violet-600 text-white hover:bg-violet-700" onClick={() => setHeldSalesOpen(true)}>
                  <ReceiptText className="w-4 h-4 mr-2" />
                  Recall
                </Button>

                <Button type="button" className="h-12 rounded-2xl bg-orange-600 text-white hover:bg-orange-700" onClick={clearCart}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear Sale
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-white border border-cyan-200 p-3 text-cyan-900">
                  <p className="font-semibold">Shortcut</p>
                  <p className="text-cyan-700">Ctrl + Enter approves payment</p>
                </div>
                <div className="rounded-2xl bg-white border border-cyan-200 p-3 text-cyan-900">
                  <p className="font-semibold">Last receipt</p>
                  <p className="truncate text-cyan-700">{saleSignals.lastReceipt}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-4 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2 text-blue-950">
                  <Store className="w-4 h-4 text-blue-700" />
                  Terminal Control
                </h3>
                <p className="text-xs text-blue-800">Register, cashier, sync mode, and stock readiness.</p>
              </div>
              <Button size="sm" className="rounded-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => setCashSessionOpen(true)}>
                {cashSession?.status === "open" ? "Cash Open" : "Open Cash"}
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-blue-600 p-3 text-white">
                <p className="text-[11px] text-white/80">Register</p>
                <p className="font-data font-bold">#1</p>
              </div>
              <div className="rounded-2xl bg-cyan-600 p-3 text-white">
                <p className="text-[11px] text-white/80">Mode</p>
                <p className="font-data font-bold">{shouldUseOfflineStorage() ? "Offline" : "Online"}</p>
              </div>
              <div className="rounded-2xl bg-emerald-600 p-3 text-white">
                <p className="text-[11px] text-white/80">Ready Stock</p>
                <p className="font-data font-bold">{readyProducts.length}</p>
              </div>
              <div className="rounded-2xl bg-orange-600 p-3 text-white">
                <p className="text-[11px] text-white/80">Low Stock</p>
                <p className="font-data font-bold">{lowStockProducts.length}</p>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2 text-emerald-950">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                  Revenue Performance
                </h3>
                <p className="text-xs text-emerald-800">Cashier revenue, margin, basket value, and tax preview.</p>
              </div>
              <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">{money(saleSignals.revenueToday)}</Badge>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white border border-emerald-200 p-3">
                <p className="text-[11px] text-emerald-700">Gross Profit</p>
                <p className="font-data font-bold text-emerald-700">{money(grossProfit)}</p>
              </div>
              <div className="rounded-2xl bg-white border border-emerald-200 p-3">
                <p className="text-[11px] text-emerald-700">Avg Item</p>
                <p className="font-data font-bold">{money(averageCartPrice)}</p>
              </div>
              <div className="rounded-2xl bg-white border border-emerald-200 p-3">
                <p className="text-[11px] text-emerald-700">Tax</p>
                <p className="font-data font-bold">{money(taxAmount)}</p>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2 text-violet-950">
                  <BarChart3 className="w-4 h-4 text-violet-700" />
                  Sales Intelligence
                </h3>
                <p className="text-xs text-violet-800">Fast stock visibility and top products for quick selling decisions.</p>
              </div>
              <Badge className="rounded-full bg-violet-600 text-white hover:bg-violet-600">{filteredProducts.length} Visible</Badge>
            </div>

            <div className="space-y-2">
              {hotProducts.length === 0 ? (
                <p className="rounded-2xl bg-white border border-violet-200 p-3 text-xs text-violet-700">No product signal yet.</p>
              ) : (
                hotProducts.slice(0, 3).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white border border-violet-200 p-3 text-left hover:bg-violet-100"
                  >
                    <span className="truncate text-sm font-semibold">{product.name}</span>
                    <span className="font-data text-xs text-violet-700">{getProductStock(product)} units</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      <div className="relative z-10 grid xl:grid-cols-12 gap-4 flex-1 min-h-[680px]">
        <div className="xl:col-span-8 flex flex-col min-h-0">
          <div className="bg-card rounded-3xl border shadow-sm p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-muted rounded-2xl">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search product name, SKU, barcode, brand, or category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && search.trim()) handleBarcodeScan(search.trim());
                  }}
                  className="flex-1 bg-transparent text-sm outline-none"
                  autoFocus
                />

                {search && (
                  <button type="button" onClick={() => setSearch("")}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700"
              >
                <ScanBarcode className="w-5 h-5 mr-2" />
                Scan
              </Button>
            </div>

            <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
              {posCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCat(cat)}
                  className={`px-4 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all ${
                    activeCat === cat
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filteredProducts.map((p) => {
                const selected = selectedProductIds.includes(p.id);
                const stock = getProductStock(p);
                const price = getDisplayPrice(p);

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProductSelection(p)}
                    onDoubleClick={() => addToCart(p)}
                    className={`group bg-card rounded-2xl border text-left overflow-hidden shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all ${
                      selected ? "ring-2 ring-blue-600 border-blue-600" : ""
                    }`}
                  >
                    <div className="relative h-24 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-muted-foreground opacity-40" />
                      )}

                      {selected && (
                        <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div className="absolute bottom-2 left-2">
                        <Badge
                          className={`rounded-full text-[10px] border ${
                            stock <= 5
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                          }`}
                        >
                          {stock} left
                        </Badge>
                      </div>
                    </div>

                    <div className="p-3">
                      <p className="font-bold text-sm truncate" title={p.name}>
                        {p.name}
                      </p>

                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {p.sku || p.brand || "No SKU"}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-black font-data text-blue-600 truncate">
                          {money(price)}
                        </p>

                        <span
                          className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold ${
                            selected
                              ? "bg-blue-600 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {selected ? "Selected" : "Select"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Package className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-sm">No products found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 bg-card rounded-[2rem] border border-emerald-200 shadow-xl flex flex-col min-h-0 overflow-hidden">
          <div className="p-5 border-b bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  Current Sale
                </h3>
                <p className="text-xs text-white/70 mt-1">
                  Review items before checkout
                </p>
              </div>

              {totalItems > 0 && (
                <Badge className="bg-white/15 text-white border-white/20 rounded-full">
                  {totalItems} items
                </Badge>
              )}
            </div>
          </div>

          <div className="p-4 border-b border-emerald-100 space-y-3 bg-emerald-50">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-emerald-200 shadow-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none font-medium"
                placeholder="Customer name..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-3 py-3 rounded-2xl bg-white border border-emerald-200 shadow-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-sm bg-transparent outline-none"
                  placeholder="Phone"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-3 rounded-2xl bg-white border border-emerald-200 shadow-sm">
                <FileDigit className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={customerTin}
                  onChange={(e) => setCustomerTin(e.target.value)}
                  className="w-full text-sm bg-transparent outline-none"
                  placeholder="TIN"
                />
              </div>
            </div>
          </div>

          <div className="overflow-y-auto p-4 bg-white min-h-[460px] max-h-[62vh]">
            {cart.length === 0 ? (
              <div className="min-h-[380px] flex flex-col items-center justify-center text-center text-muted-foreground rounded-3xl border border-dashed bg-muted/20">
                <ShoppingBag className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-semibold">No items added yet</p>
                <p className="text-xs max-w-[260px] mt-1">
                  Select products from the left, then click Add Selected.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => {
                  const price = getCartUnitPrice(item);
                  const lineTotal = getLineTotal(item);

                  return (
                    <div
                      key={getCartKey(item)}
                      className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm"
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-white border border-emerald-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {item.product.image_url ? (
                            <img
                              src={item.product.image_url}
                              alt={item.product.name}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate">
                                {item.product.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.product.sku || "No SKU"} · {item.product.unit || "pcs"}
                                {item.batchNo ? ` · Batch ${item.batchNo}` : item.priceSource === "batch" ? " · Batch price" : ""}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(getCartKey(item))}
                              className="text-destructive hover:bg-destructive/10 rounded-xl p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-2xl bg-white border border-emerald-200 p-2">
                              <p className="text-muted-foreground">Unit Price</p>
                              <p className="font-bold font-data">{money(price)}</p>
                            </div>

                            <div className="rounded-2xl bg-white border border-emerald-200 p-2">
                              <p className="text-muted-foreground">Line Total</p>
                              <p className="font-bold font-data text-emerald-600">
                                {money(lineTotal)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateQty(getCartKey(item), -1)}
                                className="w-8 h-8 rounded-xl bg-white border border-emerald-200 flex items-center justify-center hover:bg-emerald-50"
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              <span className="w-10 text-center text-sm font-black">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() => updateQty(getCartKey(item), 1)}
                                className="w-8 h-8 rounded-xl bg-white border border-emerald-200 flex items-center justify-center hover:bg-emerald-50"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Disc %</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.discount}
                                onChange={(e) =>
                                  updateDiscount(getCartKey(item), Number(e.target.value))
                                }
                                className="w-16 px-2 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-emerald-100 p-5 space-y-3 bg-emerald-50">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-emerald-600 p-3 text-white">
                <p className="text-[11px] text-white/80">Profit</p>
                <p className="font-data font-bold truncate">{money(grossProfit)}</p>
              </div>
              <div className="rounded-2xl bg-violet-600 p-3 text-white">
                <p className="text-[11px] text-white/80">Margin</p>
                <p className="font-data font-bold">{marginPercent}%</p>
              </div>
              <div className="rounded-2xl bg-cyan-600 p-3 text-white">
                <p className="text-[11px] text-white/80">Avg Item</p>
                <p className="font-data font-bold truncate">{money(averageCartPrice)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setScannerOpen(true)} className="rounded-2xl bg-blue-600 px-3 py-3 text-left text-white hover:bg-blue-700">
                <ScanBarcode className="mb-1 h-4 w-4" />
                <p className="text-xs font-semibold">Scan Item</p>
              </button>
              <button type="button" onClick={clearCart} className="rounded-2xl bg-orange-600 px-3 py-3 text-left text-white hover:bg-orange-700">
                <RotateCcw className="mb-1 h-4 w-4" />
                <p className="text-xs font-semibold">Clear Sale</p>
              </button>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-data font-semibold">{money(subtotal)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-data font-semibold">{money(cartDiscount)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-data font-semibold">{money(taxAmount)}</span>
            </div>

            <button
              type="button"
              onClick={openPaymentApproval}
              disabled={cart.length === 0 || isSaving}
              className="w-full rounded-3xl bg-emerald-600 text-white p-4 mt-4 transition-all hover:scale-[1.02] hover:bg-emerald-700 active:scale-[0.99] shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-left">
                  <p className="text-sm text-white/70">Approve Payment</p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-white/70">Total Due</p>
                  <p className="font-data text-3xl font-black">{money(total)}</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <Dialog open={heldSalesOpen} onOpenChange={setHeldSalesOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-violet-600" />
              Held Sales
            </DialogTitle>
            <DialogDescription>
              Recall unfinished sales saved at this register.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[420px] space-y-3 overflow-y-auto">
            {heldSales.length === 0 ? (
              <div className="rounded-3xl border border-violet-200 bg-violet-50 p-8 text-center text-violet-700">
                No held sales available.
              </div>
            ) : (
              heldSales.map((heldSale) => (
                <div key={heldSale.id} className="rounded-3xl border border-violet-200 bg-violet-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-violet-950">{heldSale.customer_name}</p>
                      <p className="text-xs text-violet-700">
                        {heldSale.items} item(s) · {money(heldSale.total)} · {new Date(heldSale.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-2xl bg-violet-600 text-white hover:bg-violet-700" onClick={() => recallHeldSale(heldSale)}>
                        Recall
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => removeHeldSale(heldSale.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cashSessionOpen} onOpenChange={setCashSessionOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              Cash Drawer Session
            </DialogTitle>
            <DialogDescription>
              Track opening cash, expected cash, actual cash, and drawer variance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {cashSession?.status === "open" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">Opening Cash</p>
                  <p className="font-data font-bold">{money(cashSession.opening_cash)}</p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs text-blue-700">Expected Cash</p>
                  <p className="font-data font-bold">{money(cashSession.expected_cash)}</p>
                </div>
              </div>
            )}

            <input
              type="number"
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(e.target.value)}
              placeholder={cashSession?.status === "open" ? "Actual counted cash" : "Opening cash amount"}
              className="w-full rounded-2xl border bg-background px-4 py-3 text-center font-data text-xl font-bold outline-none"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setCashSessionOpen(false)}>
              Cancel
            </Button>
            {cashSession?.status === "open" ? (
              <Button className="rounded-2xl bg-rose-600 text-white hover:bg-rose-700" onClick={closeCashSession}>
                Close Session
              </Button>
            ) : (
              <Button className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={openCashSession}>
                Open Session
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Approve Payment
            </DialogTitle>
            <DialogDescription>
              Confirm payment method and approve this sale to generate the receipt.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 rounded-3xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
                <h3 className="font-semibold">Sale Items</h3>
                <Badge variant="secondary" className="rounded-full">
                  {totalItems} items
                </Badge>
              </div>

              <div className="max-h-[360px] overflow-y-auto divide-y">
                {cart.map((item) => {
                  const price = getCartUnitPrice(item);
                  const lineTotal = getLineTotal(item);

                  return (
                    <div key={getCartKey(item)} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-muted border overflow-hidden shrink-0 flex items-center justify-center">
                          {item.product.image_url ? (
                            <img
                              src={item.product.image_url}
                              alt={item.product.name}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} x {money(price)}
                            {item.discount > 0 ? ` · Disc ${item.discount}%` : ""}
                          </p>
                        </div>

                        <p className="font-data font-bold">{money(lineTotal)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-3xl border bg-muted/30 p-4">
                <h3 className="font-semibold mb-3">Payment Method</h3>

                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedPayment(method.id)}
                      className={`flex items-center gap-2 p-3 rounded-2xl border text-sm font-medium transition-all ${getPaymentButtonClass(method.id, selectedPayment)}`}
                    >
                      <method.icon className="w-4 h-4" />
                      {method.label}
                    </button>
                  ))}
                </div>

                {selectedPayment === "cash" && (
                  <div className="mt-4">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Amount Tendered
                    </label>
                    <input
                      type="number"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      className="w-full px-4 py-3 text-2xl font-data font-bold text-center border rounded-2xl bg-background outline-none"
                    />

                    <div className="flex gap-2 mt-2">
                      {quickAmounts.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setAmountTendered(String(amount))}
                          className="flex-1 py-2 text-xs font-data font-medium rounded-xl bg-background border hover:bg-muted"
                        >
                          {amount.toLocaleString()}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setAmountTendered(String(Math.ceil(total)))}
                        className="flex-1 py-2 text-xs font-data font-medium rounded-xl bg-emerald-600/10 text-emerald-700"
                      >
                        Exact
                      </button>
                    </div>
                  </div>
                )}

                {selectedPayment === "mobile" && (
                  <div className="space-y-3 mt-4">
                    <input
                      type="text"
                      value={momoNumber}
                      onChange={(e) => setMomoNumber(e.target.value)}
                      placeholder="MoMo payment number"
                      className="w-full px-3 py-2 border rounded-2xl bg-background outline-none"
                    />
                    <input
                      type="text"
                      value={momoCode}
                      onChange={(e) => setMomoCode(e.target.value)}
                      placeholder="MoMo transaction code"
                      className="w-full px-3 py-2 border rounded-2xl bg-background outline-none"
                    />
                  </div>
                )}
                {selectedPayment === "split" && (
                  <div className="mt-4 space-y-3">
                    {splitPayments.map((payment, index) => (
                      <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <select
                          value={payment.method}
                          onChange={(e) => updateSplitPayment(index, { method: e.target.value as SplitPayment["method"] })}
                          className="rounded-2xl border bg-background px-3 py-2 text-sm outline-none"
                        >
                          <option value="cash">Cash</option>
                          <option value="mobile">Mobile Money</option>
                          <option value="card">Card</option>
                          <option value="bank">Bank</option>
                        </select>
                        <input
                          type="number"
                          value={payment.amount || ""}
                          onChange={(e) => updateSplitPayment(index, { amount: safeNumber(e.target.value) })}
                          placeholder="Amount"
                          className="rounded-2xl border bg-background px-3 py-2 text-sm outline-none"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-2xl"
                          onClick={() => removeSplitPaymentLine(index)}
                          disabled={splitPayments.length <= 1}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm">
                      <span className="font-semibold text-orange-800">Remaining</span>
                      <span className="font-data font-bold text-orange-700">{money(splitBalance)}</span>
                    </div>

                    <Button type="button" variant="outline" className="w-full rounded-2xl" onClick={addSplitPaymentLine}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Payment Line
                    </Button>
                  </div>
                )}

                {selectedPayment === "layaway" && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                    <label className="mb-2 block text-xs font-medium text-rose-700">Customer Deposit</label>
                    <input
                      type="number"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      className="w-full rounded-2xl border bg-white px-4 py-3 text-center font-data text-xl font-bold outline-none"
                      placeholder="Enter deposit"
                    />
                    <p className="mt-2 text-xs text-rose-700">
                      Balance will remain outstanding for later collection.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border bg-card p-5 space-y-3">
                <h3 className="font-semibold">Payment Summary</h3>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-data">{money(subtotal)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-data">{money(cartDiscount)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-data">{money(taxAmount)}</span>
                </div>

                <div className="flex justify-between text-xl font-bold border-t pt-3">
                  <span>Total</span>
                  <span className="font-data text-emerald-600">{money(total)}</span>
                </div>

                {selectedPayment === "cash" &&
                  parseFloat(amountTendered || "0") >= total && (
                    <div className="flex justify-between text-sm text-emerald-600 font-medium">
                      <span>Change</span>
                      <span>{money(parseFloat(amountTendered || "0") - total)}</span>
                    </div>
                  )}

                {selectedPayment === "split" && (
                  <div className="flex justify-between text-sm text-orange-600 font-medium">
                    <span>Split Paid</span>
                    <span>{money(splitPaidTotal)}</span>
                  </div>
                )}

                {selectedPayment === "layaway" && (
                  <div className="flex justify-between text-sm text-rose-600 font-medium">
                    <span>Deposit / Balance</span>
                    <span>{money(safeNumber(amountTendered))} / {money(Math.max(0, total - safeNumber(amountTendered)))}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Back
            </Button>

            <Button
              onClick={completeSale}
              disabled={isSaving || cart.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              Sale Complete
            </DialogTitle>
            <DialogDescription className="text-center">
              Transaction recorded successfully
            </DialogDescription>
          </DialogHeader>

          {lastSale && (
            <div className="mx-auto max-h-[70vh] w-[280px] overflow-y-auto rounded-xl border bg-white px-3 py-4 font-mono text-[10px] leading-tight text-black shadow-inner">
              <div className="text-center">
                <img
                  src="/shopcore-logo.png"
                  alt="ShopCore"
                  className="mx-auto mb-2 h-8 w-8 object-contain"
                />
                <p className="text-base font-black">{BUSINESS_NAME}</p>
                <p>{BUSINESS_TIN}</p>
                <p>{BRANCH_NAME}</p>
                <p>Tel: Not configured</p>
              </div>

              <div className="my-2 border-t-2 border-black" />
              <p className="text-center font-bold">SALES RECEIPT</p>

              <div className="my-2 border border-black p-2 text-center font-bold">
                <p>{lastSale.offline ? "OFFLINE RECEIPT" : RECEIPT_NOTICE}</p>
                <p className="text-[10px] font-normal">
                  {lastSale.offline
                    ? "Pending sync when internet returns"
                    : "Awaiting EBM Submission"}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between gap-3">
                  <span>Receipt No</span>
                  <span className="text-right">{lastSale.receiptNo}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Invoice No</span>
                  <span className="text-right">{lastSale.invoiceNo}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Date</span>
                  <span className="text-right">{lastSale.date}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Payment</span>
                  <span className="text-right">{getPaymentLabel(lastSale.method)}</span>
                </div>
              </div>

              <div className="my-2 border-t border-dashed border-black" />

              <div className="space-y-1">
                <div className="flex justify-between gap-3">
                  <span>Customer</span>
                  <span className="text-right">{lastSale.customerName}</span>
                </div>
                {lastSale.customerPhone && (
                  <div className="flex justify-between gap-3">
                    <span>Phone</span>
                    <span className="text-right">{lastSale.customerPhone}</span>
                  </div>
                )}
                {lastSale.customerTin && (
                  <div className="flex justify-between gap-3">
                    <span>Customer TIN</span>
                    <span className="text-right">{lastSale.customerTin}</span>
                  </div>
                )}
              </div>

              <div className="my-2 border-t border-dashed border-black" />

              <div className="space-y-2">
                {lastSale.items.map((item) => (
                  <div key={getCartKey(item)}>
                    <div className="grid grid-cols-[1fr_auto] gap-2 font-bold">
                      <span className="break-words">{item.product.name}</span>
                      <span className="whitespace-nowrap">{money(getLineTotal(item))}</span>
                    </div>
                    <p className="text-[10px]">
                      {item.quantity} x {money(getCartUnitPrice(item))}
                      {item.discount > 0 ? ` · Disc ${item.discount}%` : ""}
                    </p>
                  </div>
                ))}
              </div>

              <div className="my-2 border-t border-dashed border-black" />

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(lastSale.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>{money(lastSale.discount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT/Tax</span>
                  <span>{money(lastSale.tax)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-black pt-2 text-sm font-black">
                  <span>TOTAL</span>
                  <span>{money(lastSale.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span>{money(lastSale.paid)}</span>
                </div>
                {lastSale.change > 0 && (
                  <div className="flex justify-between">
                    <span>Change</span>
                    <span>{money(lastSale.change)}</span>
                  </div>
                )}
              </div>

              <div className="my-2 border-t border-dashed border-black" />

              <div className="text-center">
                <p>EBM Status: {lastSale.offline ? "OFFLINE / NOT SYNCED" : "NOT SYNCED"}</p>
                <p>Fiscal Status: Awaiting EBM Submission</p>
                <div className="mx-auto my-2 flex h-20 w-20 flex-col items-center justify-center border-2 border-black">
                  <QrCode className="h-7 w-7" />
                  <span className="text-[9px]">Pending</span>
                </div>
                <p className="text-[10px]">Verification Code: Pending</p>
              </div>

              <div className="my-2 border-t border-dashed border-black" />

              <div className="text-center">
                <p>Thank you for shopping with us.</p>
                <p className="text-[10px]">Powered by ShopCore MSystem</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <Button variant="outline" onClick={printReceipt}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>

            <Button variant="outline" onClick={downloadReceipt}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>

            <Button variant="outline" onClick={() => setReceiptOpen(false)}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Close
            </Button>

            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setReceiptOpen(false)}
            >
              New Sale
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />
    </div>
    </div>
  );
}
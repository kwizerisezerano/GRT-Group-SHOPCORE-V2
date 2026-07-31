import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Clock,
  Building2,
  Calculator,
  CheckCircle2,
  CreditCard,
  Database,
  FileText,
  Globe,
  KeyRound,
  LockKeyhole,
  Receipt,
  Search,
  ServerCog,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Store,
  User,
  Wifi,
  WifiOff,
  UploadCloud,
  DatabaseZap,
  RotateCcw,
  Save,
  Palette,
  Languages,
  Printer,
  HardDriveDownload,
  CloudCog,
  ScanLine,
  FileDown,
  FileUp,
  ClipboardCheck,
  AlertTriangle,
  Activity,
  Boxes,
  Workflow,
  MonitorSmartphone,
  ReceiptText,
  Landmark,
  Percent,
  MapPin,
  Mail,
  Phone,
  Hash,
  Eye,
  Gauge,
  Layers,
  Lock,
  Zap,
  DatabaseBackup,
  RefreshCcw,
  Coins,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import {
  getCachedTable,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { toast } from "sonner";

const NAVY = "#0b3d5c";
const SETTINGS_CACHE_KEY = "app_settings";

type SettingsTab = "command" | "business" | "receipts" | "finance" | "security" | "offline" | "ebm" | "display";

const defaultBusinessSettings = {
  company_name: "ShopCore Business",
  tin: "",
  phone: "",
  email: "",
  address: "",
  branch_name: "Main Branch",
  currency: "RWF",
  language: "English",
  secondary_language: "French",
  timezone: "Africa/Kigali",
  receipt_footer: "Thank you for shopping with us.",
  receipt_header: "Official Sales Receipt",
  receipt_printer: "ESC/POS Thermal Printer",
  receipt_width: "80mm",
  auto_print_receipt: true,
  show_profit_on_reports: true,
  default_tax_rate: "18",
  fiscal_year_start: "January",
  low_stock_alert: true,
  low_stock_threshold: "10",
  brand_color: NAVY,
  accent_color: "#f97316",
  compact_mode: false,
  touchscreen_mode: true,
  offline_sales_enabled: true,
  auto_sync_enabled: true,
  sync_interval: "5",
  backup_frequency: "Daily",
  password_policy: "Strong",
  session_timeout: "60",
  two_factor_required: false,
  audit_logs_enabled: true,
  ebm_enabled: false,
  ebm_provider: "RRA VSDC",
  ebm_device_id: "",
  ebm_branch_id: "",
  ebm_endpoint: "",
};

const settingSections = [
  { title: "My Profile", description: "Manage profile, avatar, password, contact details, and account security.", icon: User, link: "/profile", status: "Ready", group: "Account", tone: "blue" },
  { title: "Business Profile", description: "Company name, TIN, branch, contact details, logo, and address.", icon: Building2, tab: "business", status: "Ready", group: "Business", tone: "emerald" },
  { title: "Invoice & Receipts", description: "Receipt preview, print behavior, footer, header, tax display, and layout.", icon: Receipt, tab: "receipts", status: "Ready", group: "Sales", tone: "orange" },
  { title: "Tax & Currency", description: "VAT, currency, fiscal year, report visibility, and timezone.", icon: Globe, tab: "finance", status: "Ready", group: "Finance", tone: "violet" },
  { title: "Payment Methods", description: "Cash, card, mobile money, bank transfer, credit, and payment controls.", icon: CreditCard, tab: "finance", status: "Ready", group: "Finance", tone: "sky" },
  { title: "Notifications", description: "Stock alerts, sync alerts, sales notices, system events, and reminders.", icon: Bell, link: "/notifications", status: "Ready", group: "System", tone: "amber" },
  { title: "Security", description: "Password rules, sessions, audit logs, permissions, and 2FA readiness.", icon: Shield, tab: "security", status: "Ready", group: "System", tone: "rose" },
  { title: "Offline & Sync", description: "Offline selling, local cache, sync intervals, pending queue, and backups.", icon: DatabaseZap, tab: "offline", status: "Active", group: "System", tone: "emerald" },
  { title: "Language & Display", description: "English, French, Kinyarwanda, touchscreen mode, compact mode, and colors.", icon: Languages, tab: "display", status: "Ready", group: "System", tone: "violet" },
  { title: "EBM Integration", description: "TIN, VSDC provider, device, branch, receipt sync, and fiscal readiness.", icon: ServerCog, link: "/ebm-settings", tab: "ebm", status: "Setup", group: "Fiscal", tone: "amber" },
];

const ebmItems = [
  { title: "Business TIN", key: "tin", description: "Tax identification number used on fiscal invoices.", icon: BadgeCheck, status: "Required" },
  { title: "EBM Provider", key: "ebm_provider", description: "Configure VSDC, SDC, API provider, or middleware.", icon: ServerCog, status: "Pending" },
  { title: "API Credentials", key: "ebm_endpoint", description: "Endpoint, token, device ID, and branch ID readiness.", icon: KeyRound, status: "Pending" },
  { title: "Product Sync", key: "ebm_device_id", description: "Import and match EBM products with ShopCore inventory.", icon: Database, status: "Planned" },
  { title: "POS Invoice Sync", key: "ebm_branch_id", description: "Send completed POS sales to EBM and store responses.", icon: Calculator, status: "Planned" },
  { title: "Receipt Verification", key: "receipt_footer", description: "Invoice number, QR code, tax breakdown, and verification data.", icon: Smartphone, status: "Planned" },
];

const toneStyles: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600 border-blue-100",
  emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-100",
  orange: "bg-orange-500/10 text-orange-600 border-orange-100",
  violet: "bg-violet-500/10 text-violet-600 border-violet-100",
  sky: "bg-sky-500/10 text-sky-600 border-sky-100",
  amber: "bg-amber-500/10 text-amber-600 border-amber-100",
  rose: "bg-rose-500/10 text-rose-600 border-rose-100",
};

const tabs: { id: SettingsTab; label: string; icon: any; helper: string }[] = [
  { id: "command", label: "Command", icon: Gauge, helper: "Overview" },
  { id: "business", label: "Business", icon: Building2, helper: "Identity" },
  { id: "receipts", label: "Receipts", icon: ReceiptText, helper: "Printing" },
  { id: "finance", label: "Finance", icon: Coins, helper: "Tax & currency" },
  { id: "security", label: "Security", icon: Lock, helper: "Access" },
  { id: "offline", label: "Offline", icon: DatabaseBackup, helper: "Sync" },
  { id: "ebm", label: "EBM", icon: ServerCog, helper: "Fiscal" },
  { id: "display", label: "Display", icon: Palette, helper: "UI" },
];

function makeCacheKey(tenantId?: string | null) {
  return tenantId ? `${SETTINGS_CACHE_KEY}_${tenantId}` : SETTINGS_CACHE_KEY;
}

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function isPendingSync(row: any) {
  const status = String(row?.sync_status || "").toLowerCase();
  return (
    String(row?.id || "").startsWith("offline-") ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at ||
    status.includes("pending")
  );
}

function scoreEnabled(value: any) {
  return value ? 1 : 0;
}

function TextField({ label, icon: Icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="relative mt-1.5">
        {Icon && <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
        <Input
          type={type}
          className={`h-10 rounded-xl ${Icon ? "pl-10" : ""}`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function ToggleRow({ title, description, checked, onChange, icon: Icon }: any) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#0b3d5c]/10 text-[#0b3d5c]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

function MiniBar({ label, value, color = "bg-[#0b3d5c]" }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <div className="mb-2 flex justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-black">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, tenantId, session } = useAuth();
  const {
    language,
    setLanguage,
    t,
  } = useLanguage();
  const {
    theme,
    resolvedTheme,
  } = useTheme();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTab>("command");
  const [businessSettings, setBusinessSettings] = useState<any>(defaultBusinessSettings);
  const [saving, setSaving] = useState(false);

  const onlineReady = isOnline() && !isOfflineMode() && !!session?.access_token;
  const offlineModeActive = !onlineReady;
  const pendingSync = isPendingSync(businessSettings);
  const cacheKey = useMemo(() => makeCacheKey(tenantId), [tenantId]);

  useEffect(() => {
    const languageName =
      language === "fr"
        ? "French"
        : language === "rw"
          ? "Kinyarwanda"
          : "English";

    setBusinessSettings((current: any) => {
      if (current.language === languageName) {
        return current;
      }

      return {
        ...current,
        language: languageName,
      };
    });
  }, [language]);

  useEffect(() => {
    const loadSettings = async () => {
      const cached = await getCachedTable(cacheKey);
      if (Array.isArray(cached) && cached[0]) {
        setBusinessSettings({ ...defaultBusinessSettings, ...cached[0] });
        return;
      }

      const row = {
        ...defaultBusinessSettings,
        id: makeLocalId("offline-app-settings"),
        tenant_id: tenantId || null,
        sync_status: "synced",
        updated_at: new Date().toISOString(),
      };
      setBusinessSettings(row);
      await saveCachedTable(cacheKey, [row]);
    };

    loadSettings().catch(() => undefined);
  }, [cacheKey, tenantId]);

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return settingSections;

    return settingSections.filter((section) =>
      section.title.toLowerCase().includes(query) ||
      section.description.toLowerCase().includes(query) ||
      section.group.toLowerCase().includes(query)
    );
  }, [search]);

  const readiness = useMemo(() => {
    const business = Math.round(((businessSettings.company_name ? 1 : 0) + (businessSettings.tin ? 1 : 0) + (businessSettings.phone ? 1 : 0) + (businessSettings.email ? 1 : 0) + (businessSettings.address ? 1 : 0)) / 5 * 100);
    const receipts = Math.round(((businessSettings.receipt_header ? 1 : 0) + (businessSettings.receipt_footer ? 1 : 0) + (businessSettings.receipt_printer ? 1 : 0) + scoreEnabled(businessSettings.auto_print_receipt)) / 4 * 100);
    const finance = Math.round(((businessSettings.currency ? 1 : 0) + (businessSettings.default_tax_rate ? 1 : 0) + (businessSettings.timezone ? 1 : 0) + (businessSettings.fiscal_year_start ? 1 : 0)) / 4 * 100);
    const security = Math.round(((businessSettings.password_policy ? 1 : 0) + (businessSettings.session_timeout ? 1 : 0) + scoreEnabled(businessSettings.audit_logs_enabled) + scoreEnabled(businessSettings.two_factor_required)) / 4 * 100);
    const offline = Math.round((scoreEnabled(businessSettings.offline_sales_enabled) + scoreEnabled(businessSettings.auto_sync_enabled) + (businessSettings.backup_frequency ? 1 : 0) + (businessSettings.sync_interval ? 1 : 0)) / 4 * 100);
    const ebm = Math.round((scoreEnabled(businessSettings.ebm_enabled) + (businessSettings.tin ? 1 : 0) + (businessSettings.ebm_provider ? 1 : 0) + (businessSettings.ebm_device_id ? 1 : 0) + (businessSettings.ebm_branch_id ? 1 : 0) + (businessSettings.ebm_endpoint ? 1 : 0)) / 6 * 100);
    const overall = Math.round((business + receipts + finance + security + offline + ebm) / 6);
    return { business, receipts, finance, security, offline, ebm, overall };
  }, [businessSettings]);

  const readyCount = settingSections.filter((item) => item.status === "Ready" || item.status === "Active").length;
  const pendingCount = settingSections.length - readyCount;

  const updateBusinessSetting = (field: string, value: any) => {
    setBusinessSettings((prev: any) => ({
      ...prev,
      [field]: value,
      updated_offline_at: new Date().toISOString(),
      sync_status: prev?.sync_status === "pending" ? "pending" : "pending_update",
    }));
  };

  const saveLocalSettings = async () => {
    if (!tenantId) {
      toast.error("No active workspace");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const row = {
        ...businessSettings,
        id: businessSettings.id || makeLocalId("offline-app-settings"),
        tenant_id: tenantId,
        user_id: user?.id || null,
        operation: businessSettings.id && !String(businessSettings.id).startsWith("offline-") ? "update" : "create",
        sync_status: businessSettings.id && !String(businessSettings.id).startsWith("offline-") ? "pending_update" : "pending",
        updated_at: now,
        updated_offline_at: now,
      };

      await saveCachedTable(cacheKey, [row]);
      await saveCachedTable(SETTINGS_CACHE_KEY, [row]);
      await savePending("app_settings", row);
      setBusinessSettings(row);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
      }

      toast.success(offlineModeActive ? "Settings saved offline. They will sync when internet returns." : "Settings saved and queued for sync.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const resetLocalSettings = async () => {
    const row = {
      ...defaultBusinessSettings,
      id: businessSettings.id || makeLocalId("offline-app-settings"),
      tenant_id: tenantId || null,
      user_id: user?.id || null,
      operation: "update",
      sync_status: "pending_update",
      updated_offline_at: new Date().toISOString(),
    };

    setBusinessSettings(row);
    await saveCachedTable(cacheKey, [row]);
    await savePending("app_settings", row);
    toast.success("Settings reset locally.");
  };

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(businessSettings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopcore-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateSettings = () => {
    const issues = [];
    if (!businessSettings.company_name) issues.push("Company name is missing");
    if (!businessSettings.tin) issues.push("Business TIN is missing");
    if (!businessSettings.receipt_footer) issues.push("Receipt footer is missing");
    if (businessSettings.ebm_enabled && !businessSettings.ebm_device_id) issues.push("EBM device ID is missing");
    if (issues.length) toast.warning(`${issues.length} setting issue(s): ${issues[0]}`);
    else toast.success("Settings look healthy.");
  };

  const renderSection = () => {
    if (activeTab === "business") {
      return (
        <div className="grid gap-5 lg:grid-cols-1 xl:grid-cols-[1fr_360px]">
          <Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm"><CardContent className="p-4">
            <div className="mb-4 flex items-center gap-3"><Building2 className="h-6 w-6 text-[#0b3d5c]" /><div><h3 className="text-base font-black">Business Identity</h3><p className="text-sm text-muted-foreground">Core business details used across receipts, reports, EBM, invoices, and dashboards.</p></div></div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Company Name" icon={Store} value={businessSettings.company_name} onChange={(v: string) => updateBusinessSetting("company_name", v)} />
              <TextField label="Business TIN" icon={Hash} value={businessSettings.tin} onChange={(v: string) => updateBusinessSetting("tin", v)} />
              <TextField label="Branch Name" icon={Building2} value={businessSettings.branch_name} onChange={(v: string) => updateBusinessSetting("branch_name", v)} />
              <TextField label="Phone" icon={Phone} value={businessSettings.phone} onChange={(v: string) => updateBusinessSetting("phone", v)} />
              <TextField label="Email" icon={Mail} value={businessSettings.email} onChange={(v: string) => updateBusinessSetting("email", v)} />
              <TextField label="Address" icon={MapPin} value={businessSettings.address} onChange={(v: string) => updateBusinessSetting("address", v)} />
            </div>
          </CardContent></Card>
          <Card className="rounded-3xl border bg-gradient-to-br from-white to-emerald-50 shadow-sm"><CardContent className="p-4">
            <h3 className="font-black">Business Readiness</h3><p className="text-sm text-muted-foreground">Profile completeness score.</p>
            <div className="mt-6 flex h-20 w-20 items-center justify-center rounded-full border-[10px] border-emerald-200 bg-white text-2xl font-black text-emerald-700">{readiness.business}%</div>
            <div className="mt-5 space-y-2 text-sm text-slate-600"><p>Used by receipts, purchase orders, reports, EBM readiness, and branded exports.</p></div>
          </CardContent></Card>
        </div>
      );
    }

    if (activeTab === "receipts") {
      return (
        <div className="grid gap-5 lg:grid-cols-1 xl:grid-cols-[1fr_380px]">
          <Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm"><CardContent className="p-4">
            <div className="mb-4 flex items-center gap-3"><ReceiptText className="h-6 w-6 text-orange-600" /><div><h3 className="text-base font-black">Receipt & Printing Control</h3><p className="text-sm text-muted-foreground">Prepare thermal receipt behavior and professional branded receipt output.</p></div></div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Receipt Header" icon={Receipt} value={businessSettings.receipt_header} onChange={(v: string) => updateBusinessSetting("receipt_header", v)} />
              <TextField label="Printer Name" icon={Printer} value={businessSettings.receipt_printer} onChange={(v: string) => updateBusinessSetting("receipt_printer", v)} />
              <TextField label="Receipt Width" icon={ScanLine} value={businessSettings.receipt_width} onChange={(v: string) => updateBusinessSetting("receipt_width", v)} />
              <TextField label="Receipt Footer" icon={FileText} value={businessSettings.receipt_footer} onChange={(v: string) => updateBusinessSetting("receipt_footer", v)} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2"><ToggleRow icon={Printer} title="Auto Print Receipt" description="Automatically trigger receipt printing after successful POS checkout." checked={!!businessSettings.auto_print_receipt} onChange={(v: boolean) => updateBusinessSetting("auto_print_receipt", v)} /><ToggleRow icon={Receipt} title="Show Tax Breakdown" description="Prepare receipt layout for VAT and fiscal tax breakdown display." checked={true} onChange={() => toast.info("Tax breakdown is always prepared for EBM readiness.")} /></div>
          </CardContent></Card>
          <Card className="rounded-3xl border bg-slate-950 text-white shadow-sm"><CardContent className="p-4">
            <div className="mx-auto max-w-[260px] rounded-3xl bg-white p-5 font-mono text-slate-900 shadow-xl">
              <p className="text-center text-sm font-black">{businessSettings.company_name || "ShopCore"}</p>
              <p className="text-center text-[10px]">{businessSettings.receipt_header}</p>
              <div className="my-3 border-t border-dashed" />
              <p className="text-[10px]">TIN: {businessSettings.tin || "—"}</p>
              <p className="text-[10px]">Branch: {businessSettings.branch_name || "Main"}</p>
              <div className="my-3 border-t border-dashed" />
              <div className="flex justify-between text-[11px]"><span>Sample Item</span><span>{businessSettings.currency} 1,000</span></div>
              <div className="flex justify-between text-[11px]"><span>VAT {businessSettings.default_tax_rate}%</span><span>{businessSettings.currency} 180</span></div>
              <div className="my-3 border-t border-dashed" />
              <div className="flex justify-between text-sm font-black"><span>Total</span><span>{businessSettings.currency} 1,180</span></div>
              <p className="mt-4 text-center text-[10px]">{businessSettings.receipt_footer}</p>
            </div>
          </CardContent></Card>
        </div>
      );
    }

    if (activeTab === "finance") {
      return (
        <Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm"><CardContent className="p-4">
          <div className="mb-4 flex items-center gap-3"><Landmark className="h-6 w-6 text-violet-600" /><div><h3 className="text-base font-black">Finance, Tax & Payment Settings</h3><p className="text-sm text-muted-foreground">Control currency, VAT, fiscal period, payments, and report visibility.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="Currency" icon={Coins} value={businessSettings.currency} onChange={(v: string) => updateBusinessSetting("currency", v)} />
            <TextField label="Default Tax Rate %" icon={Percent} type="number" value={businessSettings.default_tax_rate} onChange={(v: string) => updateBusinessSetting("default_tax_rate", v)} />
            <TextField label="Fiscal Year Start" icon={CalendarIconFallback} value={businessSettings.fiscal_year_start} onChange={(v: string) => updateBusinessSetting("fiscal_year_start", v)} />
            <TextField label="Timezone" icon={Globe} value={businessSettings.timezone} onChange={(v: string) => updateBusinessSetting("timezone", v)} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2"><ToggleRow icon={FileText} title="Show Profit on Reports" description="Allow reports to include gross profit, net profit, and cost analytics." checked={!!businessSettings.show_profit_on_reports} onChange={(v: boolean) => updateBusinessSetting("show_profit_on_reports", v)} /><ToggleRow icon={Bell} title="Low Stock Alerts" description="Trigger notifications when stock falls below your configured threshold." checked={!!businessSettings.low_stock_alert} onChange={(v: boolean) => updateBusinessSetting("low_stock_alert", v)} /></div>
        </CardContent></Card>
      );
    }

    if (activeTab === "security") {
      return (
        <div className="grid gap-5 lg:grid-cols-1 xl:grid-cols-[1fr_360px]">
          <Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm"><CardContent className="p-4">
            <div className="mb-4 flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-rose-600" /><div><h3 className="text-base font-black">Security & Access Control</h3><p className="text-sm text-muted-foreground">Session policy, password rules, 2FA readiness, and audit log controls.</p></div></div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Password Policy" icon={LockKeyhole} value={businessSettings.password_policy} onChange={(v: string) => updateBusinessSetting("password_policy", v)} />
              <TextField label="Session Timeout Minutes" icon={RefreshCcw} type="number" value={businessSettings.session_timeout} onChange={(v: string) => updateBusinessSetting("session_timeout", v)} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2"><ToggleRow icon={KeyRound} title="Require Two-Factor Auth" description="Prepare workspace for stricter admin login security." checked={!!businessSettings.two_factor_required} onChange={(v: boolean) => updateBusinessSetting("two_factor_required", v)} /><ToggleRow icon={ClipboardCheck} title="Audit Logs" description="Track important user actions, role changes, and system activity." checked={!!businessSettings.audit_logs_enabled} onChange={(v: boolean) => updateBusinessSetting("audit_logs_enabled", v)} /></div>
          </CardContent></Card>
          <Card className="rounded-3xl border bg-gradient-to-br from-white to-rose-50 shadow-sm"><CardContent className="p-4"><h3 className="font-black">Security Score</h3><div className="mt-4 flex h-32 w-32 items-center justify-center rounded-full border-[10px] border-rose-200 bg-white text-2xl font-black text-rose-700">{readiness.security}%</div><p className="mt-5 text-sm text-slate-600">Enable 2FA and audit logs for stronger enterprise security.</p></CardContent></Card>
        </div>
      );
    }

    if (activeTab === "offline") {
      return (
        <div className="grid gap-5 lg:grid-cols-1 xl:grid-cols-[1fr_360px]">
          <Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm"><CardContent className="p-4">
            <div className="mb-4 flex items-center gap-3"><DatabaseBackup className="h-6 w-6 text-emerald-600" /><div><h3 className="text-base font-black">Offline-First & Sync Engine</h3><p className="text-sm text-muted-foreground">Control offline selling, pending queues, sync behavior, local cache, and backup readiness.</p></div></div>
            <div className="grid gap-3 md:grid-cols-2"><ToggleRow icon={WifiOff} title="Offline Sales" description="Allow POS transactions while internet is unavailable." checked={!!businessSettings.offline_sales_enabled} onChange={(v: boolean) => updateBusinessSetting("offline_sales_enabled", v)} /><ToggleRow icon={UploadCloud} title="Auto Sync" description="Automatically sync pending records when internet returns." checked={!!businessSettings.auto_sync_enabled} onChange={(v: boolean) => updateBusinessSetting("auto_sync_enabled", v)} /></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2"><TextField label="Sync Interval Minutes" icon={RefreshCcw} type="number" value={businessSettings.sync_interval} onChange={(v: string) => updateBusinessSetting("sync_interval", v)} /><TextField label="Backup Frequency" icon={HardDriveDownload} value={businessSettings.backup_frequency} onChange={(v: string) => updateBusinessSetting("backup_frequency", v)} /></div>
          </CardContent></Card>
          <Card className="rounded-3xl border bg-gradient-to-br from-white to-emerald-50 shadow-sm"><CardContent className="p-4"><h3 className="font-black">Sync Health</h3><div className="mt-5 space-y-3"><MiniBar label="Offline Coverage" value={readiness.offline} color="bg-emerald-500" /><MiniBar label="Pending Queue" value={pendingSync ? 65 : 0} color="bg-amber-500" /><MiniBar label="Cache Readiness" value={90} color="bg-[#0b3d5c]" /></div></CardContent></Card>
        </div>
      );
    }

    if (activeTab === "ebm") {
      return (
        <div className="space-y-5">
          <Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm"><CardContent className="p-4">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><ServerCog className="h-6 w-6 text-amber-600" /><div><h3 className="text-base font-black">EBM / Fiscal Readiness Center</h3><p className="text-sm text-muted-foreground">Prepare ShopCore for RRA VSDC, product sync, fiscal invoice sync, and receipt verification.</p></div></div><Button style={{ background: NAVY }} className="rounded-2xl" onClick={() => navigate("/ebm-settings")}><ServerCog className="mr-2 h-4 w-4" />Open EBM Setup</Button></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><TextField label="EBM Provider" icon={ServerCog} value={businessSettings.ebm_provider} onChange={(v: string) => updateBusinessSetting("ebm_provider", v)} /><TextField label="Device ID" icon={Smartphone} value={businessSettings.ebm_device_id} onChange={(v: string) => updateBusinessSetting("ebm_device_id", v)} /><TextField label="Branch ID" icon={Building2} value={businessSettings.ebm_branch_id} onChange={(v: string) => updateBusinessSetting("ebm_branch_id", v)} /><TextField label="Endpoint" icon={CloudCog} value={businessSettings.ebm_endpoint} onChange={(v: string) => updateBusinessSetting("ebm_endpoint", v)} /></div>
            <div className="mt-5"><ToggleRow icon={Zap} title="Enable EBM Mode" description="Prepare POS receipts and completed sales for fiscal invoice sync." checked={!!businessSettings.ebm_enabled} onChange={(v: boolean) => updateBusinessSetting("ebm_enabled", v)} /></div>
          </CardContent></Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{ebmItems.map((item) => { const Icon = item.icon; const ready = !!businessSettings[item.key as keyof typeof businessSettings]; return <Card key={item.title} className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm"><CardContent className="p-4"><div className="flex items-start gap-4"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${ready ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-950 text-white"}`}><Icon className="h-5 w-5" /></div><div><div className="mb-1 flex items-center gap-2"><h4 className="text-sm font-semibold">{item.title}</h4><Badge variant="outline" className="rounded-full text-[10px]">{ready ? "Ready" : item.status}</Badge></div><p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p></div></div></CardContent></Card>; })}</div>
        </div>
      );
    }

    if (activeTab === "display") {
      return (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
            <CardContent className="p-5">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
                  <Palette className="h-6 w-6" />
                </div>

                <div>
                  <h3 className="text-base font-black">
                    Language & Appearance
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Switch the entire ShopCore interface between English,
                    French, and Kinyarwanda, and choose Light, Dark, or System
                    appearance.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Languages className="h-4 w-4 text-primary" />
                    <p className="text-sm font-black">
                      Interface language
                    </p>
                  </div>

                  <LanguageSelector />

                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    The selected language is stored on this device and restored
                    automatically, including during offline use.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    <p className="text-sm font-black">
                      Application appearance
                    </p>
                  </div>

                  <ThemeSelector />

                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    System mode follows the operating-system preference and
                    updates automatically when the device appearance changes.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <ToggleRow
                  icon={MonitorSmartphone}
                  title="Touchscreen Mode"
                  description="Optimize POS and key workflows for tablets and touch screens."
                  checked={!!businessSettings.touchscreen_mode}
                  onChange={(value: boolean) =>
                    updateBusinessSetting("touchscreen_mode", value)
                  }
                />

                <ToggleRow
                  icon={Layers}
                  title="Compact Mode"
                  description="Use denser cards and tables for small screens or high-volume administration."
                  checked={!!businessSettings.compact_mode}
                  onChange={(value: boolean) =>
                    updateBusinessSetting("compact_mode", value)
                  }
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <TextField
                  label="Brand Color"
                  icon={Palette}
                  value={businessSettings.brand_color}
                  onChange={(value: string) =>
                    updateBusinessSetting("brand_color", value)
                  }
                />

                <TextField
                  label="Accent Color"
                  icon={Palette}
                  value={businessSettings.accent_color}
                  onChange={(value: string) =>
                    updateBusinessSetting("accent_color", value)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border bg-card text-card-foreground shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                Current experience
              </p>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/35">
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-blue-600 dark:text-blue-300">
                    Language
                  </p>

                  <p className="mt-1 text-lg font-black text-blue-950 dark:text-blue-100">
                    {language === "fr"
                      ? "Français"
                      : language === "rw"
                        ? "Ikinyarwanda"
                        : "English"}
                  </p>
                </div>

                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/50 dark:bg-violet-950/35">
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-violet-600 dark:text-violet-300">
                    Theme preference
                  </p>

                  <p className="mt-1 text-lg font-black text-violet-950 dark:text-violet-100">
                    {theme === "system"
                      ? `System (${resolvedTheme})`
                      : theme === "dark"
                        ? "Dark"
                        : "Light"}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/35">
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-600 dark:text-emerald-300">
                    Persistence
                  </p>

                  <p className="mt-1 text-sm font-black text-emerald-950 dark:text-emerald-100">
                    Saved locally and available offline
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[{ label: "System Readiness", value: readiness.overall, icon: Gauge, color: "blue" }, { label: "EBM Readiness", value: readiness.ebm, icon: ServerCog, color: "amber" }, { label: "Offline Coverage", value: readiness.offline, icon: DatabaseZap, color: "emerald" }, { label: "Security Score", value: readiness.security, icon: ShieldCheck, color: "rose" }].map((item) => {
            const Icon = item.icon;
            const cls: Record<string, string> = { blue: "border-blue-100 bg-blue-50 text-blue-700", amber: "border-amber-100 bg-amber-50 text-amber-700", emerald: "border-emerald-100 bg-emerald-50 text-emerald-700", rose: "border-rose-100 bg-rose-50 text-rose-700" };
            return <Card key={item.label} className={`rounded-2xl border shadow-sm ${cls[item.color]}`}><CardContent className="p-4"><div className="mb-4 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/70"><Icon className="h-5 w-5" /></div><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-black">{item.value}%</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-current" style={{ width: `${item.value}%` }} /></div></CardContent></Card>;
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm"><CardContent className="p-4"><h3 className="mb-4 text-base font-black">Configuration Health Map</h3><div className="grid gap-3 md:grid-cols-2"><MiniBar label="Business Profile" value={readiness.business} color="bg-emerald-500" /><MiniBar label="Receipts" value={readiness.receipts} color="bg-orange-500" /><MiniBar label="Finance" value={readiness.finance} color="bg-violet-500" /><MiniBar label="Security" value={readiness.security} color="bg-rose-500" /><MiniBar label="Offline & Sync" value={readiness.offline} color="bg-[#0b3d5c]" /><MiniBar label="EBM" value={readiness.ebm} color="bg-amber-500" /></div></CardContent></Card>
          <Card className="rounded-3xl border bg-slate-950 text-white shadow-sm"><CardContent className="p-4"><div className="mb-4 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10"><Activity className="h-5 w-5" /></div><h3 className="font-black">Recommended Action</h3><p className="mt-2 text-sm text-white/70">{readiness.ebm < 70 ? "Complete EBM provider, device ID, branch ID, and endpoint before activating fiscal sync." : readiness.security < 80 ? "Enable audit logs and two-factor policy for stronger workspace protection." : "Your workspace is well configured. Export a backup of your settings."}</p><Button className="mt-5 rounded-2xl bg-white text-slate-950 hover:bg-white/90" onClick={validateSettings}><ClipboardCheck className="mr-2 h-4 w-4" />Run Health Check</Button></CardContent></Card>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">General Settings</h3><p className="text-sm text-muted-foreground">Manage the main application configuration.</p></div><Badge variant="outline" className="rounded-full">{pendingCount} planned / pending</Badge></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              return <Card key={section.title} className="group cursor-pointer rounded-2xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md" onClick={() => { if (section.link) navigate(section.link); else if (section.tab) setActiveTab(section.tab as SettingsTab); }}><CardContent className="p-4"><div className="mb-4 flex items-start justify-between gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-2xl border ${toneStyles[section.tone]}`}><Icon className="h-5 w-5" /></div><div className="flex flex-col items-end gap-2"><Badge variant="secondary" className="rounded-full text-[11px]">{section.status}</Badge><span className="rounded-full border px-2.5 py-1 text-[10px] text-slate-600">{section.group}</span></div></div><h3 className="mb-1 text-sm font-semibold transition-colors group-hover:text-primary">{section.title}</h3><p className="min-h-[38px] text-xs leading-relaxed text-slate-600">{section.description}</p><div className="mt-4 flex items-center justify-between border-t pt-3"><span className="text-xs font-semibold text-slate-600">Configure</span><div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 transition group-hover:bg-primary group-hover:text-primary-foreground"><ArrowRight className="h-4 w-4" /></div></div></CardContent></Card>;
            })}
          </div>
        </section>
      </div>
    );
  };

  const CalendarIconFallback = Clock;

  return (
    <PageBackground image={warehouseBg} opacity={0.04}>
      <PageShell
        title={t("navigation.settings")}
        description="Configure company details, tax setup, payments, security, receipts, offline sync, language, appearance, and system integrations."
      >
        <div className="space-y-6">
          {(offlineModeActive || pendingSync) && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70">{offlineModeActive ? <WifiOff className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}</div><div><p className="font-bold">{offlineModeActive ? "Settings are using offline cache" : "Settings changes waiting to sync"}</p><p className="text-sm opacity-90">Business, receipt, tax, EBM, display, and sync settings can be prepared offline and synced later.</p></div></div><Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">{offlineModeActive ? <WifiOff className="mr-1 h-3 w-3" /> : <UploadCloud className="mr-1 h-3 w-3" />}{offlineModeActive ? "Offline Mode" : "Sync Pending"}</Badge></div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="relative min-h-[190px] overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm xl:col-span-7">
              <div className="pointer-events-none absolute -right-16 -top-16 h-20 w-20 rounded-full bg-blue-200/70" />
              <div className="pointer-events-none absolute -bottom-20 -left-14 h-20 w-20 rounded-full bg-cyan-200/60" />

              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <Settings className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <Badge className="mb-2 rounded-full bg-blue-600 px-3 py-1 text-white hover:bg-blue-600">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    System Operations Center
                  </Badge>

                  <h1 className="text-2xl font-black leading-tight tracking-tight">
                    Settings Control Center
                  </h1>

                  <p className="mt-2 max-w-3xl text-sm leading-5 text-slate-600">
                    Configure business profile, receipts, tax rules, EBM readiness, offline sync,
                    security, display, language, and operational controls from one workspace.
                  </p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-medium text-emerald-700">Business</p>
                      <p className="truncate text-sm font-black text-slate-950">
                        {businessSettings.company_name || "Profile Ready"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
                      <p className="text-xs font-medium text-violet-700">Readiness</p>
                      <p className="text-sm font-black text-violet-700">{readiness.overall}%</p>
                    </div>

                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                      <p className="text-xs font-medium text-cyan-700">Data Source</p>
                      <p className={`text-sm font-black ${onlineReady ? "text-emerald-700" : "text-orange-700"}`}>
                        {onlineReady ? "Live Online" : "Offline Cache"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:col-span-5">
              {[
                {
                  label: "Core Settings",
                  value: readyCount,
                  helper: "ready controls",
                  icon: FileText,
                  card: "bg-rose-600 text-white",
                  iconBox: "bg-white/20 text-white",
                },
                {
                  label: "Receipt Setup",
                  value: `${readiness.receipts}%`,
                  helper: "print ready",
                  icon: Receipt,
                  card: "bg-emerald-600 text-white",
                  iconBox: "bg-white/20 text-white",
                },
                {
                  label: "EBM Setup",
                  value: `${readiness.ebm}%`,
                  helper: "fiscal readiness",
                  icon: ServerCog,
                  card: "bg-orange-600 text-white",
                  iconBox: "bg-white/20 text-white",
                },
                {
                  label: "Pending Sync",
                  value: pendingSync ? 1 : 0,
                  helper: "local changes",
                  icon: UploadCloud,
                  card: "bg-violet-600 text-white",
                  iconBox: "bg-white/20 text-white",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className={`relative min-h-[102px] overflow-hidden rounded-2xl p-3 shadow-sm ${item.card}`}>
                    <div className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full bg-white/15" />
                    <div className="relative flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${item.iconBox}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <ArrowRight className="h-4 w-4 opacity-80" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-white/90">{item.label}</p>
                        <p className="mt-1 text-xl font-black font-data">{item.value}</p>
                        <p className="mt-1 w-fit rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
                          {item.helper}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-700" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search settings, language, appearance, tax, receipts, EBM, security..."
                  className="h-10 rounded-xl border-blue-200 bg-white pl-11 text-blue-900 placeholder:text-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button className="rounded-xl bg-violet-600 text-white hover:bg-violet-700" onClick={validateSettings}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Health Check
                </Button>

                <Button className="rounded-xl bg-cyan-600 text-white hover:bg-cyan-700" onClick={exportSettings}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export
                </Button>

                <Button className="rounded-xl bg-orange-600 text-white hover:bg-orange-700" onClick={() => toast.info("Import settings file support can be connected next.")}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Import
                </Button>

                <Button className="rounded-xl bg-rose-600 text-white hover:bg-rose-700" onClick={resetLocalSettings}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>

                <Button className="rounded-xl bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={saveLocalSettings}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : offlineModeActive ? "Save Offline" : "Save Settings"}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-3xl border border-violet-200 bg-violet-50 p-2 shadow-sm md:grid-cols-4 xl:grid-cols-8">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              const inactiveStyles = [
                "border-blue-200 bg-blue-50 text-blue-700",
                "border-emerald-200 bg-emerald-50 text-emerald-700",
                "border-orange-200 bg-orange-50 text-orange-700",
                "border-violet-200 bg-violet-50 text-violet-700",
                "border-rose-200 bg-rose-50 text-rose-700",
                "border-cyan-200 bg-cyan-50 text-cyan-700",
                "border-orange-200 bg-orange-50 text-orange-700",
                "border-violet-200 bg-violet-50 text-violet-700",
              ];

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    active
                      ? "border-blue-700 bg-blue-600 text-white shadow-sm"
                      : inactiveStyles[index % inactiveStyles.length]
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-bold">{tab.label}</span>
                  </div>
                  <p className={`mt-1 text-[11px] ${active ? "text-white/80" : "opacity-80"}`}>
                    {tab.helper}
                  </p>
                </button>
              );
            })}
          </div>

          {renderSection()}

          <section>
            <div className="mb-4"><h3 className="text-lg font-semibold">Operational Shortcuts</h3><p className="text-sm text-muted-foreground">Quick access to important system configuration modules.</p></div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[{ title: "Users & Permissions", icon: ShieldCheck, link: "/user-management", helper: "Roles and access" }, { title: "Notifications", icon: Bell, link: "/notifications", helper: "Alerts and notices" }, { title: "Receipt Printing", icon: Printer, tab: "receipts", helper: "Printer preferences" }, { title: "Offline Data", icon: HardDriveDownload, tab: "offline", helper: "Cache and sync" }, { title: "Appearance", icon: Palette, tab: "display", helper: "Theme and layout" }].map((item) => { const Icon = item.icon; return <Card key={item.title} className="cursor-pointer rounded-2xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md" onClick={() => item.link ? navigate(item.link) : setActiveTab(item.tab as SettingsTab)}><CardContent className="flex items-center justify-between gap-4 p-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0b3d5c]/10 text-[#0b3d5c]"><Icon className="h-5 w-5" /></div><div><p className="font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.helper}</p></div></div><ArrowRight className="h-4 w-4 text-slate-600" /></CardContent></Card>; })}
            </div>
          </section>
        </div>
      </PageShell>
    </PageBackground>
  );
}
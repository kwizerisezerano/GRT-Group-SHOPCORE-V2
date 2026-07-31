import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  Database,
  Eye,
  KeyRound,
  QrCode,
  Receipt,
  RotateCcw,
  Save,
  ServerCog,
  Wifi,
  WifiOff,
  UploadCloud,
  ShieldCheck,
  Building2,
  FileText,
  RefreshCcw,
  Lock,
  Activity,
  FileCheck2,
  PackageSearch,
  SendHorizontal,
  ClipboardCheck,
  History,
  BarChart3,
  Download,
  Globe2,
  ScanLine,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useEBMSettings,
  useEBMSettingsMutations,
} from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

const NAVY = "#0b3d5c";

const emptyForm = {
  tin: "",
  provider: "",
  api_base_url: "",
  environment: "sandbox",
  username: "",
  password_secret: "",
  device_id: "",
  branch_id: "",
  is_active: false,
};

type EBMForm = typeof emptyForm;

const checklistItems = [
  { label: "Business TIN configured", key: "tin" },
  { label: "EBM provider selected", key: "provider" },
  { label: "API credentials added", key: "username" },
  { label: "API Base URL configured", key: "api_base_url" },
  { label: "Device ID configured", key: "device_id" },
  { label: "Branch ID configured", key: "branch_id" },
  { label: "Environment selected", key: "environment" },
] as const;

const certificationSteps = [
  { title: "Administrative Documents", description: "Business registration, tax clearance, RSSB clearance, physical address, SLA, software documentation, and test cases.", icon: FileCheck2 },
  { title: "Technical Integration", description: "Provider API credentials, VSDC endpoint, invoice payloads, product sync, tax mapping, and receipt response handling.", icon: ServerCog },
  { title: "Fiscal Receipt Validation", description: "Invoice number, tax breakdown, QR verification, signature/SDC fields, receipt replay, and refund scenarios.", icon: Receipt },
  { title: "Production Readiness", description: "Connection health, sync queue, retry rules, audit logs, backup receipts, and monitoring alerts.", icon: ShieldCheck },
];

const fiscalWorkflows = [
  { title: "Product Import", description: "Fetch approved EBM items and map them to ShopCore products, SKUs, taxes, and stock units.", icon: PackageSearch, status: "Provider API Required" },
  { title: "POS Invoice Submission", description: "Submit completed sales, store fiscal response, print verified receipts, and queue offline invoices.", icon: SendHorizontal, status: "Ready Architecture" },
  { title: "Receipt Verification", description: "Prepare QR code, invoice number, tax summary, device ID, and verification metadata.", icon: ScanLine, status: "Preview Ready" },
  { title: "Compliance Audit Trail", description: "Track settings changes, submitted invoices, failed sync attempts, and fiscal status by sale.", icon: ClipboardCheck, status: "Planned" },
];

const certificationChecklist = [
  "Business Registration Certificate",
  "Valid RSSB Clearance Certificate",
  "Valid RRA Tax Clearance Certificate",
  "Physical Address",
  "Software Documentation",
  "Software Support SLA",
  "Test Cases Document",
] as const;

type CertificationRecord = {
  id: string;
  tenant_id: string | null;
  title: string;
  status: "pending" | "ready";
  updated_at: string;
};

type EBMQueuedAction = {
  id: string;
  tenant_id: string | null;
  action: "product_import" | "invoice_sync" | "receipt_test" | "settings_update" | "test_connection";
  status: "queued" | "provider_required" | "ready" | "running" | "success" | "failed";
  payload: Record<string, any>;
  created_at: string;
  operation: "create" | "update";
  sync_status: "pending" | "pending_update" | "synced";
};

function makeScopedKey(base: string, tenantId?: string | null) {
  return tenantId ? `${base}_${tenantId}` : base;
}

const providerPresets = [
  { name: "RRA VSDC", environment: "sandbox", url: "https://vsdc-api-provider.example" },
  { name: "Custom Middleware", environment: "sandbox", url: "" },
  { name: "Production Gateway", environment: "production", url: "" },
];

function makeCacheKey(tenantId?: string | null) {
  return tenantId ? `ebm_settings_${tenantId}` : "ebm_settings";
}

function normalizeSettingsPayload(form: EBMForm) {
  return {
    tin: form.tin.trim() || null,
    provider: form.provider.trim() || null,
    api_base_url: form.api_base_url.trim() || null,
    environment: form.environment.trim() || "sandbox",
    username: form.username.trim() || null,
    password_secret: form.password_secret.trim() || null,
    device_id: form.device_id.trim() || null,
    branch_id: form.branch_id.trim() || null,
  };
}

function normalizeSettingsToForm(settings: any): EBMForm {
  return {
    tin: settings?.tin || "",
    provider: settings?.provider || "",
    api_base_url: settings?.api_base_url || "",
    environment: settings?.environment || "sandbox",
    username: settings?.username || "",
    password_secret: settings?.password_secret || "",
    device_id: settings?.device_id || "",
    branch_id: settings?.branch_id || "",
    is_active: Boolean(settings?.is_active),
  };
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

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function getConnectionLabel(form: EBMForm, complete: boolean) {
  if (isPendingSync(form)) return "Pending Sync";
  if (complete && form.is_active) return "Active";
  if (complete) return "Ready";
  return "Setup Required";
}

function maskSecret(value: string) {
  if (!value) return "Not set";
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(value.length - 4, 10))}${value.slice(-4)}`;
}

type VSDCAction = "test_connection" | "import_products" | "submit_invoice" | "retry_invoice" | "get_submission_status";

type VSDCInvokeResult = {
  ok: boolean;
  message?: string;
  data?: any;
  imported?: number;
  synced?: number;
  failed?: number;
  receipt_number?: string;
  qr_code?: string;
};

async function invokeVSDCEdge(action: VSDCAction, payload: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("ebm-vsdc", {
    body: { action, ...payload },
  });

  if (error) throw error;

  const result = (data || {}) as VSDCInvokeResult;

  if (result.ok === false) {
    throw new Error(result.message || "VSDC operation failed");
  }

  return result;
}

function getSafeSettingsForEdge(form: EBMForm, tenantId?: string | null) {
  return {
    tenant_id: tenantId || null,
    tin: form.tin.trim(),
    provider: form.provider.trim(),
    api_base_url: form.api_base_url.trim(),
    environment: form.environment.trim() || "sandbox",
    username: form.username.trim(),
    device_id: form.device_id.trim(),
    branch_id: form.branch_id.trim(),
  };
}

function getVSDCSetupError(form: EBMForm) {
  if (!form.tin.trim()) return "Business TIN is required.";
  if (!form.provider.trim()) return "EBM/VSDC provider is required.";
  if (!form.api_base_url.trim()) return "API base URL is required.";
  if (!form.username.trim()) return "Username or client ID is required.";
  if (!form.password_secret.trim()) return "Password or client secret is required.";
  if (!form.device_id.trim()) return "Device ID is required.";
  if (!form.branch_id.trim()) return "Branch ID is required.";
  return "";
}

export default function EBMSettings() {
  const { data: settings, isLoading } = useEBMSettings();
  const { save, reset } = useEBMSettingsMutations();
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EBMForm>(emptyForm);
  const [showSecret, setShowSecret] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [activeView, setActiveView] = useState<"setup" | "workflow" | "receipt" | "audit">("setup");
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [syncQueuePreview, setSyncQueuePreview] = useState<any[]>([]);
  const [certificationDocs, setCertificationDocs] = useState<CertificationRecord[]>([]);
  const [actionQueue, setActionQueue] = useState<EBMQueuedAction[]>([]);
  const [runningAction, setRunningAction] = useState<VSDCAction | null>(null);
  const [lastProviderResponse, setLastProviderResponse] = useState<VSDCInvokeResult | null>(null);

  const onlineReady = isOnline() && !isOfflineMode() && !!session?.access_token;
  const offlineModeActive = !onlineReady;
  const pendingSync = isPendingSync(form);

  useEffect(() => {
    const loadCachedSettings = async () => {
      if (!tenantId) return;
      const cached = await getCachedTable(makeCacheKey(tenantId));
      if (Array.isArray(cached) && cached[0]) {
        setForm(normalizeSettingsToForm(cached[0]));
      }
    };

    if (settings) {
      const nextForm = normalizeSettingsToForm(settings);
      setForm(nextForm);

      if (tenantId) {
        saveCachedTable(makeCacheKey(tenantId), [settings]).catch(() => undefined);
      }
      return;
    }

    if (!settings && tenantId) {
      loadCachedSettings().catch(() => undefined);
    }
  }, [settings, tenantId]);

  useEffect(() => {
    const loadSyncQueuePreview = async () => {
      const pendingRows = ((await getCachedTable("pending_sync_queue")) || []) as any[];
      const ebmRows = pendingRows.filter((row: any) =>
        String(row?.table || row?.tableName || row?.key || "").toLowerCase().includes("ebm")
      );
      setSyncQueuePreview(ebmRows.slice(0, 8));
    };

    loadSyncQueuePreview().catch(() => undefined);
  }, [tenantId, pendingSync]);

  useEffect(() => {
    const loadLocalCompliance = async () => {
      const certKey = makeScopedKey("ebm_certification_checklist", tenantId);
      const queueKey = makeScopedKey("ebm_action_queue", tenantId);
      const cachedCerts = ((await getCachedTable(certKey)) || []) as CertificationRecord[];
      const cachedActions = ((await getCachedTable(queueKey)) || []) as EBMQueuedAction[];

      if (cachedCerts.length) {
        setCertificationDocs(cachedCerts);
      } else {
        setCertificationDocs(certificationChecklist.map((title) => ({ id: makeLocalId("ebm-cert"), tenant_id: tenantId || null, title, status: "pending", updated_at: new Date().toISOString() })));
      }

      setActionQueue(cachedActions);
    };

    loadLocalCompliance().catch(() => undefined);
  }, [tenantId]);

  const completedCount = useMemo(() => {
    return checklistItems.filter((item) => String(form[item.key] || "").trim()).length;
  }, [form]);

  const completion = Math.round((completedCount / checklistItems.length) * 100);
  const isComplete = completion === 100;
  const connectionLabel = getConnectionLabel(form, isComplete);
  const securityScore = Math.min(
    100,
    35 +
      (form.tin ? 10 : 0) +
      (form.provider ? 10 : 0) +
      (form.api_base_url ? 10 : 0) +
      (form.username ? 10 : 0) +
      (form.password_secret ? 10 : 0) +
      (form.device_id ? 8 : 0) +
      (form.branch_id ? 7 : 0)
  );
  const readinessLabel = securityScore >= 90 ? "Enterprise Ready" : securityScore >= 70 ? "Almost Ready" : securityScore >= 45 ? "In Progress" : "Setup Required";

  const certificationReady = certificationDocs.filter((doc) => doc.status === "ready").length;
  const certificationProgress = certificationDocs.length ? Math.round((certificationReady / certificationDocs.length) * 100) : 0;
  const pendingActionCount = actionQueue.filter((item) => item.sync_status !== "synced").length;

  const generatedReceiptPreview = {
    businessTin: form.tin || "TIN REQUIRED",
    provider: form.provider || "Provider pending",
    device: form.device_id || "Device ID pending",
    branch: form.branch_id || "Branch ID pending",
    invoiceNo: "SC-FISCAL-000001",
    verificationCode: "QR-PENDING",
    environment: form.environment || "sandbox",
  };

  const updateField = (field: keyof EBMForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const refreshEBMQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ebm_settings"] }),
      queryClient.invalidateQueries({ queryKey: ["sales"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const saveOfflineSettings = async () => {
    if (!tenantId) {
      toast.error("No active workspace");
      return;
    }

    const now = new Date().toISOString();
    const payload = normalizeSettingsPayload(form);
    const offlineRow = {
      ...payload,
      id: (settings as any)?.id || makeLocalId("offline-ebm-settings"),
      tenant_id: tenantId,
      user_id: user?.id || null,
      is_active: isComplete,
      operation: (settings as any)?.id ? "update" : "create",
      sync_status: (settings as any)?.id ? "pending_update" : "pending",
      created_at: (settings as any)?.created_at || now,
      updated_at: now,
      updated_offline_at: now,
    };

    setSavingOffline(true);

    try {
      await saveCachedTable(makeCacheKey(tenantId), [offlineRow]);
      await saveCachedTable("ebm_settings", [offlineRow]);
      await savePending("ebm_settings", offlineRow);

      setForm(normalizeSettingsToForm(offlineRow));
      await refreshEBMQueries();

      toast.success("EBM settings saved offline. They will sync when internet returns.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save EBM settings offline");
    } finally {
      setSavingOffline(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) {
      toast.error("No active workspace");
      return;
    }

    const payload = normalizeSettingsPayload(form);

    if (!payload.tin) {
      toast.error("Business TIN is required.");
      return;
    }

    if (!onlineReady) {
      await saveOfflineSettings();
      return;
    }

    try {
      await save.mutateAsync({
        ...payload,
        is_active: isComplete,
      } as any);

      await saveCachedTable(makeCacheKey(tenantId), [
        {
          ...(settings || {}),
          ...payload,
          is_active: isComplete,
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        },
      ]);

      await refreshEBMQueries();
      toast.success("EBM settings saved successfully.");
    } catch (error: any) {
      if (isNetworkError(error) || !isOnline()) {
        await saveOfflineSettings();
        return;
      }

      toast.error(error?.message || "Failed to save EBM settings");
    }
  };

  const handleReset = async () => {
    setForm(emptyForm);

    if (!onlineReady) {
      if (tenantId) {
        await saveCachedTable(makeCacheKey(tenantId), []);
        await savePending("ebm_settings", {
          id: (settings as any)?.id || makeLocalId("offline-ebm-settings-reset"),
          tenant_id: tenantId,
          operation: "delete",
          sync_status: "pending_delete",
          updated_offline_at: new Date().toISOString(),
        });
      }
      toast.success("EBM reset saved offline. It will sync when internet returns.");
      return;
    }

    reset.mutate(undefined, {
      onSuccess: async () => {
        if (tenantId) await saveCachedTable(makeCacheKey(tenantId), []);
        await refreshEBMQueries();
        toast.success("EBM settings reset.");
      },
      onError: (error: any) => toast.error(error?.message || "Failed to reset EBM settings"),
    });
  };

  const applyProviderPreset = (preset: (typeof providerPresets)[number]) => {
    setForm((prev) => ({
      ...prev,
      provider: preset.name,
      environment: preset.environment,
      api_base_url: preset.url || prev.api_base_url,
    }));
    toast.success(`${preset.name} preset applied`);
  };

  const runDiagnostics = () => {
    const results: string[] = [];

    results.push(form.tin ? "TIN configured" : "TIN missing");
    results.push(form.provider ? "Provider selected" : "Provider missing");
    results.push(form.api_base_url ? "API base URL configured" : "API URL missing");
    results.push(form.username ? "Credential username/client ID configured" : "Credential username/client ID missing");
    results.push(form.password_secret ? "Secret configured" : "Secret missing");
    results.push(form.device_id ? "Device ID configured" : "Device ID missing");
    results.push(form.branch_id ? "Branch ID configured" : "Branch ID missing");
    results.push(onlineReady ? "Online mode available" : "Offline cache mode active");
    results.push(syncQueuePreview.length ? `${syncQueuePreview.length} EBM sync items pending` : "No EBM pending sync items detected");
    results.push(actionQueue.length ? `${actionQueue.length} local EBM action(s) queued` : "No local EBM actions queued");
    results.push(certificationDocs.length ? `${certificationReady}/${certificationDocs.length} certification document(s) marked ready` : "Certification checklist not initialized");

    setDiagnostics(results);
    toast.success("EBM diagnostics completed");
  };

  const saveCertificationDocs = async (rows: CertificationRecord[]) => {
    const certKey = makeScopedKey("ebm_certification_checklist", tenantId);
    await saveCachedTable(certKey, rows);
    setCertificationDocs(rows);
  };

  const toggleCertificationDoc = async (doc: CertificationRecord) => {
    const rows = certificationDocs.map((item) =>
      item.id === doc.id
        ? { ...item, status: item.status === "ready" ? "pending" : "ready", updated_at: new Date().toISOString() } as CertificationRecord
        : item
    );

    await saveCertificationDocs(rows);
    toast.success("Certification checklist updated.");
  };

  const queueEBMAction = async (action: EBMQueuedAction["action"], payload: Record<string, any> = {}, status: EBMQueuedAction["status"] = "queued") => {
    if (!tenantId) {
      toast.error("No active workspace");
      return null;
    }

    const row: EBMQueuedAction = {
      id: makeLocalId("ebm-action"),
      tenant_id: tenantId,
      action,
      status,
      payload,
      created_at: new Date().toISOString(),
      operation: "create",
      sync_status: status === "success" || status === "ready" ? "synced" : "pending",
    };

    const queueKey = makeScopedKey("ebm_action_queue", tenantId);
    const next = [row, ...actionQueue].slice(0, 200);
    await saveCachedTable(queueKey, next);
    if (row.sync_status !== "synced") await savePending("ebm_sync_queue", row).catch(() => undefined);
    setActionQueue(next);
    return row;
  };

  const requestProductImport = async () => {
    if (!isComplete) {
      toast.error("Complete EBM settings before requesting product import.");
      return;
    }

    if (!onlineReady) {
      await queueEBMAction("product_import", { provider: form.provider, environment: form.environment }, "queued");
      toast.info("Product import request saved offline.");
      return;
    }

    setRunningAction("import_products");
    try {
      const result = await invokeVSDCEdge("import_products", {
        settings: getSafeSettingsForEdge(form, tenantId),
      });
      setLastProviderResponse(result);
      await queueEBMAction("product_import", { imported: result.imported || 0, response: result.data || null }, "success");
      await refreshEBMQueries();
      toast.success(result.message || `Product import completed. Imported: ${result.imported || 0}.`);
    } catch (error: any) {
      await queueEBMAction("product_import", { error: error?.message || "Product import failed" }, "failed");
      toast.error(error?.message || "Product import failed.");
    } finally {
      setRunningAction(null);
    }
  };

  const requestInvoiceSync = async () => {
    if (!isComplete) {
      toast.error("Complete EBM settings before configuring invoice sync.");
      return;
    }

    if (!onlineReady) {
      await queueEBMAction("invoice_sync", { device_id: form.device_id, branch_id: form.branch_id, environment: form.environment }, "queued");
      toast.info("Invoice sync action saved offline.");
      return;
    }

    setRunningAction("submit_invoice");
    try {
      const result = await invokeVSDCEdge("submit_invoice", {
        settings: getSafeSettingsForEdge(form, tenantId),
        mode: "sync_pending",
      });
      setLastProviderResponse(result);
      await queueEBMAction("invoice_sync", { synced: result.synced || 0, failed: result.failed || 0, response: result.data || null }, result.failed ? "failed" : "success");
      await refreshEBMQueries();
      toast.success(result.message || `Invoice sync completed. Synced: ${result.synced || 0}.`);
    } catch (error: any) {
      await queueEBMAction("invoice_sync", { error: error?.message || "Invoice sync failed" }, "failed");
      toast.error(error?.message || "Invoice sync failed.");
    } finally {
      setRunningAction(null);
    }
  };

  const requestReceiptTest = async () => {
    await queueEBMAction("receipt_test", generatedReceiptPreview, "queued");
    setActiveView("receipt");
    toast.success("Receipt test action added to the EBM queue.");
  };

  const openPrintableReport = (title: string, body: string) => {
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) {
      toast.error("Unable to open report window.");
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
            .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid ${NAVY}; padding-bottom: 16px; margin-bottom: 20px; }
            h1 { margin: 0; color: ${NAVY}; font-size: 24px; }
            h2 { color: #111827; font-size: 16px; margin-top: 24px; }
            .meta { color: #64748b; font-size: 12px; line-height: 1.6; text-align: right; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
            .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px; background: #f8fafc; }
            .label { color: #64748b; font-size: 11px; text-transform: uppercase; }
            .value { font-size: 16px; font-weight: 800; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: ${NAVY}; color: white; text-align: left; padding: 10px; font-size: 12px; }
            td { border-bottom: 1px solid #e5e7eb; padding: 10px; font-size: 12px; vertical-align: top; }
            .ready { color: #047857; font-weight: 700; }
            .pending { color: #b45309; font-weight: 700; }
            .footer { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; font-size: 12px; }
            .signature { border-top: 1px solid #111827; padding-top: 8px; margin-top: 40px; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          ${body}
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const exportCertificationReport = () => {
    const connectionRows = checklistItems.map((item) => {
      const done = Boolean(String(form[item.key] || "").trim());
      return `<tr><td>${item.label}</td><td class="${done ? "ready" : "pending"}">${done ? "Ready" : "Pending"}</td></tr>`;
    }).join("");

    const documentRows = certificationDocs.map((doc) => `<tr><td>${doc.title}</td><td class="${doc.status === "ready" ? "ready" : "pending"}">${doc.status === "ready" ? "Ready" : "Pending"}</td><td>${doc.updated_at ? new Date(doc.updated_at).toLocaleDateString("en-GB") : "—"}</td></tr>`).join("");

    openPrintableReport(
      "ShopCore EBM Certification Readiness Report",
      `
        <div class="header">
          <div>
            <h1>ShopCore EBM Certification Readiness Report</h1>
            <p>Prepared for RRA VSDC / EBM readiness review.</p>
          </div>
          <div class="meta">Generated: ${new Date().toLocaleString("en-GB")}<br/>TIN: ${form.tin || "Not configured"}<br/>Environment: ${form.environment || "sandbox"}</div>
        </div>
        <div class="summary">
          <div class="card"><div class="label">Readiness Score</div><div class="value">${securityScore}%</div></div>
          <div class="card"><div class="label">Setup Completion</div><div class="value">${completion}%</div></div>
          <div class="card"><div class="label">Certification Documents</div><div class="value">${certificationReady}/${certificationDocs.length || certificationChecklist.length}</div></div>
          <div class="card"><div class="label">Provider</div><div class="value">${form.provider || "Pending"}</div></div>
        </div>
        <h2>Connection Checklist</h2>
        <table><thead><tr><th>Requirement</th><th>Status</th></tr></thead><tbody>${connectionRows}</tbody></table>
        <h2>Certification Documents</h2>
        <table><thead><tr><th>Document</th><th>Status</th><th>Last Updated</th></tr></thead><tbody>${documentRows}</tbody></table>
        <h2>System Details</h2>
        <table><tbody><tr><td>Device ID</td><td>${form.device_id || "Not configured"}</td></tr><tr><td>Branch ID</td><td>${form.branch_id || "Not configured"}</td></tr><tr><td>API Base URL</td><td>${form.api_base_url || "Not configured"}</td></tr><tr><td>Connection Status</td><td>${connectionLabel}</td></tr></tbody></table>
        <div class="footer"><div class="signature">Prepared By</div><div class="signature">Reviewed By</div></div>
      `
    );
  };

  const exportAuditReport = () => {
    const queueRows = [...syncQueuePreview, ...actionQueue].slice(0, 50).map((row: any) => `<tr><td>${row?.action || row?.table || row?.tableName || row?.key || "EBM Item"}</td><td>${row?.operation || "create"}</td><td>${row?.sync_status || row?.status || "pending"}</td><td>${row?.created_at ? new Date(row.created_at).toLocaleString("en-GB") : "—"}</td></tr>`).join("");

    openPrintableReport(
      "ShopCore EBM Audit & Sync Report",
      `
        <div class="header">
          <div>
            <h1>ShopCore EBM Audit & Sync Report</h1>
            <p>Fiscal integration queue, setup health, and local sync status.</p>
          </div>
          <div class="meta">Generated: ${new Date().toLocaleString("en-GB")}<br/>TIN: ${form.tin || "Not configured"}<br/>Mode: ${onlineReady ? "Online Live" : "Offline Cache"}</div>
        </div>
        <div class="summary">
          <div class="card"><div class="label">Pending Queue</div><div class="value">${syncQueuePreview.length + pendingActionCount}</div></div>
          <div class="card"><div class="label">Action Queue</div><div class="value">${actionQueue.length}</div></div>
          <div class="card"><div class="label">Readiness</div><div class="value">${securityScore}%</div></div>
          <div class="card"><div class="label">Connection</div><div class="value">${connectionLabel}</div></div>
        </div>
        <h2>Pending EBM Work</h2>
        <table><thead><tr><th>Item</th><th>Operation</th><th>Status</th><th>Created</th></tr></thead><tbody>${queueRows || `<tr><td colspan="4">No EBM queue records available.</td></tr>`}</tbody></table>
        <h2>Diagnostics</h2>
        <table><tbody>
          <tr><td>TIN</td><td>${form.tin ? "Configured" : "Missing"}</td></tr>
          <tr><td>Provider</td><td>${form.provider || "Missing"}</td></tr>
          <tr><td>Device ID</td><td>${form.device_id || "Missing"}</td></tr>
          <tr><td>Branch ID</td><td>${form.branch_id || "Missing"}</td></tr>
          <tr><td>API URL</td><td>${form.api_base_url || "Missing"}</td></tr>
        </tbody></table>
        <div class="footer"><div class="signature">Prepared By</div><div class="signature">Reviewed By</div></div>
      `
    );
  };

  const handleTestConnection = async () => {
    if (!onlineReady) {
      await queueEBMAction("test_connection", getSafeSettingsForEdge(form, tenantId), "queued");
      toast.info("Connection test queued. Internet and online login are required.");
      return;
    }

    const setupError = getVSDCSetupError(form);
    if (setupError) {
      toast.error(setupError);
      return;
    }

    setRunningAction("test_connection");
    try {
      const result = await invokeVSDCEdge("test_connection", {
        settings: getSafeSettingsForEdge(form, tenantId),
      });
      setLastProviderResponse(result);
      await queueEBMAction("test_connection", { message: result.message || "Connection successful" }, "success");
      toast.success(result.message || "VSDC connection successful.");
    } catch (error: any) {
      await queueEBMAction("test_connection", { error: error?.message || "Connection failed" }, "failed");
      toast.error(error?.message || "VSDC connection failed.");
    } finally {
      setRunningAction(null);
    }
  };

  const summaryCards = [
    {
      label: "Business TIN",
      value: form.tin ? "Configured" : "Required",
      helper: form.tin || "Fiscal identity",
      icon: Receipt,
      cardClass: "border-rose-600 bg-rose-600 text-white",
      iconClass: "bg-white/20 text-white",
      valueClass: "text-white",
    },
    {
      label: "EBM Provider",
      value: form.provider || "Pending",
      helper: form.environment || "Environment",
      icon: ServerCog,
      cardClass: "border-emerald-600 bg-emerald-600 text-white",
      iconClass: "bg-white/20 text-white",
      valueClass: "text-white",
    },
    {
      label: "Product Sync",
      value: isComplete ? "Ready" : "Planned",
      helper: "Import products",
      icon: Database,
      cardClass: "border-orange-600 bg-orange-600 text-white",
      iconClass: "bg-white/20 text-white",
      valueClass: "text-white",
    },
    {
      label: "Receipt QR / Layout",
      value: "Prepared",
      helper: "QR & tax layout",
      icon: QrCode,
      cardClass: "border-violet-600 bg-violet-600 text-white",
      iconClass: "bg-white/20 text-white",
      valueClass: "text-white",
    },
  ];

  return (
    <PageBackground image={warehouseBg} opacity={0.04}>
      <PageShell
        title="EBM Setup"
        description="Configure fiscal invoicing, EBM credentials, product sync, and POS invoice submission."
      >
        <div className="space-y-5">
          {(offlineModeActive || pendingSync) && (
            <div className="rounded-xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70">
                    {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive ? "EBM settings are using offline cache" : "EBM settings waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      You can prepare settings offline, but connection testing, product import, and invoice submission require online login.
                    </p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                  {offlineModeActive ? <WifiOff className="mr-1 h-3 w-3" /> : <UploadCloud className="mr-1 h-3 w-3" />}
                  {offlineModeActive ? "Offline Mode" : "Sync Pending"}
                </Badge>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.25fr]">
              <div className="relative overflow-hidden border-b xl:border-b-0 xl:border-r bg-gradient-to-br from-white via-slate-50 to-orange-50/40 p-4 lg:p-4">
                <div className="absolute -right-16 -top-16 h-28 w-28 rounded-full bg-orange-500/10 blur-2xl" />
                <div className="absolute -bottom-20 -left-20 h-32 w-32 rounded-full bg-[#0b3d5c]/10 blur-2xl" />

                <div className="relative">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#0b3d5c]/10 px-3 py-1 text-xs font-semibold text-[#0b3d5c]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Fiscal Integration
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b3d5c] to-[#16719a] text-white shadow-sm">
                        <ServerCog className="h-8 w-8" />
                      </div>
                      <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white ${isComplete ? "bg-emerald-500" : "bg-amber-500"}`} />
                    </div>

                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-950 lg:text-2xl">
                        EBM / Fiscal Configuration
                      </h1>
                      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                        Prepare RRA EBM/VSDC settings for product import, sales submission, receipt QR verification, and fiscal reporting.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 text-blue-600" />
                        Branch ID
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold">{form.branch_id || "Not set"}</p>
                    </div>

                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5 text-orange-600" />
                        Secret
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold">{maskSecret(form.password_secret)}</p>
                    </div>

                    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {onlineReady ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-amber-600" />}
                        Mode
                      </div>
                      <p className="mt-1 text-sm font-semibold">{onlineReady ? "Online Live" : "Offline Cache"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 bg-slate-50/70 p-4 lg:grid-cols-2 xl:grid-cols-4 lg:p-7">
                {summaryCards.map((card) => (
                  <Card key={card.label} className={`relative min-h-[112px] overflow-hidden rounded-xl border-0 shadow-sm ${card.cardClass}`}>
                    <div className="pointer-events-none absolute -right-7 -top-9 h-24 w-24 rounded-full bg-white/15" />
                    <div className="pointer-events-none absolute right-5 top-8 h-3 w-3 rounded-full bg-white/35" />
                    <CardContent className="relative flex h-full flex-col justify-between p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${card.iconClass}`}>
                          <card.icon className="h-5 w-5" />
                        </div>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white">
                          →
                        </span>
                      </div>

                      <div className="pt-6">
                        <p className="text-sm font-bold text-white/90">{card.label}</p>
                        <p className={`mt-1 truncate text-2xl font-black font-data ${card.valueClass}`}>
                          {card.value}
                        </p>
                        <p className="mt-3 w-fit max-w-full truncate rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                          {card.helper}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <Card className="rounded-xl border-amber-100 bg-gradient-to-r from-amber-50 to-white shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  {isComplete ? <BadgeCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>

                <div>
                  <h3 className="font-semibold">
                    {isComplete ? "EBM setup details are complete" : "EBM connection is not active yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Complete the fiscal settings below before activating product import, POS invoice sync, and receipt verification.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={`w-fit rounded-full ${
                    isComplete
                      ? "bg-emerald-600 hover:bg-emerald-600"
                      : "bg-orange-600 hover:bg-orange-600"
                  }`}
                >
                  {connectionLabel}
                </Badge>

                <Badge variant="outline" className="rounded-full">
                  {completion}% Complete
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Readiness Score", value: `${securityScore}%`, helper: readinessLabel, icon: BarChart3, color: "bg-blue-600 text-white" },
              { label: "Completion", value: `${completion}%`, helper: `${completedCount}/${checklistItems.length} required fields`, icon: BarChart3, color: "bg-emerald-600 text-white" },
              { label: "Environment", value: form.environment || "sandbox", helper: onlineReady ? "Online capable" : "Offline cache", icon: Globe2, color: "bg-orange-600 text-white" },
              { label: "Sync Queue", value: String(syncQueuePreview.length + pendingActionCount), helper: pendingSync || pendingActionCount ? "Pending EBM work" : "No local EBM queue", icon: UploadCloud, color: "bg-violet-600 text-white" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.label} className={`relative min-h-[104px] overflow-hidden rounded-xl border-0 shadow-sm ${item.color}`}>
                  <div className="pointer-events-none absolute -right-7 -top-9 h-24 w-24 rounded-full bg-white/15" />
                  <CardContent className="relative p-4">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-bold text-white/90">{item.label}</p>
                    <p className="mt-1 text-2xl font-black">{item.value}</p>
                    <p className="mt-3 w-fit truncate rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">{item.helper}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { id: "setup", label: "Connection Setup", icon: KeyRound },
                { id: "workflow", label: "Fiscal Workflow", icon: Activity },
                { id: "receipt", label: "Receipt Preview", icon: Receipt },
                { id: "audit", label: "Audit & Sync", icon: History },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id as any)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-[#0b3d5c] bg-[#0b3d5c] text-white shadow-sm"
                        : "bg-muted/30 hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-bold">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {activeView === "workflow" && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {fiscalWorkflows.map((workflow) => (
                <Card key={workflow.title} className="rounded-xl border shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b3d5c]/10 text-[#0b3d5c]">
                      <workflow.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-black">{workflow.title}</h3>
                    <p className="mt-2 min-h-[52px] text-sm leading-6 text-muted-foreground">{workflow.description}</p>
                    <Badge variant="outline" className="mt-4 rounded-full">{workflow.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeView === "receipt" && (
            <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <QrCode className="h-4 w-4 text-violet-600" />
                    Fiscal Receipt Preview
                  </CardTitle>
                  <CardDescription>
                    Visual structure for the future verified EBM receipt printed from POS.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mx-auto max-w-sm rounded-xl border bg-white p-4 shadow-sm">
                    <div className="text-center">
                      <h3 className="text-lg font-black">ShopCore Fiscal Receipt</h3>
                      <p className="text-xs text-muted-foreground">TIN: {generatedReceiptPreview.businessTin}</p>
                      <p className="text-xs text-muted-foreground">{generatedReceiptPreview.provider}</p>
                    </div>
                    <div className="my-4 border-t border-dashed" />
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Invoice</span><span className="font-semibold">{generatedReceiptPreview.invoiceNo}</span></div>
                      <div className="flex justify-between"><span>Device</span><span className="font-semibold">{generatedReceiptPreview.device}</span></div>
                      <div className="flex justify-between"><span>Branch</span><span className="font-semibold">{generatedReceiptPreview.branch}</span></div>
                      <div className="flex justify-between"><span>VAT</span><span className="font-semibold">18%</span></div>
                      <div className="flex justify-between"><span>Environment</span><span className="font-semibold capitalize">{generatedReceiptPreview.environment}</span></div>
                    </div>
                    <div className="my-4 border-t border-dashed" />
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-28 w-28 items-center justify-center rounded-xl border bg-muted/30">
                        <QrCode className="h-10 w-10 text-[#0b3d5c]" />
                      </div>
                      <p className="text-xs text-muted-foreground">Verification: {generatedReceiptPreview.verificationCode}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-violet-100 bg-gradient-to-br from-violet-50 to-white shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <h3 className="font-black">Receipt Requirements</h3>
                  {[
                    "Fiscal invoice number",
                    "Taxable and exempt sales summary",
                    "VAT breakdown",
                    "Device and branch identifiers",
                    "Verification QR code",
                    "EBM response reference",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-xl bg-white/70 p-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {activeView === "audit" && (
            <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4 text-amber-600" />
                    EBM Audit & Sync Center
                  </CardTitle>
                  <CardDescription>
                    Monitor pending EBM settings, future fiscal invoice queue, and local cache health.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {syncQueuePreview.length === 0 ? (
                    <div className="rounded-xl border bg-muted/20 py-10 text-center text-muted-foreground">
                      <Database className="mx-auto mb-2 h-10 w-10 opacity-40" />
                      No EBM-specific pending sync records found.
                    </div>
                  ) : (
                    syncQueuePreview.map((row, index) => (
                      <div key={`${row?.id || index}`} className="rounded-xl border bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold">{row?.table || row?.tableName || row?.key || "EBM Queue Item"}</p>
                            <p className="text-xs text-muted-foreground">{row?.operation || row?.sync_status || "pending"}</p>
                          </div>
                          <Badge variant="outline" className="rounded-full">Pending</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
                <CardContent className="space-y-3 p-4">
                  {lastProviderResponse && (
                    <div className="rounded-xl border bg-white/80 p-3 text-sm">
                      <p className="font-bold">Last Provider Response</p>
                      <p className="mt-1 text-muted-foreground">{lastProviderResponse.message || "Response received from ebm-vsdc."}</p>
                    </div>
                  )}
                  <Button className="w-full rounded-xl bg-blue-600 hover:bg-blue-700" onClick={runDiagnostics}>
                    <Activity className="mr-2 h-4 w-4" />
                    Run Diagnostics
                  </Button>
                  <Button className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={exportCertificationReport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Certification Report
                  </Button>
                  <Button className="w-full rounded-xl bg-violet-600 hover:bg-violet-700" onClick={exportAuditReport}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export EBM Audit Report
                  </Button>
                  <div className="space-y-2 pt-2">
                    {diagnostics.length === 0 ? (
                      <p className="rounded-xl bg-white/70 p-3 text-sm text-muted-foreground">Run diagnostics to validate setup health.</p>
                    ) : (
                      diagnostics.map((item) => (
                        <div key={item} className="flex items-center gap-2 rounded-xl bg-white/70 p-3 text-sm">
                          {item.toLowerCase().includes("missing") ? (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          )}
                          {item}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeView === "setup" && (
            <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
              <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="h-4 w-4 text-orange-600" />
                  EBM Connection Details
                </CardTitle>
                <CardDescription>
                  Store fiscal connection information used for product sync and invoice submission.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {providerPresets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyProviderPreset(preset)}
                      className="rounded-xl border bg-muted/30 p-3 text-left transition hover:bg-muted/60"
                    >
                      <p className="text-sm font-bold">{preset.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground capitalize">{preset.environment}</p>
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={form.tin} onChange={(e) => updateField("tin", e.target.value)} placeholder="Business TIN" className="h-10 rounded-xl border-blue-200 bg-blue-50 placeholder:text-blue-600/70" />
                  <Input value={form.provider} onChange={(e) => updateField("provider", e.target.value)} placeholder="EBM Provider / VSDC Provider" className="h-10 rounded-xl border-emerald-200 bg-emerald-50 placeholder:text-emerald-600/70" />
                  <Input value={form.api_base_url} onChange={(e) => updateField("api_base_url", e.target.value)} placeholder="API Base URL" className="h-10 rounded-xl border-orange-200 bg-orange-50 placeholder:text-orange-600/70" />
                  <Input value={form.environment} onChange={(e) => updateField("environment", e.target.value)} placeholder="sandbox / production" className="h-10 rounded-xl border-violet-200 bg-violet-50 placeholder:text-violet-600/70" />
                  <Input value={form.username} onChange={(e) => updateField("username", e.target.value)} placeholder="Username / Client ID" className="h-10 rounded-xl border-cyan-200 bg-cyan-50 placeholder:text-cyan-600/70" />
                  <div className="flex gap-2">
                    <Input
                      value={form.password_secret}
                      onChange={(e) => updateField("password_secret", e.target.value)}
                      type={showSecret ? "text" : "password"}
                      placeholder="Password / Secret"
                      className="h-10 rounded-xl border-rose-200 bg-rose-50 placeholder:text-rose-600/70"
                    />
                    <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setShowSecret((v) => !v)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input value={form.device_id} onChange={(e) => updateField("device_id", e.target.value)} placeholder="Device ID" className="h-10 rounded-xl border-blue-200 bg-blue-50 placeholder:text-blue-600/70" />
                  <Input value={form.branch_id} onChange={(e) => updateField("branch_id", e.target.value)} placeholder="Branch ID" className="h-10 rounded-xl border-emerald-200 bg-emerald-50 placeholder:text-emerald-600/70" />
                </div>

                <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                    <FileText className="h-4 w-4 text-[#0b3d5c]" />
                    Integration note
                  </div>
                  RRA EBM/VSDC product import and sales submission should only be activated after the provider API specification, credentials, test cases, and certification flow are confirmed.
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={handleSave} disabled={save.isPending || isLoading || savingOffline} className="rounded-xl bg-blue-600 hover:bg-blue-700">
                    <Save className="mr-2 h-4 w-4" />
                    {save.isPending || savingOffline ? "Saving..." : offlineModeActive ? "Save Offline" : "Save EBM Settings"}
                  </Button>

                  <Button type="button" onClick={handleTestConnection} disabled={runningAction === "test_connection"} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                    <ServerCog className="mr-2 h-4 w-4" />
                    {runningAction === "test_connection" ? "Testing..." : "Test Connection"}
                  </Button>

                  <Button
                    type="button"
                    
                    onClick={() => {
                      refreshEBMQueries();
                      toast.info(onlineReady ? "Refreshing EBM settings..." : "Showing cached EBM settings.");
                    }}
                    className="rounded-xl bg-cyan-600 hover:bg-cyan-700"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>

                  <Button type="button" onClick={handleReset} disabled={reset.isPending} className="ml-auto rounded-xl bg-rose-600 hover:bg-rose-700">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {reset.isPending ? "Resetting..." : "Reset"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Setup Checklist
                </CardTitle>
                <CardDescription>Minimum information required before activation.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="mb-2 h-2 rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full ${isComplete ? "bg-emerald-500" : "bg-orange-500"}`}
                    style={{ width: `${completion}%` }}
                  />
                </div>

                {checklistItems.map((item) => {
                  const done = Boolean(String(form[item.key] || "").trim());

                  return (
                    <div key={item.label} className="flex items-center justify-between rounded-xl border bg-muted/30 p-3">
                      <div className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                      </div>

                      <Badge variant={done ? "default" : "outline"} className="rounded-full text-[10px]">
                        {done ? "Done" : "Pending"}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card className="rounded-xl border-blue-100 bg-blue-50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCheck2 className="h-4 w-4 text-blue-600" />
                  Certification Readiness
                </CardTitle>
                <CardDescription>Track the administrative documents required for Rwanda VSDC certification.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${certificationProgress}%` }} />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {certificationDocs.map((doc) => (
                    <button key={doc.id} type="button" onClick={() => toggleCertificationDoc(doc)} className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${doc.status === "ready" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-orange-200 bg-orange-50 text-orange-800"}`}>
                      <span className="text-sm font-semibold">{doc.title}</span>
                      {doc.status === "ready" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-cyan-100 bg-cyan-50 shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <h3 className="font-black">Compliance Score</h3>
                <p className="text-4xl font-black font-data">{certificationProgress}%</p>
                <p className="text-sm text-slate-600">{certificationReady}/{certificationDocs.length || certificationChecklist.length} certification items ready.</p>
                <Button className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700" onClick={requestReceiptTest}>
                  <QrCode className="mr-2 h-4 w-4" />
                  Queue Receipt Test
                </Button>
                <Button className="w-full rounded-xl bg-blue-600 hover:bg-blue-700" onClick={exportCertificationReport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Readiness Report
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                  <Database className="mb-3 h-6 w-6 text-emerald-600" />
                  <h3 className="font-semibold">Import Products From EBM</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Pull fiscal products into ShopCore.</p>
                </div>
                <Button
                  size="sm"
                  className="rounded-2xl"
                  disabled={!isComplete || runningAction === "import_products"}
                  onClick={requestProductImport}
                >
                  {runningAction === "import_products" ? "Importing..." : "Start Import"}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                  <Calculator className="mb-3 h-6 w-6 text-blue-600" />
                  <h3 className="font-semibold">POS Invoice Sync</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Send sales to EBM.</p>
                </div>
                <Button
                  size="sm"
                  className="rounded-2xl"
                  disabled={!isComplete || runningAction === "submit_invoice"}
                  onClick={requestInvoiceSync}
                >
                  {runningAction === "submit_invoice" ? "Syncing..." : "Sync Pending"}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                  <Receipt className="mb-3 h-6 w-6 text-violet-600" />
                  <h3 className="font-semibold">Fiscal Receipt Format</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Preview QR and tax layout.</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={requestReceiptTest}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageShell>
    </PageBackground>
  );
}

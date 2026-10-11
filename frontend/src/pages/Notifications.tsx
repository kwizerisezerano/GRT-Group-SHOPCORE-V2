import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import {  PageContainer,
  SectionCard,
  StatGrid,
  type StatItem,
} from "@/components/patterns";
import {
  Bell,
  Clock,
  Search,
  Filter,
  Package,
  CreditCard,
  ShoppingCart,
  Receipt,
  ShieldAlert,
  Eye,
  EyeOff,
  Trash2,
  Mail,
  Smartphone,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  UploadCloud,
  RotateCcw,
  Plus,
  Download,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedTable, isOnline, saveCachedTable, savePending } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { toast } from "sonner";

const NOTIFICATIONS_CACHE_KEY = "notifications";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "critical" | "warning" | "info" | "success";
  category: "inventory" | "payment" | "sales" | "system" | "approval" | "ebm" | "payroll" | "sync";
  read: boolean;
  createdAt: string;
  tenant_id?: string | null;
  user_id?: string | null;
  operation?: "create" | "update" | "delete";
  sync_status?: "synced" | "pending" | "pending_update" | "pending_delete";
  created_at?: string;
  updated_at?: string;
  created_offline_at?: string;
  updated_offline_at?: string;
}

const seedNotifications: NotificationItem[] = [
  {
    id: "1",
    title: "Low Stock Alert",
    message: "Coca Cola 500ml stock is below minimum threshold.",
    type: "warning",
    category: "inventory",
    read: false,
    createdAt: "5 mins ago",
    sync_status: "synced",
  },
  {
    id: "2",
    title: "Payment Reminder",
    message: "Purchase invoice INV-0024 is due tomorrow.",
    type: "critical",
    category: "payment",
    read: false,
    createdAt: "30 mins ago",
    sync_status: "synced",
  },
  {
    id: "3",
    title: "Large Sale Recorded",
    message: "Sale of RWF 1,250,000 completed successfully.",
    type: "success",
    category: "sales",
    read: true,
    createdAt: "2 hours ago",
    sync_status: "synced",
  },
  {
    id: "4",
    title: "System Backup Completed",
    message: "Daily backup finished successfully.",
    type: "info",
    category: "system",
    read: true,
    createdAt: "Today",
    sync_status: "synced",
  },
  {
    id: "5",
    title: "Expense Approval Required",
    message: "A pending expense needs management review before it affects financial reports.",
    type: "warning",
    category: "approval",
    read: false,
    createdAt: "Today",
    sync_status: "synced",
  },
  {
    id: "6",
    title: "EBM Sync Queue Ready",
    message: "Fiscal invoice queue is prepared for provider connection and VSDC submission.",
    type: "info",
    category: "ebm",
    read: false,
    createdAt: "Today",
    sync_status: "synced",
  },
  {
    id: "7",
    title: "Payroll Review",
    message: "Payroll entries were generated and should be reviewed before payment approval.",
    type: "info",
    category: "payroll",
    read: true,
    createdAt: "Today",
    sync_status: "synced",
  },
];

function makeCacheKey(tenantId?: string | null) {
  return tenantId ? `${NOTIFICATIONS_CACHE_KEY}_${tenantId}` : NOTIFICATIONS_CACHE_KEY;
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

function isDeletedNotification(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete"
  );
}

function getNotificationTime(row: NotificationItem) {
  const value = row.updated_offline_at || row.updated_at || row.created_offline_at || row.created_at;
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortNotifications(rows: NotificationItem[]) {
  return [...rows].sort((a, b) => getNotificationTime(b) - getNotificationTime(a));
}

function dedupeNotifications(rows: NotificationItem[]) {
  const map = new Map<string, NotificationItem>();

  for (const row of rows || []) {
    const key = String(row.id || `${row.title}-${row.createdAt}` || Math.random());
    const existing = map.get(key);

    if (!existing) {
      map.set(key, row);
      continue;
    }

    const existingTime = getNotificationTime(existing);
    const incomingTime = getNotificationTime(row);

    map.set(key, incomingTime >= existingTime ? { ...existing, ...row } : { ...row, ...existing });
  }

  return sortNotifications(
    Array.from(map.values()).filter((notification) => !isDeletedNotification(notification))
  );
}

function makeOfflinePatch(
  notification: NotificationItem,
  patch: Partial<NotificationItem>,
  tenantId?: string | null,
  userId?: string | null
): NotificationItem {
  const now = new Date().toISOString();
  const isOfflineRecord = String(notification.id || "").startsWith("offline-");

  return {
    ...notification,
    ...patch,
    tenant_id: notification.tenant_id || tenantId || null,
    user_id: notification.user_id || userId || null,
    operation: isOfflineRecord ? "create" : "update",
    sync_status: isOfflineRecord ? "pending" : "pending_update",
    updated_at: now,
    updated_offline_at: now,
  };
}

function formatNotificationDate(notification: NotificationItem) {
  if (notification.createdAt && !notification.createdAt.includes("T")) {
    return notification.createdAt;
  }

  const value =
    notification.created_at ||
    notification.created_offline_at ||
    notification.updated_offline_at ||
    notification.createdAt;

  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return notification.createdAt || "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Notifications() {
  const { user, tenantId, session } = useAuth();
  const [search, setSearch] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [syncFilter, setSyncFilter] = useState<"all" | "pending" | "synced">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | NotificationItem["type"]>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | NotificationItem["category"]>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: "",
    message: "",
    type: "info" as NotificationItem["type"],
    category: "system" as NotificationItem["category"],
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>(seedNotifications);

  const onlineReady = isOnline() && !isOfflineMode() && !!session?.access_token;
  const offlineModeActive = !onlineReady;
  const cacheKey = useMemo(() => makeCacheKey(tenantId), [tenantId]);

  const saveNotifications = async (nextRows: NotificationItem[]) => {
    const cleaned = dedupeNotifications(nextRows);
    setNotifications(cleaned);
    await saveCachedTable(cacheKey, cleaned);
    await saveCachedTable(NOTIFICATIONS_CACHE_KEY, cleaned);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  useEffect(() => {
    const loadCachedNotifications = async () => {
      const cached = await getCachedTable(cacheKey);

      if (Array.isArray(cached) && cached.length > 0) {
        setNotifications(dedupeNotifications(cached as NotificationItem[]));
        return;
      }

      await saveCachedTable(cacheKey, seedNotifications);
      await saveCachedTable(NOTIFICATIONS_CACHE_KEY, seedNotifications);
    };

    loadCachedNotifications().catch(() => undefined);
  }, [cacheKey]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (isDeletedNotification(notification)) return false;

      const q = search.toLowerCase().trim();

      const matchesSearch =
        !q ||
        notification.title.toLowerCase().includes(q) ||
        notification.message.toLowerCase().includes(q) ||
        notification.category.toLowerCase().includes(q) ||
        notification.type.toLowerCase().includes(q);

      const matchesReadFilter = showUnreadOnly ? !notification.read : true;
      const matchesType = typeFilter === "all" || notification.type === typeFilter;
      const matchesCategory = categoryFilter === "all" || notification.category === categoryFilter;
      const pending = isPendingSync(notification);
      const matchesSync =
        syncFilter === "all" ||
        (syncFilter === "pending" && pending) ||
        (syncFilter === "synced" && !pending);

      return matchesSearch && matchesReadFilter && matchesType && matchesCategory && matchesSync;
    });
  }, [notifications, search, showUnreadOnly, syncFilter, typeFilter, categoryFilter]);

  const stats = useMemo(() => {
    const active = notifications.filter((n) => !isDeletedNotification(n));

    return {
      unread: active.filter((n) => !n.read).length,
      total: active.length,
      critical: active.filter((n) => n.type === "critical").length,
      warning: active.filter((n) => n.type === "warning").length,
      success: active.filter((n) => n.type === "success").length,
      info: active.filter((n) => n.type === "info").length,
      pendingSync: active.filter(isPendingSync).length,
      read: active.filter((n) => n.read).length,
      inventory: active.filter((n) => n.category === "inventory").length,
      payment: active.filter((n) => n.category === "payment").length,
      sales: active.filter((n) => n.category === "sales").length,
      system: active.filter((n) => n.category === "system").length,
      approval: active.filter((n) => n.category === "approval").length,
      ebm: active.filter((n) => n.category === "ebm").length,
      payroll: active.filter((n) => n.category === "payroll").length,
      sync: active.filter((n) => n.category === "sync").length,
      healthScore: active.length > 0 ? Math.max(0, Math.round(((active.length - active.filter((n) => n.type === "critical").length) / active.length) * 100)) : 100,
    };
  }, [notifications]);

  const selectedNotifications = useMemo(() => {
    const selected = new Set(selectedIds);
    return notifications.filter((notification) => selected.has(notification.id));
  }, [notifications, selectedIds]);

  const toggleSelection = (id: string) => {
    setSelectionMode(true);
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const selectVisibleNotifications = () => {
    setSelectionMode(true);
    setSelectedIds(filteredNotifications.map((notification) => notification.id));
  };

  const createNotification = async () => {
    if (!newNotification.title.trim() || !newNotification.message.trim()) {
      toast.error("Title and message are required");
      return;
    }

    const now = new Date().toISOString();
    const item: NotificationItem = {
      id: `offline-notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: newNotification.title.trim(),
      message: newNotification.message.trim(),
      type: newNotification.type,
      category: newNotification.category,
      read: false,
      createdAt: now,
      tenant_id: tenantId || null,
      user_id: user?.id || null,
      operation: "create",
      sync_status: "pending",
      created_at: now,
      updated_at: now,
      created_offline_at: now,
      updated_offline_at: now,
    };

    await saveNotifications([item, ...notifications]);
    await savePending("notifications", item as any);
    setNewNotification({ title: "", message: "", type: "info", category: "system" });
    setCreateDialogOpen(false);
    toast.success("Notification created");
  };

  const deleteSelectedNotifications = async () => {
    if (!selectedNotifications.length) return;

    const ids = new Set(selectedNotifications.map((notification) => notification.id));
    const now = new Date().toISOString();

    const nextRows = notifications.map((notification) => {
      if (!ids.has(notification.id)) return notification;

      if (String(notification.id).startsWith("offline-")) {
        return {
          ...notification,
          operation: "delete",
          sync_status: "pending_delete",
          updated_offline_at: now,
        } as NotificationItem;
      }

      return makeOfflinePatch(
        notification,
        {
          operation: "delete",
          sync_status: "pending_delete",
        },
        tenantId,
        user?.id
      );
    });

    const queuedRows = nextRows.filter((notification) => ids.has(notification.id));
    await saveNotifications(nextRows);
    for (const row of queuedRows) {
      await savePending("notifications", row as any);
    }

    clearSelection();
    toast.success(`${selectedNotifications.length} notification(s) queued for deletion`);
  };

  const markSelectedRead = async () => {
    if (!selectedNotifications.length) return;

    const ids = new Set(selectedNotifications.map((notification) => notification.id));
    const nextRows = notifications.map((notification) =>
      ids.has(notification.id)
        ? makeOfflinePatch(notification, { read: true }, tenantId, user?.id)
        : notification
    );

    await saveNotifications(nextRows);
    for (const row of nextRows.filter((notification) => ids.has(notification.id))) {
      await savePending("notifications", row as any);
    }

    clearSelection();
    toast.success("Selected notifications marked as read");
  };

  const exportNotificationsCsv = () => {
    const rows = filteredNotifications.map((notification) => ({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      category: notification.category,
      read: notification.read ? "Yes" : "No",
      sync_status: notification.sync_status || "synced",
      created_at: formatNotificationDate(notification),
    }));

    const headers = Object.keys(rows[0] || {
      title: "",
      message: "",
      type: "",
      category: "",
      read: "",
      sync_status: "",
      created_at: "",
    });

    const csv = [
      headers.join(","),
      ...rows.map((row: any) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shopcore_notifications_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const markRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;

    const updated = makeOfflinePatch(target, { read: !target.read }, tenantId, user?.id);

    await saveNotifications(notifications.map((n) => (n.id === id ? updated : n)));
    await savePending("notifications", updated as any);

    toast.success(updated.read ? "Notification marked as read" : "Notification marked as unread");
  };

  const markAllRead = async () => {
    const nextRows = notifications.map((n) =>
      n.read ? n : makeOfflinePatch(n, { read: true }, tenantId, user?.id)
    );

    await saveNotifications(nextRows);

    for (const row of nextRows.filter(isPendingSync)) {
      await savePending("notifications", row as any);
    }

    toast.success("All notifications marked as read");
  };

  const clearRead = async () => {
    const now = new Date().toISOString();

    const nextRows = notifications.map((n) => {
      if (!n.read) return n;

      if (String(n.id).startsWith("offline-")) {
        return {
          ...n,
          operation: "delete",
          sync_status: "pending_delete",
          updated_offline_at: now,
        } as NotificationItem;
      }

      return makeOfflinePatch(
        n,
        {
          operation: "delete",
          sync_status: "pending_delete",
        },
        tenantId,
        user?.id
      );
    });

    const deletedRows = nextRows.filter((n) => n.read && isPendingSync(n));
    await saveNotifications(nextRows);

    for (const row of deletedRows) {
      await savePending("notifications", row as any);
    }

    toast.success("Read notifications cleared");
  };

  const deleteNotification = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;

    if (String(id).startsWith("offline-")) {
      await saveNotifications(notifications.filter((n) => n.id !== id));
      toast.success("Offline notification deleted locally");
      return;
    }

    const deleted = makeOfflinePatch(
      target,
      {
        operation: "delete",
        sync_status: "pending_delete",
      },
      tenantId,
      user?.id
    );

    await saveNotifications(notifications.map((n) => (n.id === id ? deleted : n)));
    await savePending("notifications", deleted as any);

    toast.success("Notification deletion queued");
  };

  const resetFilters = () => {
    setSearch("");
    setShowUnreadOnly(false);
    setSyncFilter("all");
    setTypeFilter("all");
    setCategoryFilter("all");
    clearSelection();
  };

  const getTypeBadge = (type: NotificationItem["type"]) => {
    if (type === "critical") {
      return (
        <Badge variant="outline" className="rounded-full border-rose-500/30 bg-rose-500/10 text-rose-600">
          Critical
        </Badge>
      );
    }

    if (type === "warning") {
      return (
        <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600">
          Warning
        </Badge>
      );
    }

    if (type === "success") {
      return (
        <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
          Success
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-muted-foreground">
        Info
      </Badge>
    );
  };

  const getCategoryIcon = (category: NotificationItem["category"]) => {
    if (category === "inventory") return Package;
    if (category === "payment") return CreditCard;
    if (category === "sales") return ShoppingCart;
    if (category === "approval") return ShieldCheck;
    if (category === "ebm") return Receipt;
    if (category === "payroll") return CreditCard;
    if (category === "sync") return UploadCloud;
    return Settings;
  };

  const getTypeIcon = (type: NotificationItem["type"]) => {
    if (type === "critical") return ShieldAlert;
    if (type === "warning") return AlertTriangle;
    if (type === "success") return CheckCircle2;
    return Info;
  };


const statCards: StatItem[] = [
    { label: "Total Alerts", value: stats.total, icon: Bell, tone: "indigo", helper: "notification records" },
    {
      label: "Unread",
      value: stats.unread,
      icon: Eye,
      tone: stats.unread > 0 ? "amber" : "emerald",
      helper: "requires review",
    },
    {
      label: "Warnings",
      value: stats.warning,
      icon: AlertTriangle,
      tone: stats.warning > 0 ? "amber" : "sky",
      helper: "operations watch",
    },
    {
      label: "Critical",
      value: stats.critical,
      icon: ShieldAlert,
      tone: stats.critical > 0 ? "rose" : "teal",
      helper: "priority alerts",
    },
    {
      label: "Pending Sync",
      value: stats.pendingSync,
      icon: UploadCloud,
      tone: stats.pendingSync > 0 ? "amber" : "cyan",
      helper: "offline queue",
    },
  ];

    return (
    <PageShell
      title="Notifications"
      description="Review system alerts, warnings and operational updates for this workspace."
    >
      <PageBackground image={warehouseBg} opacity={0}>
        <PageContainer>

          <StatGrid items={statCards} columns={5} />

          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-h-[48px] flex-1 items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-sm">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search notifications, categories, or alert types..."
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                />
              </div>

              <Button
                className={`h-12 rounded-2xl px-5 ${showUnreadOnly ? "bg-primary text-primary-foreground hover:bg-primary" : "border-border bg-muted/40 text-foreground hover:bg-muted/40"}`}
                variant={showUnreadOnly ? "default" : "outline"}
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Unread
              </Button>

              <Button
                className={`h-12 rounded-2xl px-5 ${syncFilter === "pending" ? "bg-primary text-primary-foreground hover:bg-primary" : "border-border bg-muted/40 text-foreground hover:bg-muted/40"}`}
                variant={syncFilter === "pending" ? "default" : "outline"}
                onClick={() => setSyncFilter(syncFilter === "pending" ? "all" : "pending")}
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                Pending
              </Button>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as any)}
                className="h-12 rounded-2xl border border-border bg-muted/40 px-4 text-sm font-semibold text-foreground"
              >
                <option value="all">All Types</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="success">Success</option>
                <option value="info">Info</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as any)}
                className="h-12 rounded-2xl border border-orange-500/25 bg-orange-500/10 px-4 text-sm font-semibold text-orange-700"
              >
                <option value="all">All Categories</option>
                <option value="inventory">Inventory</option>
                <option value="payment">Payment</option>
                <option value="sales">Sales</option>
                <option value="system">System</option>
                <option value="approval">Approvals</option>
                <option value="ebm">EBM / VSDC</option>
                <option value="payroll">Payroll</option>
                <option value="sync">Synchronization</option>
              </select>

              <Button className="h-12 rounded-2xl px-5" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New
              </Button>

              <Button className="h-12 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary" onClick={exportNotificationsCsv}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>

              <Button className="h-12 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary" onClick={markAllRead}>
                <Eye className="mr-2 h-4 w-4" />
                Mark Read
              </Button>

              <Button variant="outline" className="h-12 rounded-2xl px-5" onClick={resetFilters}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>

              <Button variant="destructive" className="h-12 rounded-2xl px-5" onClick={clearRead}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          {(selectionMode || selectedIds.length > 0) && (
            <div className="rounded-3xl border border-border bg-card p-4 text-foreground shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <CheckSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">{selectedIds.length} notification(s) selected</p>
                    <p className="text-xs opacity-80">Bulk actions are offline-safe and queued for sync.</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary" onClick={selectVisibleNotifications}>Select Visible</Button>
                  <Button className="rounded-2xl" onClick={markSelectedRead} disabled={!selectedIds.length}>
                    <Eye className="mr-2 h-4 w-4" />
                    Mark Read
                  </Button>
                  <Button variant="destructive" className="rounded-2xl" onClick={deleteSelectedNotifications} disabled={!selectedIds.length}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected
                  </Button>
                  <Button variant="outline" className="rounded-2xl border-border bg-card text-foreground" onClick={clearSelection}>
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {filteredNotifications.length === 0 ? (
                <div className="rounded-3xl border border-border bg-muted/40 py-16 text-center text-foreground shadow-sm">
                  <Bell className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <h3 className="mb-1 font-semibold">No notifications found</h3>
                  <p className="text-sm">You're all caught up.</p>
                </div>
              ) : (
                filteredNotifications.map((notification) => {
                  const CategoryIcon = getCategoryIcon(notification.category);
                  const TypeIcon = getTypeIcon(notification.type);
                  const tone =
                    notification.type === "critical"
                      ? "border-rose-500/25 bg-rose-500/10"
                      : notification.type === "warning"
                        ? "border-orange-500/25 bg-orange-500/10"
                        : notification.type === "success"
                          ? "border-emerald-500/25 bg-emerald-500/10"
                          : "border-border bg-muted/40";
                  const iconTone =
                    notification.type === "critical"
                      ? "bg-rose-600"
                      : notification.type === "warning"
                        ? "bg-orange-600"
                        : notification.type === "success"
                          ? "bg-emerald-600"
                          : "bg-primary";

                  return (
                    <div key={notification.id} className={`rounded-3xl border p-5 shadow-sm transition hover:shadow-md ${tone}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 gap-4">
                          <button
                            type="button"
                            onClick={() => toggleSelection(notification.id)}
                            className="mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border bg-card transition hover:bg-muted/40"
                            title="Select notification"
                          >
                            {selectedIds.includes(notification.id) ? (
                              <CheckSquare className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>

                          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white ${iconTone}`}>
                            <TypeIcon className="h-6 w-6" />
                          </div>

                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <h3 className="font-black text-foreground">{notification.title}</h3>
                              {getTypeBadge(notification.type)}
                              {!notification.read && (
                                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-muted-foreground">
                                  New
                                </Badge>
                              )}
                              {isPendingSync(notification) && (
                                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-foreground">
                                  <UploadCloud className="mr-1 h-3 w-3" />
                                  Pending
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm leading-6 text-muted-foreground">{notification.message}</p>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-background/75 px-3 py-1">
                                <CategoryIcon className="h-3.5 w-3.5" />
                                {notification.category}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-background/75 px-3 py-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatNotificationDate(notification)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button size="icon" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary" onClick={() => markRead(notification.id)} title={notification.read ? "Mark unread" : "Mark read"}>
                            {notification.read ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="destructive" size="icon" className="rounded-xl" onClick={() => deleteNotification(notification.id)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-4">
              <SectionCard
                icon={Bell}
                tone="emerald"
                title="Notification Channels"
                description="Delivery methods available"
              >

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-background/75 p-3">
                    <div className="flex items-center gap-2"><Bell className="h-4 w-4" />In-App</div>
                    <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-background/75 p-3">
                    <div className="flex items-center gap-2"><Mail className="h-4 w-4" />Email</div>
                    <Badge variant="outline" className="rounded-full border-orange-500/30 bg-orange-500/10 text-orange-600">Optional</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-background/75 p-3">
                    <div className="flex items-center gap-2"><Smartphone className="h-4 w-4" />Mobile Push</div>
                    <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-muted-foreground">Planned</Badge>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={Settings}
                tone="amber"
                title="Alert Categories"
                description="Types of alerts tracked"
              >

                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl bg-background/75 p-3"><Package className="h-4 w-4 text-orange-600" /><span className="text-sm font-medium">Inventory Alerts</span></div>
                  <div className="flex items-center gap-3 rounded-2xl bg-background/75 p-3"><CreditCard className="h-4 w-4 text-rose-600" /><span className="text-sm font-medium">Payment Reminders</span></div>
                  <div className="flex items-center gap-3 rounded-2xl bg-background/75 p-3"><ShoppingCart className="h-4 w-4 text-emerald-600" /><span className="text-sm font-medium">Sales Updates</span></div>
                  <div className="flex items-center gap-3 rounded-2xl bg-background/75 p-3"><Settings className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">System Events</span></div>
                  <div className="flex items-center gap-3 rounded-2xl bg-background/75 p-3"><ShieldCheck className="h-4 w-4 text-emerald-600" /><span className="text-sm font-medium">Approval Alerts</span></div>
                  <div className="flex items-center gap-3 rounded-2xl bg-background/75 p-3"><Receipt className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">EBM / VSDC Alerts</span></div>
                  <div className="flex items-center gap-3 rounded-2xl bg-background/75 p-3"><UploadCloud className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">Sync Queue Alerts</span></div>
                </div>
              </SectionCard>
            </div>
          </div>
        </PageContainer>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl rounded-3xl border-border bg-muted/40">
            <DialogHeader>
              <DialogTitle>Create Notification</DialogTitle>
              <DialogDescription>
                Create an internal business notification. It is saved offline first and queued for sync.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div>
                <label className="text-xs font-medium text-foreground">Title</label>
                <input
                  value={newNotification.title}
                  onChange={(event) => setNewNotification({ ...newNotification, title: event.target.value })}
                  placeholder="Notification title"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Message</label>
                <textarea
                  value={newNotification.message}
                  onChange={(event) => setNewNotification({ ...newNotification, message: event.target.value })}
                  placeholder="Write notification details..."
                  className="mt-1.5 min-h-[120px] w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-foreground">Type</label>
                  <select
                    value={newNotification.type}
                    onChange={(event) => setNewNotification({ ...newNotification, type: event.target.value as NotificationItem["type"] })}
                    className="mt-1.5 h-11 w-full rounded-2xl border border-border bg-muted/40 px-4 text-sm text-foreground"
                  >
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-orange-700">Category</label>
                  <select
                    value={newNotification.category}
                    onChange={(event) => setNewNotification({ ...newNotification, category: event.target.value as NotificationItem["category"] })}
                    className="mt-1.5 h-11 w-full rounded-2xl border border-orange-500/25 bg-orange-500/10 px-4 text-sm text-orange-700"
                  >
                    <option value="system">System</option>
                    <option value="inventory">Inventory</option>
                    <option value="payment">Payment</option>
                    <option value="sales">Sales</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="rounded-2xl border-rose-500/25 bg-rose-500/10 text-rose-700 hover:bg-rose-100" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-2xl" onClick={createNotification}>
                <Plus className="mr-2 h-4 w-4" />
                Create Notification
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBackground>
    </PageShell>
  );
}

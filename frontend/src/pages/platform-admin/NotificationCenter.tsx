import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformSearchBar } from "@/pages/platform-admin/components/PlatformSearchBar";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import Tenant360Drawer from "@/pages/platform-admin/components/Tenant360Drawer";

type NotificationRow = {
  id: string;
  tenant_id: string | null;
  title: string;
  message: string;
  category: string;
  severity: string;
  status: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  read_at: string | null;
  tenants?: {
    name?: string | null;
  } | null;
};

export default function NotificationCenter() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const notificationsQ = useQuery({
    queryKey: ["platform-notifications"],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await (supabase as any)
        .from("platform_notifications")
        .select(
          `
          id,
          tenant_id,
          title,
          message,
          category,
          severity,
          status,
          action_url,
          metadata,
          created_at,
          read_at,
          tenants (name)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["platform-notifications"] });
    qc.invalidateQueries({ queryKey: ["platform-dashboard-live"] });
  };

  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await (supabase as any)
        .from("platform_notifications")
        .update({
          status: "read",
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notification marked as read.");
      refresh();
    },
    onError: (error: any) =>
      toast.error(error?.message || "Could not update notification."),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("platform_notifications")
        .update({
          status: "read",
          read_at: new Date().toISOString(),
        })
        .eq("status", "unread");

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All notifications marked as read.");
      refresh();
    },
    onError: (error: any) =>
      toast.error(error?.message || "Could not update notifications."),
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await (supabase as any)
        .from("platform_notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notification deleted.");
      refresh();
    },
    onError: (error: any) =>
      toast.error(error?.message || "Could not delete notification."),
  });

  const notifications = notificationsQ.data ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return notifications.filter((item) => {
      if (!q) return true;

      return (
        item.title.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.severity.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.tenants?.name?.toLowerCase().includes(q)
      );
    });
  }, [notifications, search]);

  const stats = useMemo(() => {
    return {
      total: notifications.length,
      unread: notifications.filter((item) => item.status === "unread").length,
      critical: notifications.filter((item) => item.severity === "critical")
        .length,
      warning: notifications.filter((item) => item.severity === "warning")
        .length,
    };
  }, [notifications]);

  const busy =
    markRead.isPending ||
    markAllRead.isPending ||
    deleteNotification.isPending;

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Platform Operations"
        title="Notification Center"
        description="Review platform alerts for trial expiry, overdue invoices, payment updates, workspace suspensions and system operations."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl font-black"
              disabled={busy}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark All Read
            </Button>

            <Button
              className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
              onClick={() => {
                notificationsQ.refetch();
                toast.info("Refreshing notifications...");
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-1">
        <PlatformKpiCard
          icon={<Bell className="h-6 w-6" />}
          label="Total Alerts"
          value={stats.total.toLocaleString()}
          tone="blue"
        />
        <PlatformKpiCard
          icon={<Clock className="h-6 w-6" />}
          label="Unread"
          value={stats.unread.toLocaleString()}
          tone="orange"
        />
        <PlatformKpiCard
          icon={<ShieldAlert className="h-6 w-6" />}
          label="Critical"
          value={stats.critical.toLocaleString()}
          tone="rose"
        />
        <PlatformKpiCard
          icon={<AlertTriangle className="h-6 w-6" />}
          label="Warnings"
          value={stats.warning.toLocaleString()}
          tone="violet"
        />
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <PlatformSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search notifications, workspace, category, severity or status..."
          />
        </div>

        {notificationsQ.isLoading ? (
          <div className="py-12 text-center text-sm font-bold text-slate-500">
            Loading notifications...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-slate-500">
            No notifications found.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((item) => {
              const unread = item.status === "unread";

              return (
                <div
                  key={item.id}
                  className={[
                    "rounded-2xl border p-5 transition",
                    unread
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <PlatformStatusBadge status={item.severity} />
                        <PlatformStatusBadge status={item.status} />
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          {item.category}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-black text-slate-950">
                        {item.title}
                      </h3>

                      <p className="mt-2 max-w-4xl text-sm font-medium leading-6 text-slate-600">
                        {item.message}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                        <span>
                          Workspace:{" "}
                          {item.tenant_id ? (
                            <button
                              type="button"
                              className="font-black text-blue-700 hover:text-blue-900"
                              onClick={() => setSelectedTenantId(item.tenant_id)}
                            >
                              {item.tenants?.name || item.tenant_id}
                            </button>
                          ) : (
                            "Platform"
                          )}
                        </span>

                        <span>
                          Created:{" "}
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString()
                            : "No date"}
                        </span>

                        {item.read_at && (
                          <span>
                            Read: {new Date(item.read_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {item.tenant_id && (
                        <Button
                          variant="outline"
                          className="rounded-xl border-blue-200 bg-white font-black text-blue-700 hover:bg-blue-100"
                          onClick={() => setSelectedTenantId(item.tenant_id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Workspace
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        className="rounded-xl border-emerald-200 bg-white font-black text-emerald-700 hover:bg-emerald-100"
                        disabled={busy || !unread}
                        onClick={() => markRead.mutate(item.id)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {unread ? "Mark Read" : "Read"}
                      </Button>

                      <Button
                        variant="outline"
                        className="rounded-xl border-rose-200 bg-white font-black text-rose-700 hover:bg-rose-100"
                        disabled={busy}
                        onClick={() => deleteNotification.mutate(item.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Tenant360Drawer
        open={!!selectedTenantId}
        tenantId={selectedTenantId}
        onClose={() => setSelectedTenantId(null)}
      />
    </div>
  );
}
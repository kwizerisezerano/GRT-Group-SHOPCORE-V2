import { useMemo, useState } from "react";
import {
  Heart,
  Plus,
  Search,
  Gift,
  Crown,
  Star,
  Users,
  Trophy,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  ShieldCheck,
  Target,
  Wallet,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  WifiOff,
  UploadCloud,
  Database,
  RotateCcw,
  Percent,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomers } from "@/hooks/useSupabaseData";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/utils/currency";
import { toast } from "sonner";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

const SHOPCORE_BLUE = "#2563eb";
const PAGE_SIZE = 8;

const BTN_PRIMARY = "bg-blue-600 text-white hover:bg-blue-700 border-blue-600";
const BTN_WARNING = "bg-orange-600 text-white hover:bg-orange-700 border-orange-600";
const BTN_DANGER = "bg-rose-600 text-white hover:bg-rose-700 border-rose-600";

type CampaignStatus = "active" | "inactive" | "paused" | "expired";
type CampaignType = "points_bonus" | "spend_reward" | "vip_reward" | "birthday_reward" | "cashback" | "referral";
type SortKey = "created_at" | "name" | "points_reward" | "minimum_spend" | "status";

interface LoyaltyCampaign {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  campaign_type: string | null;
  status: string | null;
  points_reward: number | null;
  minimum_spend: number | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  created_at: string;
  operation?: string | null;
  sync_status?: string | null;
  created_offline_at?: string | null;
  updated_offline_at?: string | null;
  offline_id?: string | null;
}

function safeNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

type SupabaseResult<T = any> = {
  data?: T | null;
  error?: any;
};

function withTimeout<T>(promise: PromiseLike<T>, message = "Request timed out", timeoutMs = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);

    Promise.resolve(promise)
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer));
  });
}

function withSupabaseTimeout<T = any>(query: PromiseLike<SupabaseResult<T>>, message = "Database request timed out") {
  return withTimeout(Promise.resolve(query), message);
}

function shouldUseOfflineQueue(error: any) {
  const message = String(error?.message || error?.details || error?.hint || error || "").toLowerCase();
  return (
    !isOnline() ||
    isNetworkError(error) ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("failed to fetch") ||
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("relation") ||
    message.includes("404") ||
    error?.code === "PGRST205"
  );
}

function cleanLabel(value?: string | null) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTierFromCustomer(customer: any) {
  const tier = String(customer?.loyalty_tier || "").toLowerCase();
  const points = safeNumber(customer?.loyalty_points);
  const spent = safeNumber(customer?.total_spent);

  if (["diamond", "platinum", "gold", "silver", "bronze"].includes(tier)) return tier;
  if (spent >= 500000 || points >= 5000) return "platinum";
  if (spent >= 200000 || points >= 2000) return "gold";
  if (spent >= 75000 || points >= 750) return "silver";
  return "bronze";
}

function isPendingSync(row: any) {
  return (
    String(row?.id || "").startsWith("offline-") ||
    !!row?.offline_id ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at ||
    String(row?.sync_status || "").toLowerCase().includes("pending")
  );
}

function isPendingDelete(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted"
  );
}

function dedupeCampaigns(rows: LoyaltyCampaign[]) {
  const map = new Map<string, LoyaltyCampaign>();

  for (const row of rows || []) {
    if (isPendingDelete(row)) continue;

    const key = String(row.id || row.offline_id || row.name || Math.random());
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }

    const existingTime = new Date(existing.updated_offline_at || existing.created_at || 0).getTime();
    const incomingTime = new Date(row.updated_offline_at || row.created_at || 0).getTime();
    map.set(key, incomingTime >= existingTime ? { ...existing, ...row } : { ...row, ...existing });
  }

  return Array.from(map.values());
}

function campaignIsActive(campaign: LoyaltyCampaign) {
  const status = String(campaign.status || "active").toLowerCase();
  if (status !== "active") return false;

  const now = new Date();
  const start = campaign.start_date ? new Date(campaign.start_date) : null;
  const end = campaign.end_date ? new Date(campaign.end_date) : null;

  if (start && !Number.isNaN(start.getTime()) && start > now) return false;
  if (end && !Number.isNaN(end.getTime()) && end < now) return false;
  return true;
}

function campaignStatus(campaign: LoyaltyCampaign) {
  if (campaignIsActive(campaign)) return "active";
  const status = String(campaign.status || "inactive").toLowerCase();
  if (status === "active" && campaign.end_date && new Date(campaign.end_date) < new Date()) return "expired";
  return status;
}

function statusClass(value: string | null) {
  const status = String(value || "active").toLowerCase();
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600";
  if (status === "paused") return "border-amber-500/30 bg-amber-500/10 text-amber-600";
  if (status === "expired") return "border-orange-500/30 bg-orange-500/10 text-orange-600";
  return "border-rose-500/30 bg-rose-500/10 text-blue-600";
}

function tierClass(tier: string) {
  if (tier === "platinum" || tier === "diamond") return "border-violet-500/30 bg-violet-500/10 text-violet-600";
  if (tier === "gold") return "border-amber-500/30 bg-amber-500/10 text-amber-600";
  if (tier === "silver") return "border-orange-500/30 bg-orange-500/10 text-orange-600";
  return "border-orange-500/30 bg-orange-500/10 text-orange-600";
}

function campaignTypeIcon(type?: string | null) {
  const value = String(type || "");
  if (value === "vip_reward") return Crown;
  if (value === "birthday_reward") return Gift;
  if (value === "cashback") return Wallet;
  if (value === "referral") return Users;
  if (value === "spend_reward") return Target;
  return Star;
}

export default function Loyalty() {
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();
  const { data: customers = [] } = useCustomers();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LoyaltyCampaign | null>(null);
  const [deleteCampaignRow, setDeleteCampaignRow] = useState<LoyaltyCampaign | null>(null);

  const [name, setName] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType>("points_bonus");
  const [status, setStatus] = useState<CampaignStatus>("active");
  const [pointsReward, setPointsReward] = useState("");
  const [minimumSpend, setMinimumSpend] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  const offlineModeActive = !isOnline() || isOfflineMode();
  const canUseOnlineSupabase = isOnline() && !!session?.access_token && !isOfflineMode();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["loyalty-campaigns", tenantId, canUseOnlineSupabase ? "online" : "offline"],
    enabled: !!tenantId,
    retry: 0,
    refetchOnReconnect: canUseOnlineSupabase,
    refetchOnWindowFocus: canUseOnlineSupabase,
    queryFn: async () => {
      const cached = (await getCachedTable("loyalty_campaigns")) as LoyaltyCampaign[];

      if (!canUseOnlineSupabase) {
        return dedupeCampaigns(Array.isArray(cached) ? cached : []);
      }

      try {
        const { data, error } = await withSupabaseTimeout<LoyaltyCampaign[]>(
          (supabase as any)
            .from("loyalty_campaigns")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false }),
          "Loyalty campaign refresh timed out"
        );

        if (error) throw error;
        const merged = dedupeCampaigns([...(data || []), ...(Array.isArray(cached) ? cached : [])]);
        await saveCachedTable("loyalty_campaigns", merged);
        return merged as LoyaltyCampaign[];
      } catch (error) {
        if (shouldUseOfflineQueue(error)) return dedupeCampaigns(Array.isArray(cached) ? cached : []);
        throw error;
      }
    },
  });

  const stats = useMemo(() => {
    const members = customers.length;
    const pointsIssued = customers.reduce((sum: number, customer: any) => sum + safeNumber(customer.loyalty_points), 0);
    const totalSpent = customers.reduce((sum: number, customer: any) => sum + safeNumber(customer.total_spent), 0);
    const outstanding = customers.reduce((sum: number, customer: any) => sum + safeNumber(customer.outstanding_balance), 0);
    const vipMembers = customers.filter((customer: any) => {
      const group = String(customer.customer_group || "").toLowerCase();
      const tier = getTierFromCustomer(customer);
      return group === "vip" || ["gold", "platinum", "diamond"].includes(tier);
    }).length;
    const activeCampaigns = campaigns.filter(campaignIsActive).length;
    const avgPoints = members > 0 ? Math.round(pointsIssued / members) : 0;
    const repeatCustomers = customers.filter((customer: any) => safeNumber(customer.total_purchases) > 1).length;
    const retentionRate = members > 0 ? Math.round((repeatCustomers / members) * 100) : 0;
    const engagementScore = Math.min(100, Math.round((retentionRate * 0.45) + ((vipMembers / Math.max(members, 1)) * 100 * 0.25) + (activeCampaigns > 0 ? 20 : 0) + (avgPoints > 0 ? 10 : 0)));

    return {
      members,
      pointsIssued,
      vipMembers,
      activeCampaigns,
      avgPoints,
      totalSpent,
      outstanding,
      repeatCustomers,
      retentionRate,
      engagementScore,
      pendingSync: campaigns.filter(isPendingSync).length,
      inactiveCampaigns: campaigns.filter((c) => !campaignIsActive(c)).length,
    };
  }, [customers, campaigns]);

  const tierDistribution = useMemo(() => {
    const tiers = ["bronze", "silver", "gold", "platinum"];
    return tiers.map((tier) => {
      const count = customers.filter((customer: any) => {
        const normalizedTier = getTierFromCustomer(customer);
        if (tier === "platinum") return normalizedTier === "platinum" || normalizedTier === "diamond";
        return normalizedTier === tier;
      }).length;
      const percent = customers.length > 0 ? Math.round((count / customers.length) * 100) : 0;
      return { tier, count, percent };
    });
  }, [customers]);

  const campaignTypeDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const campaign of campaigns) {
      const type = campaign.campaign_type || "points_bonus";
      map.set(type, (map.get(type) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count, percent: campaigns.length ? Math.round((count / campaigns.length) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [campaigns]);

  const topMembers = useMemo(
    () =>
      [...customers]
        .sort((a: any, b: any) => safeNumber(b.loyalty_points) - safeNumber(a.loyalty_points))
        .slice(0, 6),
    [customers]
  );

  const filteredCampaigns = useMemo(() => {
    const query = search.toLowerCase().trim();

    const list = campaigns.filter((campaign) => {
      const normalizedStatus = campaignStatus(campaign);
      const pending = isPendingSync(campaign);
      const matchSearch =
        !query ||
        campaign.name.toLowerCase().includes(query) ||
        (campaign.campaign_type || "").toLowerCase().includes(query) ||
        (campaign.description || "").toLowerCase().includes(query);
      const matchStatus = statusFilter === "all" || normalizedStatus === statusFilter;
      const matchType = typeFilter === "all" || campaign.campaign_type === typeFilter;
      const matchSync = syncFilter === "all" || (syncFilter === "pending" && pending) || (syncFilter === "synced" && !pending);

      return matchSearch && matchStatus && matchType && matchSync;
    });

    list.sort((a, b) => {
      if (sortKey === "created_at") {
        const av = new Date(a.created_at || a.created_offline_at || 0).getTime();
        const bv = new Date(b.created_at || b.created_offline_at || 0).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "status") {
        const av = campaignStatus(a);
        const bv = campaignStatus(b);
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }

      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];

      if (typeof av === "string" && typeof bv === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? safeNumber(av) - safeNumber(bv) : safeNumber(bv) - safeNumber(av);
    });

    return list;
  }, [campaigns, search, statusFilter, typeFilter, syncFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCampaigns = filteredCampaigns.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const exportRows = filteredCampaigns.map((campaign) => ({
    name: campaign.name,
    type: cleanLabel(campaign.campaign_type),
    status: cleanLabel(campaignStatus(campaign)),
    reward_points: safeNumber(campaign.points_reward).toLocaleString(),
    minimum_spend: formatCurrency(safeNumber(campaign.minimum_spend)),
    start_date: formatDate(campaign.start_date),
    end_date: formatDate(campaign.end_date),
    sync_status: isPendingSync(campaign) ? "Pending" : "Synced",
    description: campaign.description || "",
  }));

  const exportCols = [
    { key: "name" as const, label: "Campaign" },
    { key: "type" as const, label: "Type" },
    { key: "status" as const, label: "Status" },
    { key: "reward_points" as const, label: "Reward Points" },
    { key: "minimum_spend" as const, label: "Minimum Spend" },
    { key: "start_date" as const, label: "Start Date" },
    { key: "end_date" as const, label: "End Date" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "description" as const, label: "Description" },
  ];

  const refreshLoyaltyQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["loyalty-campaigns"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const queueCampaignOffline = async (payload: any, mode: "create" | "update" | "delete", row?: LoyaltyCampaign) => {
    if (!tenantId) throw new Error("No active workspace");

    const now = new Date().toISOString();
    const cached = (await getCachedTable("loyalty_campaigns")) as LoyaltyCampaign[];
    const cachedRows = Array.isArray(cached) ? cached : [];

    const offlineRow: LoyaltyCampaign = {
      ...(row || {}),
      ...payload,
      id: row?.id || makeLocalId("offline-loyalty-campaign"),
      tenant_id: row?.tenant_id || tenantId,
      user_id: row?.user_id || user?.id || null,
      operation: mode,
      sync_status: mode === "delete" ? "pending_delete" : mode === "update" ? "pending_update" : "pending",
      created_at: row?.created_at || now,
      created_offline_at: row?.created_offline_at || now,
      updated_offline_at: now,
      status: mode === "delete" ? "deleted" : payload.status,
    };

    await savePending("loyalty_campaigns", offlineRow);

    const nextRows =
      mode === "delete"
        ? cachedRows.map((item) => (String(item.id) === String(row?.id) ? offlineRow : item))
        : dedupeCampaigns([offlineRow, ...cachedRows]);

    await saveCachedTable("loyalty_campaigns", nextRows);
    await refreshLoyaltyQueries();
  };

  const saveCampaign = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No active workspace");
      if (!name.trim()) throw new Error("Campaign name is required");

      const payload = {
        tenant_id: tenantId,
        user_id: user?.id || null,
        name: name.trim(),
        campaign_type: campaignType,
        status,
        points_reward: safeNumber(pointsReward),
        minimum_spend: safeNumber(minimumSpend),
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || null,
      };

      if (!canUseOnlineSupabase) {
        await queueCampaignOffline(payload, editing ? "update" : "create", editing || undefined);
        return "offline";
      }

      try {
        if (editing) {
          if (String(editing.id || "").startsWith("offline-") || editing.offline_id) {
            await queueCampaignOffline(payload, "update", editing);
            return "offline";
          }

          const { error } = await withSupabaseTimeout(
            (supabase as any)
              .from("loyalty_campaigns")
              .update(payload)
              .eq("id", editing.id)
              .eq("tenant_id", tenantId),
            "Loyalty campaign update timed out"
          );
          if (error) throw error;
        } else {
          const { error } = await withSupabaseTimeout(
            (supabase as any).from("loyalty_campaigns").insert(payload),
            "Loyalty campaign save timed out"
          );
          if (error) throw error;
        }

        const cached = (await getCachedTable("loyalty_campaigns")) as LoyaltyCampaign[];
        await saveCachedTable("loyalty_campaigns", dedupeCampaigns([...(Array.isArray(cached) ? cached : [])]));
        return "online";
      } catch (error) {
        if (shouldUseOfflineQueue(error)) {
          await queueCampaignOffline(payload, editing ? "update" : "create", editing || undefined);
          return "offline";
        }
        throw error;
      }
    },
    onSuccess: (mode) => {
      refreshLoyaltyQueries();
      toast.success(
        mode === "offline"
          ? editing
            ? "Campaign updated offline. It will sync when internet returns."
            : "Campaign saved offline. It will sync when internet returns."
          : editing
            ? "Campaign updated successfully."
            : "Campaign created successfully."
      );
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (campaign: LoyaltyCampaign) => {
      if (!tenantId) throw new Error("No active workspace");

      if (!canUseOnlineSupabase || String(campaign.id || "").startsWith("offline-")) {
        await queueCampaignOffline({}, "delete", campaign);
        return "offline";
      }

      try {
        const { error } = await withSupabaseTimeout(
          (supabase as any)
            .from("loyalty_campaigns")
            .delete()
            .eq("id", campaign.id)
            .eq("tenant_id", tenantId),
          "Loyalty campaign delete timed out"
        );
        if (error) throw error;

        const cached = (await getCachedTable("loyalty_campaigns")) as LoyaltyCampaign[];
        await saveCachedTable(
          "loyalty_campaigns",
          (Array.isArray(cached) ? cached : []).filter((item) => String(item.id) !== String(campaign.id))
        );
        return "online";
      } catch (error) {
        if (shouldUseOfflineQueue(error)) {
          await queueCampaignOffline({}, "delete", campaign);
          return "offline";
        }
        throw error;
      }
    },
    onSuccess: (mode) => {
      refreshLoyaltyQueries();
      toast.success(mode === "offline" ? "Campaign deletion saved offline." : "Campaign deleted successfully.");
      setDeleteCampaignRow(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setSyncFilter("all");
    setSortKey("created_at");
    setSortAsc(false);
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCampaignType("points_bonus");
    setStatus("active");
    setPointsReward("");
    setMinimumSpend("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setDescription("");
    setDialogOpen(true);
  };

  const openEdit = (campaign: LoyaltyCampaign) => {
    setEditing(campaign);
    setName(campaign.name || "");
    setCampaignType((campaign.campaign_type || "points_bonus") as CampaignType);
    setStatus((campaign.status || "active") as CampaignStatus);
    setPointsReward(String(campaign.points_reward || ""));
    setMinimumSpend(String(campaign.minimum_spend || ""));
    setStartDate(campaign.start_date || "");
    setEndDate(campaign.end_date || "");
    setDescription(campaign.description || "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const kpis = [
    { label: "Members", value: stats.members.toLocaleString(), icon: Users, color: "bg-blue-600 text-white border-blue-600", helper: "enrolled customers" },
    { label: "Points Issued", value: stats.pointsIssued.toLocaleString(), icon: Star, color: "bg-orange-600 text-white border-orange-600", helper: "reward balance" },
    { label: "VIP Members", value: stats.vipMembers.toLocaleString(), icon: Crown, color: "bg-rose-600 text-white border-rose-600", helper: "premium customers" },
    { label: "Active Campaigns", value: stats.activeCampaigns.toLocaleString(), icon: Gift, color: "bg-emerald-600 text-white border-emerald-600", helper: "live rewards" },
  ];

  return (
    <PageShell
      title="Loyalty Program"
      description="Manage reward points, VIP tiers, campaigns, customer retention, and loyalty performance."
    >
      <PageBackground image={warehouseBg} opacity={0.04}>
        <div className="space-y-6">
          {(offlineModeActive || stats.pendingSync > 0) && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive ? "Loyalty is running from offline cache" : "Loyalty changes waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending loyalty records: {stats.pendingSync}. Campaign changes can be queued and synced when internet returns.
                    </p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                  <UploadCloud className="mr-1 h-3 w-3" />
                  {offlineModeActive ? "Offline Mode" : "Sync Pending"}
                </Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-5 overflow-hidden relative">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-blue-100" />
              <div className="absolute -bottom-12 right-20 h-28 w-28 rounded-full bg-cyan-100" />
              <div className="relative flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Heart className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <Badge className="rounded-full bg-blue-600 text-white border-blue-600 mb-3">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    Customer Retention Operations
                  </Badge>
                  <h2 className="text-2xl font-bold tracking-tight">Loyalty & Rewards Engine</h2>
                  <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                    Reward loyal customers, manage VIP tiers, launch targeted campaigns, track points,
                    monitor retention health, and increase repeat sales from one enterprise workspace.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <p className="text-xs font-medium text-emerald-700">Engagement Score</p>
                      <p className="text-sm font-semibold font-data text-emerald-700">{stats.engagementScore}%</p>
                    </div>
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3">
                      <p className="text-xs font-medium text-violet-700">Retention Rate</p>
                      <p className="text-sm font-semibold font-data text-violet-700">{stats.retentionRate}%</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                      <p className="text-xs font-medium text-cyan-700">Avg. Points</p>
                      <p className="text-sm font-semibold font-data text-cyan-700">{stats.avgPoints.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-2 gap-3">
              {kpis.map((item) => {
                const Icon = item.icon;
                const valueClass = String(item.value).length > 11 ? "text-lg break-words max-w-full" : "text-2xl";
                return (
                  <div key={item.label} className={`rounded-3xl border shadow-sm p-4 ${item.color}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium opacity-80">{item.label}</p>
                        <p className={`${valueClass} font-bold font-data mt-1`}>{item.value}</p>
                        <p className="text-[11px] opacity-75 truncate">{item.helper}</p>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Total Customer Value", value: formatCurrency(stats.totalSpent), icon: Wallet, color: "bg-blue-500/10 text-blue-600" },
              { label: "Repeat Customers", value: stats.repeatCustomers.toLocaleString(), icon: RotateCcw, color: "bg-emerald-500/10 text-emerald-600" },
              { label: "Open Exposure", value: formatCurrency(stats.outstanding), icon: ShieldCheck, color: "bg-rose-500/10 text-rose-600" },
              { label: "Inactive Campaigns", value: stats.inactiveCampaigns.toLocaleString(), icon: XCircle, color: "bg-orange-500/10 text-orange-600" },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-600">{item.label}</p>
                    <p className="font-bold font-data truncate">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-4 rounded-3xl border border-cyan-200 bg-cyan-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Program Health</h3>
                  <p className="text-xs text-slate-600">Retention and engagement strength</p>
                </div>
              </div>

              <div className="relative mx-auto my-4 h-44 w-44 rounded-full border-[18px] border-cyan-100 flex items-center justify-center">
                <div
                  className="absolute inset-[-18px] rounded-full"
                  style={{
                    background: `conic-gradient(${SHOPCORE_BLUE} ${stats.engagementScore * 3.6}deg, rgba(8,145,178,0.15) 0deg)`,
                    WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 18px), #000 calc(100% - 17px))",
                    mask: "radial-gradient(farthest-side, transparent calc(100% - 18px), #000 calc(100% - 17px))",
                  }}
                />
                <div className="text-center">
                  <p className="text-4xl font-black font-data">{stats.engagementScore}%</p>
                  <p className="text-xs text-slate-600">Health Score</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-cyan-50 p-3 text-center">
                  <Percent className="w-5 h-5 mx-auto mb-1 text-slate-600" />
                  <p className="text-xs text-slate-600">Retention</p>
                  <p className="font-data font-bold">{stats.retentionRate}%</p>
                </div>
                <div className="rounded-2xl bg-cyan-50 p-3 text-center">
                  <Zap className="w-5 h-5 mx-auto mb-1 text-slate-600" />
                  <p className="text-xs text-slate-600">Campaigns</p>
                  <p className="font-data font-bold">{stats.activeCampaigns}</p>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-violet-200 bg-violet-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center">
                  <PieChart className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Tier Distribution</h3>
                  <p className="text-xs text-slate-600">Customer mix by loyalty level</p>
                </div>
              </div>

              <div className="space-y-4">
                {tierDistribution.map((item) => (
                  <div key={item.tier}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">{item.tier}</span>
                      <span className="font-data text-slate-600">{item.count} · {item.percent}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-blue-50">
                      <div className="h-full rounded-full" style={{ width: `${item.percent}%`, background: SHOPCORE_BLUE }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-orange-200 bg-orange-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Campaign Mix</h3>
                  <p className="text-xs text-slate-600">Active strategy by reward type</p>
                </div>
              </div>

              <div className="space-y-3">
                {campaignTypeDistribution.length === 0 ? (
                  <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 px-5 py-10 text-center text-rose-700">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 text-white">
                      <Gift className="h-7 w-7" />
                    </div>
                    <p className="font-bold">No reward campaigns configured</p>
                    <p className="mt-1 text-sm opacity-80">Create a campaign to activate points, cashback, VIP rewards, or referral incentives.</p>
                  </div>
                ) : (
                  campaignTypeDistribution.map((item) => (
                    <div key={item.type} className="rounded-2xl border bg-blue-50 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>{cleanLabel(item.type)}</span>
                        <span className="font-data text-slate-600">{item.count}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full" style={{ width: `${item.percent}%`, background: SHOPCORE_BLUE }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.45fr]">
            <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black">Top Loyalty Members</h3>
                  <p className="text-xs text-slate-600">Highest reward balances</p>
                </div>
              </div>

              <div className="space-y-3">
                {topMembers.length === 0 ? (
                  <div className="rounded-3xl border border-violet-500/20 bg-violet-500/10 px-5 py-10 text-center text-violet-700">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white">
                      <Heart className="h-7 w-7" />
                    </div>
                    <p className="font-bold">No loyalty members yet</p>
                    <p className="mt-1 text-sm opacity-80">Customer points and VIP tiers will appear here as sales activity grows.</p>
                  </div>
                ) : (
                  topMembers.map((customer: any, index) => {
                    const tier = getTierFromCustomer(customer);
                    return (
                      <div key={customer.id || index} className="flex items-center gap-3 rounded-2xl border bg-blue-50 p-3 transition hover:bg-cyan-50">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl font-bold text-white" style={{ background: SHOPCORE_BLUE }}>
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{customer.name || "Unnamed Customer"}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className={`rounded-full capitalize ${tierClass(tier)}`}>{tier}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-amber-600">{safeNumber(customer.loyalty_points).toLocaleString()}</p>
                          <p className="text-xs text-slate-600">pts</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-h-[48px] flex-1 items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4">
                  <Search className="h-5 w-5 text-blue-600" />
                  <input
                    placeholder="Search campaign name, type, or description..."
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-blue-600/75"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                    <SelectTrigger className="h-12 w-[140px] rounded-2xl text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
                    <SelectTrigger className="h-12 w-[150px] rounded-2xl text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="points_bonus">Points Bonus</SelectItem>
                      <SelectItem value="spend_reward">Spend Reward</SelectItem>
                      <SelectItem value="vip_reward">VIP Reward</SelectItem>
                      <SelectItem value="birthday_reward">Birthday</SelectItem>
                      <SelectItem value="cashback">Cashback</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={syncFilter} onValueChange={(value) => { setSyncFilter(value); setPage(1); }}>
                    <SelectTrigger className="h-12 w-[130px] rounded-2xl text-xs"><SelectValue placeholder="Sync" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sync</SelectItem>
                      <SelectItem value="synced">Synced</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                    <SelectTrigger className="h-12 w-[145px] rounded-2xl text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Newest</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="points_reward">Reward</SelectItem>
                      <SelectItem value="minimum_spend">Min Spend</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button className="h-12 rounded-2xl bg-orange-600 text-white hover:bg-orange-700" onClick={() => setSortAsc(!sortAsc)}>
                    {sortAsc ? "Asc" : "Desc"}
                  </Button>

                  <Button className={`h-12 rounded-2xl ${BTN_WARNING}`} onClick={resetFilters}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>

                  <ExportMenu
                    onCSV={() => exportToCSV(exportRows, "loyalty_campaigns", exportCols)}
                    onPDF={() =>
                      exportToPDF(exportRows, "loyalty_campaigns", "Loyalty Campaigns Report", exportCols, {
                        subtitle: `${filteredCampaigns.length} loyalty campaigns`,
                        summary: [
                          { label: "Members", value: String(stats.members) },
                          { label: "Points Issued", value: stats.pointsIssued.toLocaleString() },
                          { label: "VIP Members", value: String(stats.vipMembers) },
                          { label: "Active Campaigns", value: String(stats.activeCampaigns) },
                          { label: "Engagement Score", value: `${stats.engagementScore}%` },
                        ],
                      })
                    }
                  />

                  <Button onClick={openCreate} className={`h-12 rounded-2xl px-5 ${BTN_PRIMARY}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Campaign
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="rounded-3xl border bg-blue-50 py-12 text-center text-slate-600">Loading campaigns...</div>
                ) : pagedCampaigns.length === 0 ? (
                  <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 px-6 py-12 text-center text-amber-800">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500 text-white">
                      <Gift className="h-8 w-8" />
                    </div>
                    <p className="text-lg font-black">No campaigns match this view</p>
                    <p className="mx-auto mt-2 max-w-md text-sm opacity-80">Adjust the filters or create a loyalty campaign for points bonuses, VIP rewards, cashback, birthdays, or referrals.</p>
                    <Button onClick={openCreate} className={`mt-5 rounded-2xl ${BTN_PRIMARY}`}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Campaign
                    </Button>
                  </div>
                ) : (
                  pagedCampaigns.map((campaign) => {
                    const Icon = campaignTypeIcon(campaign.campaign_type);
                    const normalizedStatus = campaignStatus(campaign);
                    return (
                      <div key={campaign.id} className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
                          <div className="lg:col-span-5 flex items-center gap-3">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
                              <Icon className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-semibold">{campaign.name}</p>
                                {isPendingSync(campaign) && (
                                  <Badge variant="outline" className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30">
                                    <UploadCloud className="mr-1 h-3 w-3" />
                                    Pending
                                  </Badge>
                                )}
                              </div>
                              <p className="line-clamp-2 text-xs text-slate-600">{campaign.description || "No description"}</p>
                              <p className="mt-1 text-[11px] text-slate-600">
                                {formatDate(campaign.start_date)} → {formatDate(campaign.end_date)}
                              </p>
                            </div>
                          </div>

                          <div className="lg:col-span-2">
                            <p className="text-xs text-slate-600">Campaign Type</p>
                            <p className="font-semibold">{cleanLabel(campaign.campaign_type)}</p>
                          </div>

                          <div className="lg:col-span-2">
                            <p className="text-xs text-slate-600">Reward</p>
                            <p className="font-semibold text-amber-600">{safeNumber(campaign.points_reward).toLocaleString()} pts</p>
                          </div>

                          <div className="lg:col-span-1">
                            <p className="text-xs text-slate-600">Min Spend</p>
                            <p className="font-semibold text-sm">{formatCurrency(safeNumber(campaign.minimum_spend))}</p>
                          </div>

                          <div className="lg:col-span-1">
                            <Badge variant="outline" className={`rounded-full capitalize ${statusClass(normalizedStatus)}`}>
                              {normalizedStatus === "active" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                              {normalizedStatus}
                            </Badge>
                          </div>

                          <div className="lg:col-span-1 flex justify-end gap-1">
                            <Button size="icon" className={BTN_WARNING} onClick={() => openEdit(campaign)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" className={BTN_DANGER} onClick={() => setDeleteCampaignRow(campaign)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between rounded-2xl border bg-blue-50 px-4 py-3">
                  <p className="text-xs text-slate-600">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredCampaigns.length)} of {filteredCampaigns.length}
                  </p>
                  <div className="flex gap-2">
                    <Button className="bg-indigo-600 text-white hover:bg-indigo-700" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
                    <Button className="bg-indigo-600 text-white hover:bg-indigo-700" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Campaign" : "New Loyalty Campaign"}</DialogTitle>
              <DialogDescription>
                Create campaigns that reward customers, strengthen retention, and increase repeat sales. Offline changes are queued for synchronization.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600">Campaign Name *</label>
                <Input value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl border-rose-200 bg-rose-50/40 placeholder:text-rose-500/80" placeholder="Weekend points boost" />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Campaign Type</label>
                <Select value={campaignType} onValueChange={(value) => setCampaignType(value as CampaignType)}>
                  <SelectTrigger className="rounded-xl border-blue-500/20 bg-blue-500/5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points_bonus">Points Bonus</SelectItem>
                    <SelectItem value="spend_reward">Spend Reward</SelectItem>
                    <SelectItem value="vip_reward">VIP Reward</SelectItem>
                    <SelectItem value="birthday_reward">Birthday Reward</SelectItem>
                    <SelectItem value="cashback">Cashback</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Status</label>
                <Select value={status} onValueChange={(value) => setStatus(value as CampaignStatus)}>
                  <SelectTrigger className="rounded-xl border-blue-500/20 bg-blue-500/5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Points Reward</label>
                <Input type="number" value={pointsReward} onChange={(event) => setPointsReward(event.target.value)} className="rounded-xl border-amber-200 bg-amber-50/40 placeholder:text-amber-600/80" placeholder="100" />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Minimum Spend</label>
                <Input type="number" value={minimumSpend} onChange={(event) => setMinimumSpend(event.target.value)} className="rounded-xl border-emerald-200 bg-emerald-50/40 placeholder:text-emerald-600/80" placeholder="5000" />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Start Date</label>
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-xl border-cyan-200 bg-cyan-50/40" />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">End Date</label>
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-xl border-orange-200 bg-orange-50/40" />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600">Description</label>
                <Input value={description} onChange={(event) => setDescription(event.target.value)} className="rounded-xl border-violet-200 bg-violet-50/40 placeholder:text-violet-600/80" placeholder="Describe how this reward campaign works..." />
              </div>

              {offlineModeActive && (
                <div className="col-span-2 rounded-2xl border bg-amber-500/10 p-3 text-sm text-amber-700">
                  Campaign will be saved locally first and synced when internet returns.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button className={BTN_WARNING} onClick={closeDialog}>Cancel</Button>
              <Button onClick={() => saveCampaign.mutate()} disabled={saveCampaign.isPending} className={BTN_PRIMARY}>
                {saveCampaign.isPending ? "Saving..." : editing ? "Update Campaign" : "Save Campaign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteCampaignRow} onOpenChange={() => setDeleteCampaignRow(null)}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Delete Campaign</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteCampaignRow?.name}"? Offline deletions are queued for sync.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={() => setDeleteCampaignRow(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteCampaignRow && deleteCampaign.mutate(deleteCampaignRow)} disabled={deleteCampaign.isPending}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBackground>
    </PageShell>
  );
}

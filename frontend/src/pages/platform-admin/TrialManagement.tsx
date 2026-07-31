import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Hourglass,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  TrendingUp,
  UserRoundCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Tenant360Drawer from "@/pages/platform-admin/components/Tenant360Drawer";

type TrialStatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "active"
  | "expired"
  | "rejected"
  | "converted"
  | "cancelled";

type TrialAction =
  | "approve"
  | "extend"
  | "expire"
  | "reject"
  | "convert"
  | "cancel";

type TenantRow = {
  id: string;
  name: string;
  owner_id?: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  payment_status: string | null;
  workspace_status: string | null;
  trial_status: string | null;
  trial_ends_at: string | null;
  onboarding_completed?: boolean | null;
  created_at: string | null;
  tenant_subscriptions?: Array<{
    id: string;
    plan_code: string | null;
    status: string | null;
    billing_cycle: string | null;
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    created_at: string | null;
  }>;
};

type EventRow = {
  id: string;
  tenant_id: string;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string | null;
};

function normalizeStatus(
  value?: string | null,
) {
  return value?.trim().toLowerCase() || "";
}

function formatLabel(
  value?: string | null,
) {
  return (
    value
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase(),
      ) || "Not specified"
  );
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleDateString();
}

function formatDateTime(
  value?: string | null,
) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return date.toLocaleString();
}

function daysRemaining(
  value?: string | null,
) {
  if (!value) {
    return null;
  }

  const end = new Date(value).getTime();

  if (!Number.isFinite(end)) {
    return null;
  }

  return Math.ceil(
    (end - Date.now()) / 86_400_000,
  );
}

function resolveTrialStatus(
  tenant: TenantRow,
) {
  const trialStatus =
    normalizeStatus(tenant.trial_status);

  const subscriptionStatus =
    normalizeStatus(
      tenant.subscription_status,
    );

  const paymentStatus =
    normalizeStatus(tenant.payment_status);

  if (
    paymentStatus === "paid" &&
    subscriptionStatus === "active"
  ) {
    return "converted";
  }

  if (
    [
      "rejected",
      "declined",
    ].includes(trialStatus)
  ) {
    return "rejected";
  }

  if (
    [
      "cancelled",
      "canceled",
      "terminated",
    ].includes(trialStatus)
  ) {
    return "cancelled";
  }

  if (
    [
      "expired",
      "trial_expired",
    ].includes(trialStatus)
  ) {
    return "expired";
  }

  if (
    [
      "approved",
      "active",
      "trial_active",
    ].includes(trialStatus)
  ) {
    const remaining = daysRemaining(
      tenant.trial_ends_at,
    );

    if (
      remaining !== null &&
      remaining < 0
    ) {
      return "expired";
    }

    return "active";
  }

  if (
    [
      "pending",
      "pending_approval",
      "awaiting_approval",
      "requested",
      "none",
      "",
    ].includes(trialStatus)
  ) {
    return "pending";
  }

  return trialStatus;
}

function badgeClass(
  value?: string | null,
) {
  const status =
    normalizeStatus(value);

  if (
    [
      "approved",
      "active",
      "paid",
      "converted",
    ].includes(status)
  ) {
    return "rounded-full border-emerald-200 bg-emerald-50 dark:bg-emerald-950/35 text-emerald-700";
  }

  if (
    [
      "expired",
      "declined",
      "rejected",
      "suspended",
      "cancelled",
      "canceled",
      "terminated",
    ].includes(status)
  ) {
    return "rounded-full border-rose-200 bg-rose-50 dark:bg-rose-950/35 text-rose-700";
  }

  if (
    [
      "pending",
      "pending_approval",
      "requested",
      "awaiting_approval",
    ].includes(status)
  ) {
    return "rounded-full border-orange-200 bg-orange-50 dark:bg-orange-950/35 text-orange-700";
  }

  return "rounded-full border-blue-200 bg-blue-50 dark:bg-blue-950/35 text-blue-700";
}

function csvEscape(
  value: unknown,
) {
  return `"${String(value ?? "").replace(
    /"/g,
    '""',
  )}"`;
}



export default function TrialManagement() {
  const { t, formatDate, formatDateTime } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<TrialStatusFilter>("all");
  const [planFilter, setPlanFilter] =
    useState("all");
  const [durationDays, setDurationDays] =
    useState(14);
  const [
    selectedTenantId,
    setSelectedTenantId,
  ] = useState<string | null>(null);

  const trialsQ = useQuery({
    queryKey: [
      "platform-trial-management",
    ],
    queryFn: async () => {
      const [tenantsRes, eventsRes] =
        await Promise.all([
          (supabase as any)
            .from("tenants")
            .select(`
              id,
              name,
              owner_id,
              subscription_plan,
              subscription_status,
              payment_status,
              workspace_status,
              trial_status,
              trial_ends_at,
              onboarding_completed,
              created_at,
              tenant_subscriptions (
                id,
                plan_code,
                status,
                billing_cycle,
                trial_ends_at,
                current_period_start,
                current_period_end,
                created_at
              )
            `)
            .order("created_at", {
              ascending: false,
            }),

          (supabase as any)
            .from("subscription_events")
            .select(
              "id, tenant_id, event_type, title, description, created_at",
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(100),
        ]);

      if (tenantsRes.error) {
        throw tenantsRes.error;
      }

      return {
        tenants:
          (tenantsRes.data ??
            []) as TenantRow[],
        events: eventsRes.error
          ? []
          : ((eventsRes.data ??
              []) as EventRow[]),
      };
    },
    refetchInterval: 30000,
  });

  const refreshTrialData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [
          "platform-trial-management",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "platform-subscription-engine",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "platform-engine-invoices",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "platform-payment-attempts",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "platform-dashboard-commercial",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: ["tenant-360"],
      }),
    ]);
  };

  const updateTrial = useMutation({
    mutationFn: async ({
      tenant,
      action,
      days,
    }: {
      tenant: TenantRow;
      action: TrialAction;
      days?: number;
    }) => {
      const actionLabel = formatLabel(action);

      const confirmed = window.confirm(
        `${actionLabel} trial access for ${tenant.name}?`,
      );

      if (!confirmed) {
        return {
          cancelled: true,
          action,
        };
      }

      const reason =
        action === "approve"
          ? `Trial approved for ${days || 14} days from Platform Administration.`
          : action === "extend"
            ? `Trial extended by ${days || 14} days from Platform Administration.`
            : action === "expire"
              ? "Trial expired from Platform Administration."
              : action === "reject"
                ? "Trial request rejected by Platform Administration."
                : action === "convert"
                  ? "Trial converted to paid after verified payment."
                  : "Trial cancelled by Platform Administration.";

      let rpcName:
        | "approve_trial"
        | "extend_trial"
        | "expire_trial"
        | "reject_trial"
        | "cancel_trial"
        | "convert_trial_to_paid";

      let args: Record<string, unknown>;

      switch (action) {
        case "approve":
          rpcName = "approve_trial";
          args = {
            p_tenant_id: tenant.id,
            p_trial_days: days || 14,
            p_reason: reason,
          };
          break;

        case "extend":
          rpcName = "extend_trial";
          args = {
            p_tenant_id: tenant.id,
            p_trial_days: days || 14,
            p_reason: reason,
          };
          break;

        case "expire":
          rpcName = "expire_trial";
          args = {
            p_tenant_id: tenant.id,
            p_reason: reason,
          };
          break;

        case "reject":
          rpcName = "reject_trial";
          args = {
            p_tenant_id: tenant.id,
            p_reason: reason,
          };
          break;

        case "cancel":
          rpcName = "cancel_trial";
          args = {
            p_tenant_id: tenant.id,
            p_reason: reason,
          };
          break;

        case "convert":
          rpcName = "convert_trial_to_paid";
          args = {
            p_tenant_id: tenant.id,
            p_reason: reason,
          };
          break;

        default: {
          const exhaustiveCheck: never = action;
          throw new Error(
            `Unsupported trial action: ${exhaustiveCheck}`,
          );
        }
      }

      const { data, error } = await (
        supabase as any
      ).rpc(rpcName, args);

      if (error) {
        throw error;
      }

      return {
        cancelled: false,
        action,
        result: data,
      };
    },
    onSuccess: async (result) => {
      if (result?.cancelled) {
        return;
      }

      const successMessage =
        result?.action === "approve"
          ? "Trial approved successfully."
          : result?.action === "extend"
            ? "Trial extended successfully."
            : result?.action === "expire"
              ? "Trial expired successfully."
              : result?.action === "reject"
                ? "Trial request rejected."
                : result?.action === "convert"
                  ? "Trial converted to paid subscription."
                  : "Trial cancelled successfully.";

      toast.success(successMessage);

      await refreshTrialData();
    },
    onError: (error: any) => {
      toast.error(
        error?.message ||
          "Trial lifecycle action failed.",
      );
    },
  });
  const allTenants =
    trialsQ.data?.tenants ?? [];

  const events =
    trialsQ.data?.events ?? [];

  const planOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allTenants
            .map((tenant) =>
              normalizeStatus(
                tenant.subscription_plan,
              ),
            )
            .filter(Boolean),
        ),
      ),
    [allTenants],
  );

  const rows = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return allTenants.filter(
      (tenant) => {
        const resolvedStatus =
          resolveTrialStatus(tenant);

        const matchesStatus =
          statusFilter === "all" ||
          resolvedStatus === statusFilter;

        const matchesPlan =
          planFilter === "all" ||
          normalizeStatus(
            tenant.subscription_plan,
          ) === planFilter;

        if (
          !matchesStatus ||
          !matchesPlan
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        return (
          tenant.name
            ?.toLowerCase()
            .includes(query) ||
          tenant.subscription_plan
            ?.toLowerCase()
            .includes(query) ||
          tenant.trial_status
            ?.toLowerCase()
            .includes(query) ||
          tenant.workspace_status
            ?.toLowerCase()
            .includes(query) ||
          tenant.subscription_status
            ?.toLowerCase()
            .includes(query)
        );
      },
    );
  }, [
    allTenants,
    search,
    statusFilter,
    planFilter,
  ]);

  const stats = useMemo(() => {
    const total = allTenants.length;

    const pending =
      allTenants.filter(
        (tenant) =>
          resolveTrialStatus(
            tenant,
          ) === "pending",
      ).length;

    const active =
      allTenants.filter(
        (tenant) =>
          resolveTrialStatus(
            tenant,
          ) === "active",
      ).length;

    const expired =
      allTenants.filter(
        (tenant) =>
          resolveTrialStatus(
            tenant,
          ) === "expired",
      ).length;

    const rejected =
      allTenants.filter(
        (tenant) =>
          resolveTrialStatus(
            tenant,
          ) === "rejected",
      ).length;

    const converted =
      allTenants.filter(
        (tenant) =>
          resolveTrialStatus(
            tenant,
          ) === "converted",
      ).length;

    const expiringSoon =
      allTenants.filter(
        (tenant) => {
          const remaining =
            daysRemaining(
              tenant.trial_ends_at,
            );

          return (
            resolveTrialStatus(
              tenant,
            ) === "active" &&
            remaining !== null &&
            remaining >= 0 &&
            remaining <= 5
          );
        },
      ).length;

    const conversionRate =
      active + converted > 0
        ? Math.round(
            (converted /
              (active + converted)) *
              100,
          )
        : 0;

    return {
      total,
      pending,
      active,
      expired,
      rejected,
      converted,
      expiringSoon,
      conversionRate,
    };
  }, [allTenants]);

  const exportCsv = () => {
    if (!rows.length) {
      toast.error(
        "There are no trial records to export.",
      );
      return;
    }

    const header = [
      "Workspace",
      "Tenant ID",
      "Plan",
      "Trial Status",
      "Resolved Trial State",
      "Trial Ends At",
      "Days Remaining",
      "Subscription Status",
      "Payment Status",
      "Workspace Status",
      "Created At",
    ];

    const lines = rows.map(
      (tenant) => [
        tenant.name,
        tenant.id,
        tenant.subscription_plan || "",
        tenant.trial_status || "",
        resolveTrialStatus(tenant),
        tenant.trial_ends_at || "",
        daysRemaining(
          tenant.trial_ends_at,
        ) ?? "",
        tenant.subscription_status ||
          "",
        tenant.payment_status || "",
        tenant.workspace_status || "",
        tenant.created_at || "",
      ],
    );

    const csv = [header, ...lines]
      .map((line) =>
        line.map(csvEscape).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download = `shopcore-trials-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    toast.success(
      "Trial report exported.",
    );
  };

  const busy =
    updateTrial.isPending;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
          Trial Governance
        </p>

        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {t("platformAdmin.pages.trials.title")}
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
              Review trial requests, approve
              evaluation access, extend active
              trials, monitor expiry, reject invalid
              requests and convert verified
              customers into paid subscriptions.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              variant="outline"
              className="rounded-xl font-black"
            >
              <Link to="/platform-admin/subscriptions">
                <Store className="mr-2 h-4 w-4" />
                Subscriptions
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="rounded-xl font-black"
            >
              <Link to="/platform-admin/invoices">
                <FileText className="mr-2 h-4 w-4" />
                Invoices
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="rounded-xl font-black"
            >
              <Link to="/platform-admin/payment-attempts">
                <WalletCards className="mr-2 h-4 w-4" />
                Payment Attempts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              variant="outline"
              className="rounded-xl font-black"
              onClick={exportCsv}
              disabled={!rows.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>

            <Button
              className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
              onClick={() => {
                void trialsQ.refetch();
                toast.info(
                  "Refreshing trial records...",
                );
              }}
              disabled={trialsQ.isFetching}
            >
              <RefreshCw
                className={[
                  "mr-2 h-4 w-4",
                  trialsQ.isFetching
                    ? "animate-spin"
                    : "",
                ].join(" ")}
              />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <KpiCard
          icon={
            <ShieldCheck className="h-6 w-6" />
          }
          label="Total Workspaces"
          value={stats.total.toLocaleString()}
          tone="blue"
        />

        <KpiCard
          icon={
            <Clock className="h-6 w-6" />
          }
          label="Pending Review"
          value={stats.pending.toLocaleString()}
          tone="orange"
        />

        <KpiCard
          icon={
            <CheckCircle2 className="h-6 w-6" />
          }
          label="Active Trials"
          value={stats.active.toLocaleString()}
          tone="emerald"
        />

        <KpiCard
          icon={
            <Hourglass className="h-6 w-6" />
          }
          label="Expiring Soon"
          value={stats.expiringSoon.toLocaleString()}
          tone="cyan"
        />

        <KpiCard
          icon={
            <CalendarClock className="h-6 w-6" />
          }
          label="Expired"
          value={stats.expired.toLocaleString()}
          tone="rose"
        />

        <KpiCard
          icon={
            <XCircle className="h-6 w-6" />
          }
          label="Rejected"
          value={stats.rejected.toLocaleString()}
          tone="rose"
        />

        <KpiCard
          icon={
            <UserRoundCheck className="h-6 w-6" />
          }
          label="Converted"
          value={stats.converted.toLocaleString()}
          tone="violet"
        />

        <KpiCard
          icon={
            <TrendingUp className="h-6 w-6" />
          }
          label="Conversion Rate"
          value={`${stats.conversionRate}%`}
          tone="cyan"
        />
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/35 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

          <div>
            <p className="text-sm font-black text-blue-950">
              Trial approval and payment verification are separate controls
            </p>

            <p className="mt-1 text-xs font-medium leading-5 text-blue-800">
              Approving a trial grants temporary
              workspace access through secured database
              RPCs. Every action updates tenant,
              subscription and audit history atomically.
              Converting a trial to paid still requires a
              verified payment record.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 grid gap-3 xl:grid-cols-[1fr_220px_220px_180px]">
          <div className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-muted/40 px-4">
            <Search className="h-4 w-4 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder={t("platformAdmin.pages.trials.search")}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as TrialStatusFilter,
              )
            }
            className="h-11 rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">
              All trial states
            </option>
            <option value="pending">
              Pending review
            </option>
            <option value="active">
              Active
            </option>
            <option value="expired">
              Expired
            </option>
            <option value="rejected">
              Rejected
            </option>
            <option value="converted">
              Converted
            </option>
            <option value="cancelled">
              Cancelled
            </option>
          </select>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />

            <select
              value={planFilter}
              onChange={(event) =>
                setPlanFilter(
                  event.target.value,
                )
              }
              className="h-11 flex-1 rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">
                All plans
              </option>

              {planOptions.map((plan) => (
                <option
                  key={plan}
                  value={plan}
                >
                  {formatLabel(plan)}
                </option>
              ))}
            </select>
          </div>

          <label>
            <span className="sr-only">
              Trial duration
            </span>

            <select
              value={durationDays}
              onChange={(event) =>
                setDurationDays(
                  Number(
                    event.target.value,
                  ),
                )
              }
              className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            >
              <option value={7}>
                7-day action
              </option>
              <option value={14}>
                14-day action
              </option>
              <option value={30}>
                30-day action
              </option>
            </select>
          </label>
        </div>

        {trialsQ.isLoading ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
            <p className="ml-3 text-sm font-bold text-muted-foreground">
              Loading trial records...
            </p>
          </div>
        ) : trialsQ.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/35 p-6 text-sm font-bold text-rose-700">
            {trialsQ.error instanceof Error
              ? trialsQ.error.message
              : "Trial records could not be loaded."}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-muted-foreground">
            No trial records match the current
            filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[1650px] text-left text-sm">
              <thead className="bg-muted/40 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">
                    Workspace
                  </th>
                  <th className="px-4 py-3">
                    Package
                  </th>
                  <th className="px-4 py-3">
                    Trial State
                  </th>
                  <th className="px-4 py-3">
                    Trial End
                  </th>
                  <th className="px-4 py-3">
                    Remaining
                  </th>
                  <th className="px-4 py-3">
                    Subscription
                  </th>
                  <th className="px-4 py-3">
                    Payment
                  </th>
                  <th className="px-4 py-3">
                    Workspace
                  </th>
                  <th className="px-4 py-3">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((tenant) => {
                  const resolvedStatus =
                    resolveTrialStatus(
                      tenant,
                    );

                  const remaining =
                    daysRemaining(
                      tenant.trial_ends_at,
                    );

                  const canApprove =
                    resolvedStatus ===
                    "pending";

                  const canExtend =
                    resolvedStatus ===
                    "active";

                  const canExpire =
                    [
                      "active",
                      "pending",
                    ].includes(
                      resolvedStatus,
                    );

                  const canReject =
                    resolvedStatus ===
                    "pending";

                  const canConvert =
                    resolvedStatus ===
                      "active" &&
                    normalizeStatus(
                      tenant.payment_status,
                    ) === "paid";

                  const canCancel =
                    ![
                      "converted",
                      "cancelled",
                      "rejected",
                    ].includes(
                      resolvedStatus,
                    );

                  return (
                    <tr
                      key={tenant.id}
                      className="border-t border-border align-top transition hover:bg-muted/40/70"
                    >
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() =>
                            setSelectedTenantId(
                              tenant.id,
                            )
                          }
                        >
                          <p className="font-black text-blue-700 hover:text-blue-900">
                            {tenant.name}
                          </p>

                          <p className="mt-1 max-w-[190px] truncate text-xs font-medium text-muted-foreground">
                            {tenant.id}
                          </p>
                        </button>
                      </td>

                      <td className="px-4 py-4 font-black text-foreground">
                        {formatLabel(
                          tenant.subscription_plan ||
                            "pending",
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <Badge
                          variant="outline"
                          className={badgeClass(
                            resolvedStatus,
                          )}
                        >
                          {formatLabel(
                            resolvedStatus,
                          )}
                        </Badge>
                      </td>

                      <td className="px-4 py-4 font-bold text-foreground">
                        {formatDate(
                          tenant.trial_ends_at,
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <p
                          className={[
                            "font-black",
                            remaining === null
                              ? "text-muted-foreground"
                              : remaining < 0
                                ? "text-rose-700"
                                : remaining <= 5
                                  ? "text-orange-700"
                                  : "text-emerald-700",
                          ].join(" ")}
                        >
                          {remaining === null
                            ? "Not set"
                            : remaining < 0
                              ? `${Math.abs(
                                  remaining,
                                )} days overdue`
                              : `${remaining} days`}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <Badge
                          variant="outline"
                          className={badgeClass(
                            tenant.subscription_status,
                          )}
                        >
                          {formatLabel(
                            tenant.subscription_status ||
                              "pending",
                          )}
                        </Badge>
                      </td>

                      <td className="px-4 py-4">
                        <Badge
                          variant="outline"
                          className={badgeClass(
                            tenant.payment_status,
                          )}
                        >
                          {formatLabel(
                            tenant.payment_status ||
                              "unpaid",
                          )}
                        </Badge>
                      </td>

                      <td className="px-4 py-4">
                        <Badge
                          variant="outline"
                          className={badgeClass(
                            tenant.workspace_status,
                          )}
                        >
                          {formatLabel(
                            tenant.workspace_status ||
                              "pending",
                          )}
                        </Badge>
                      </td>

                      <td className="px-4 py-4 text-xs font-medium text-muted-foreground">
                        {formatDateTime(
                          tenant.created_at,
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-blue-200 bg-blue-50 dark:bg-blue-950/35 font-black text-blue-700 hover:bg-blue-100"
                            onClick={() =>
                              setSelectedTenantId(
                                tenant.id,
                              )
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>

                          <Button
                            size="sm"
                            className="rounded-xl bg-emerald-600 font-black hover:bg-emerald-700"
                            disabled={
                              busy || !canApprove
                            }
                            onClick={() =>
                              updateTrial.mutate({
                                tenant,
                                action: "approve",
                                days:
                                  durationDays,
                              })
                            }
                          >
                            Approve
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-blue-200 bg-blue-50 dark:bg-blue-950/35 font-black text-blue-700 hover:bg-blue-100"
                            disabled={
                              busy || !canExtend
                            }
                            onClick={() =>
                              updateTrial.mutate({
                                tenant,
                                action: "extend",
                                days:
                                  durationDays,
                              })
                            }
                          >
                            Extend
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-orange-200 bg-orange-50 dark:bg-orange-950/35 font-black text-orange-700 hover:bg-orange-100"
                            disabled={
                              busy || !canExpire
                            }
                            onClick={() =>
                              updateTrial.mutate({
                                tenant,
                                action: "expire",
                              })
                            }
                          >
                            Expire
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-violet-200 bg-violet-50 dark:bg-violet-950/35 font-black text-violet-700 hover:bg-violet-100"
                            disabled={
                              busy || !canConvert
                            }
                            onClick={() =>
                              updateTrial.mutate({
                                tenant,
                                action: "convert",
                              })
                            }
                          >
                            Convert
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-rose-200 bg-rose-50 dark:bg-rose-950/35 font-black text-rose-700 hover:bg-rose-100"
                            disabled={
                              busy || !canReject
                            }
                            onClick={() =>
                              updateTrial.mutate({
                                tenant,
                                action: "reject",
                              })
                            }
                          >
                            Reject
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-border bg-muted/40 font-black text-foreground hover:bg-muted"
                            disabled={
                              busy || !canCancel
                            }
                            onClick={() =>
                              updateTrial.mutate({
                                tenant,
                                action: "cancel",
                              })
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Trial Portfolio
          </p>

          <h2 className="mt-2 text-xl font-black text-foreground">
            Package Distribution
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {planOptions.map((plan) => {
              const count =
                allTenants.filter(
                  (tenant) =>
                    normalizeStatus(
                      tenant.subscription_plan,
                    ) === plan,
                ).length;

              return (
                <div
                  key={plan}
                  className="rounded-2xl border border-border bg-muted/40 p-5"
                >
                  <Store className="h-5 w-5 text-violet-600" />

                  <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    {formatLabel(plan)}
                  </p>

                  <p className="mt-2 text-3xl font-black text-foreground">
                    {count}
                  </p>
                </div>
              );
            })}

            {!planOptions.length ? (
              <div className="rounded-2xl border border-border bg-muted/40 p-5 text-sm font-bold text-muted-foreground">
                No trial plan distribution available.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Trial Events
          </p>

          <h2 className="mt-2 text-xl font-black text-foreground">
            Latest Activity
          </h2>

          <div className="mt-6 space-y-3">
            {events
              .filter((event) =>
                event.event_type?.startsWith(
                  "trial_",
                ),
              )
              .slice(0, 8)
              .map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-slate-100 bg-muted/40 p-4"
                >
                  <p className="text-sm font-black text-foreground">
                    {event.title}
                  </p>

                  <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                    {event.description ||
                      event.event_type}
                  </p>

                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {formatDateTime(
                      event.created_at,
                    )}
                  </p>
                </div>
              ))}

            {!events.some((event) =>
              event.event_type?.startsWith(
                "trial_",
              ),
            ) ? (
              <div className="rounded-2xl border border-slate-100 bg-muted/40 p-4 text-sm font-bold text-muted-foreground">
                No trial events yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Tenant360Drawer
        open={Boolean(selectedTenantId)}
        tenantId={selectedTenantId}
        onClose={() =>
          setSelectedTenantId(null)
        }
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone:
    | "blue"
    | "emerald"
    | "orange"
    | "rose"
    | "violet"
    | "cyan";
}) {
  const toneClass = {
    blue:
      "bg-blue-50 dark:bg-blue-950/35 text-blue-700 border-blue-200",
    emerald:
      "bg-emerald-50 dark:bg-emerald-950/35 text-emerald-700 border-emerald-200",
    orange:
      "bg-orange-50 dark:bg-orange-950/35 text-orange-700 border-orange-200",
    rose:
      "bg-rose-50 dark:bg-rose-950/35 text-rose-700 border-rose-200",
    violet:
      "bg-violet-50 dark:bg-violet-950/35 text-violet-700 border-violet-200",
    cyan:
      "bg-cyan-50 dark:bg-cyan-950/35 text-cyan-700 border-cyan-200",
  }[tone];

  return (
    <div
      className={`rounded-[1.5rem] border p-5 shadow-sm ${toneClass}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/80">
        {icon}
      </div>

      <p className="mt-5 text-xs font-black uppercase tracking-[0.16em]">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

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
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  Download,
  Edit3,
  FileText,
  Filter,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { platformApi } from "@/lib/apiClient";
import { subscriptionApi } from "@/lib/subscriptionApi";
import {
  PageContainer,
  PageToolbar,
  PrimaryAction,
  ToolbarButton,
} from "@/components/patterns";
import Tenant360Drawer from "@/pages/platform-admin/components/Tenant360Drawer";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "./components/PlatformKpiCard";

type SubscriptionStatusFilter =
  | "all"
  | "active"
  | "trial"
  | "pending_payment"
  | "suspended"
  | "cancelled"
  | "expired"
  | "terminated";

type SubscriptionLifecycleAction =
  | "suspend"
  | "resume"
  | "cancel"
  | "terminate"
  | "renew";

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  plan_code: string;
  status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  grace_period_ends_at: string | null;
  pending_plan_code: string | null;
  pending_billing_cycle: string | null;
  pending_plan_change_at: string | null;
  pending_plan_change_reason: string | null;
  pending_plan_change_requested_by: string | null;
  pending_plan_change_requested_at: string | null;
  created_at: string | null;
  tenants?: {
    name?: string | null;
    payment_status?: string | null;
    workspace_status?: string | null;
    trial_status?: string | null;
    subscription_plan?: string | null;
  } | null;
  subscription_invoices?: Array<{
    id: string;
    invoice_no: string | null;
    status: string | null;
    currency: string | null;
    total: number | null;
    due_date: string | null;
    paid_at: string | null;
    created_at: string | null;
  }>;
  payment_attempts?: Array<{
    id: string;
    status: string | null;
    amount: number | null;
    currency: string | null;
    payment_method: string | null;
    provider: string | null;
    attempted_at: string | null;
    verified_at: string | null;
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

type PlanLimitRow = {
  plan_code: string;
  limit_key: string;
  limit_value: number | null;
  is_unlimited: boolean | null;
  unit: string | null;
};

type PlanPriceRow = {
  plan_code: string;
  billing_cycle: string;
  price: number | null;
  effective_monthly_price: number | null;
  discount_percent: number | null;
  currency: string | null;
};

type UsageMetricRow = {
  tenant_id: string;
  metric_key: string;
  metric_value: number | null;
};

type PlanCatalogRow = {
  code: string;
  name: string | null;
  monthly_price: number | null;
  currency: string | null;
  max_users: number | null;
  max_branches: number | null;
  max_products: number | null;
};

type PlanChangeState = {
  subscription: SubscriptionRow;
  nextPlanCode: string;
  nextBillingCycle: "monthly" | "six_months" | "annual";
  effectiveTiming: "immediate" | "next_period";
  reason: string;
};

function money(
  amount?: number | null,
  currency = "RWF",
) {
  return `${currency} ${Number(
    amount || 0,
  ).toLocaleString()}`;
}

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
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleDateString();
}

function formatDateTime(
  value?: string | null,
) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return date.toLocaleString();
}

function daysUntil(
  value?: string | null,
) {
  if (!value) return null;

  const target = new Date(value).getTime();

  if (!Number.isFinite(target)) {
    return null;
  }

  return Math.ceil(
    (target - Date.now()) / 86_400_000,
  );
}

function planOrder(code?: string | null) {
  const order = [
    "starter",
    "professional",
    "business_plus",
    "enterprise_pro",
  ];

  const index = order.indexOf(
    normalizeStatus(code),
  );

  return index === -1 ? 999 : index;
}

function getPlanPrice(
  planCode: string,
  billingCycle: string,
  prices: PlanPriceRow[],
  plans: PlanCatalogRow[],
) {
  const configured = prices.find(
    (price) =>
      normalizeStatus(price.plan_code) ===
        normalizeStatus(planCode) &&
      normalizeStatus(price.billing_cycle) ===
        normalizeStatus(billingCycle),
  );

  if (configured) {
    return {
      total: Number(configured.price || 0),
      effectiveMonthly: Number(
        configured.effective_monthly_price ||
          configured.price ||
          0,
      ),
      currency: configured.currency || "RWF",
      discount: Number(
        configured.discount_percent || 0,
      ),
    };
  }

  const plan = plans.find(
    (item) =>
      normalizeStatus(item.code) ===
      normalizeStatus(planCode),
  );

  const monthly = Number(
    plan?.monthly_price || 0,
  );

  const months =
    billingCycle === "six_months"
      ? 6
      : billingCycle === "annual"
        ? 12
        : 1;

  const discount =
    billingCycle === "six_months"
      ? 8
      : billingCycle === "annual"
        ? 15
        : 0;

  const total = Math.round(
    monthly *
      months *
      (1 - discount / 100),
  );

  return {
    total,
    effectiveMonthly:
      months > 1
        ? Math.round(total / months)
        : monthly,
    currency: plan?.currency || "RWF",
    discount,
  };
}

function getLimitValue(
  plan: PlanCatalogRow | undefined,
  limits: PlanLimitRow[],
  limitKey: string,
) {
  const configured = limits.find(
    (limit) =>
      normalizeStatus(limit.plan_code) ===
        normalizeStatus(plan?.code) &&
      normalizeStatus(limit.limit_key) ===
        normalizeStatus(limitKey),
  );

  if (configured?.is_unlimited) {
    return null;
  }

  if (
    configured?.limit_value !== null &&
    configured?.limit_value !== undefined
  ) {
    return Number(configured.limit_value);
  }

  if (limitKey === "users") {
    return plan?.max_users ?? null;
  }

  if (limitKey === "branches") {
    return plan?.max_branches ?? null;
  }

  if (limitKey === "products") {
    return plan?.max_products ?? null;
  }

  return null;
}

function isPaidStatus(
  value?: string | null,
) {
  return [
    "paid",
    "verified",
    "completed",
    "successful",
  ].includes(normalizeStatus(value));
}

function isPendingStatus(
  value?: string | null,
) {
  return [
    "pending",
    "pending_payment",
    "processing",
    "initiated",
    "submitted",
    "awaiting_verification",
  ].includes(normalizeStatus(value));
}

function isFailedStatus(
  value?: string | null,
) {
  return [
    "failed",
    "rejected",
    "declined",
    "expired",
    "cancelled",
    "canceled",
  ].includes(normalizeStatus(value));
}

function csvEscape(
  value: unknown,
) {
  return `"${String(value ?? "").replace(
    /"/g,
    '""',
  )}"`;
}

function statusBadge(
  status?: string | null,
) {
  const value =
    normalizeStatus(status) || "pending";

  if (
    [
      "active",
      "paid",
      "approved",
      "trial",
      "trial_active",
    ].includes(value)
  ) {
    return (
      <Badge className="rounded-full border-emerald-500/25 bg-emerald-500/10 dark:bg-emerald-950/35 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/35">
        {formatLabel(value)}
      </Badge>
    );
  }

  if (
    [
      "suspended",
      "blocked",
      "expired",
      "cancelled",
      "canceled",
      "terminated",
      "failed",
      "rejected",
    ].includes(value)
  ) {
    return (
      <Badge className="rounded-full border-rose-500/25 bg-rose-500/10 dark:bg-rose-950/35 text-rose-700 hover:bg-rose-50 dark:bg-rose-950/35">
        {formatLabel(value)}
      </Badge>
    );
  }

  if (
    [
      "pending",
      "pending_payment",
      "processing",
      "issued",
      "overdue",
      "grace_period",
    ].includes(value)
  ) {
    return (
      <Badge className="rounded-full border-orange-500/25 bg-orange-500/10 dark:bg-orange-950/35 text-orange-700 hover:bg-orange-50 dark:bg-orange-950/35">
        {formatLabel(value)}
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full border-blue-500/25 bg-blue-500/10 dark:bg-blue-950/35 text-primary hover:bg-blue-50 dark:bg-blue-950/35">
      {formatLabel(value)}
    </Badge>
  );
}



export default function Subscriptions() {
  const { t, formatDate, formatDateTime } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<SubscriptionStatusFilter>("all");
  const [planFilter, setPlanFilter] =
    useState("all");
  const [
    selectedTenantId,
    setSelectedTenantId,
  ] = useState<string | null>(null);
  const [
    planChange,
    setPlanChange,
  ] = useState<PlanChangeState | null>(null);

  const commercialQ = useQuery({
    queryKey: [
      "platform-subscription-engine",
    ],
    /*
     * From our own database.
     *
     * This used to select from Supabase tables — tenant_subscriptions,
     * subscription_events, plan catalogues — none of which exist here, so the
     * page reported "Subscription records could not be loaded" no matter how
     * many live subscriptions there were.
     *
     * The plan catalogue comes from the same endpoint the pricing screens use,
     * so the console and the customer see one catalogue. Events are not
     * modelled yet, so that list stays empty rather than being faked.
     */
    queryFn: async () => {
      const [records, plans] = await Promise.all([
        platformApi.subscriptionRecords(),
        subscriptionApi.plans(),
      ]);

      const subscriptions = records.subscriptions.map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_code: row.plan_code,
        status: row.status,
        billing_cycle: row.billing_cycle,
        current_period_start: row.current_period_start,
        current_period_end: row.current_period_end,
        trial_ends_at: row.trial_ends_at,
        cancel_at_period_end: false,
        cancelled_at: null,
        grace_period_ends_at: null,
        pending_plan_code: null,
        pending_billing_cycle: null,
        pending_plan_change_at: null,
        pending_plan_change_reason: null,
        pending_plan_change_requested_by: null,
        pending_plan_change_requested_at: null,
        created_at: row.created_at,
        tenants: {
          name: row.tenant_name,
          payment_status: row.payment_status,
          workspace_status: row.status,
          trial_status: row.trial_ends_at ? "active" : null,
          subscription_plan: row.plan_code,
        },
        /*
         * The table counts this array and prints "No invoice" when it is
         * empty. Real counts come from the endpoint, so a stub of the right
         * length keeps that column honest without shipping every invoice row
         * to a screen that only shows the number.
         */
        subscription_invoices: Array.from({ length: row.invoice_count }, () => ({})),
        payment_attempts: Array.from({ length: row.payment_count }, () => ({})),
      })) as unknown as SubscriptionRow[];

      return {
        subscriptions,
        events: [] as EventRow[],
        /*
         * The price fields matter: the table prints "{monthly_price}/month"
         * per row and the MRR card sums them. Mapping only code and name made
         * every plan render "RWF 0/month" and monthly recurring revenue read
         * zero, on a platform with six paying subscriptions.
         */
        plans: plans.map((plan) => ({
          code: plan.code,
          name: plan.name,
          monthly_price: plan.monthly_price,
          currency: plan.currency,
          max_users: null,
          max_branches: null,
          max_products: null,
        })) as unknown as PlanCatalogRow[],
        prices: [] as PlanPriceRow[],
        limits: [] as PlanLimitRow[],
        usage: [] as UsageMetricRow[],
      };
    },
    refetchInterval: 30000,
  });

  const subscriptions =
    commercialQ.data?.subscriptions ?? [];
  const events =
    commercialQ.data?.events ?? [];
  const plans =
    commercialQ.data?.plans ?? [];
  const prices =
    commercialQ.data?.prices ?? [];
  const limits =
    commercialQ.data?.limits ?? [];
  const usage =
    commercialQ.data?.usage ?? [];

  const refreshCommercialData = async () => {
    await Promise.all([
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

  const generateInvoice = useMutation({
    mutationFn: async (
      subscription: SubscriptionRow,
    ) => {
      const plan = plans.find(
        (item) =>
          item.code ===
          subscription.plan_code,
      );

      const amount =
        Number(plan?.monthly_price || 0);

      if (!amount) {
        throw new Error(
          "The selected subscription plan does not have a valid billing amount.",
        );
      }

      const description = `${formatLabel(
        subscription.plan_code,
      )} subscription - ${formatLabel(
        subscription.billing_cycle,
      )} billing`;

      const { error } = await (
        supabase as any
      ).rpc(
        "generate_subscription_invoice",
        {
          p_tenant_id:
            subscription.tenant_id,
          p_subscription_id:
            subscription.id,
          p_description: description,
          p_amount: amount,
          p_currency:
            plan?.currency || "RWF",
        },
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(
        "Subscription invoice generated.",
      );
      await refreshCommercialData();
    },
    onError: (error: any) =>
      toast.error(
        error?.message ||
          "Invoice generation failed.",
      ),
  });

  const activatePayment = useMutation({
    mutationFn: async (
      subscription: SubscriptionRow,
    ) => {
      const confirmed = window.confirm(
        `Activate ${
          subscription.tenants?.name ||
          "this workspace"
        } after manual payment verification?`,
      );

      if (!confirmed) {
        return { cancelled: true };
      }

      const { error } = await (
        supabase as any
      ).rpc(
        "activate_workspace_after_payment",
        {
          p_tenant_id:
            subscription.tenant_id,
          p_payment_reference: `MANUAL-${Date.now()}`,
          p_verification_notes:
            "Payment manually verified from Platform Subscription Engine.",
        },
      );

      if (error) throw error;

      return { cancelled: false };
    },
    onSuccess: async (result) => {
      if (result?.cancelled) return;

      toast.success(
        "Workspace activated successfully.",
      );
      await refreshCommercialData();
    },
    onError: (error: any) =>
      toast.error(
        error?.message ||
          "Activation failed.",
      ),
  });

  const updateSubscriptionStatus =
    useMutation({
      mutationFn: async ({
        subscription,
        action,
      }: {
        subscription: SubscriptionRow;
        action: SubscriptionLifecycleAction;
      }) => {
        const workspaceName =
          subscription.tenants?.name ||
          "this subscription";

        let rpcName:
          | "suspend_subscription"
          | "resume_subscription"
          | "cancel_subscription"
          | "terminate_subscription"
          | "renew_subscription";

        let args: Record<string, unknown>;
        let confirmationMessage = "";

        if (action === "suspend") {
          confirmationMessage =
            `Suspend ${workspaceName}? Workspace access will be suspended.`;

          rpcName = "suspend_subscription";
          args = {
            p_tenant_id:
              subscription.tenant_id,
            p_reason:
              "Subscription suspended from Platform Subscription Engine.",
          };
        } else if (action === "resume") {
          confirmationMessage =
            `Resume ${workspaceName}? Verified payment and overdue-invoice checks will run first.`;

          rpcName = "resume_subscription";
          args = {
            p_tenant_id:
              subscription.tenant_id,
            p_reason:
              "Subscription resumed from Platform Subscription Engine.",
          };
        } else if (action === "cancel") {
          const cancelAtPeriodEnd =
            window.confirm(
              `Schedule cancellation for ${workspaceName} at the end of the current billing period?\n\nChoose Cancel to perform an immediate cancellation instead.`,
            );

          confirmationMessage =
            cancelAtPeriodEnd
              ? `Confirm period-end cancellation for ${workspaceName}?`
              : `Cancel ${workspaceName} immediately? Workspace access will be blocked.`;

          rpcName = "cancel_subscription";
          args = {
            p_tenant_id:
              subscription.tenant_id,
            p_cancel_at_period_end:
              cancelAtPeriodEnd,
            p_reason:
              cancelAtPeriodEnd
                ? "Cancellation scheduled from Platform Subscription Engine."
                : "Subscription cancelled immediately from Platform Subscription Engine.",
          };
        } else if (action === "terminate") {
          confirmationMessage =
            `Permanently terminate ${workspaceName}? This is a destructive administrative action.`;

          rpcName = "terminate_subscription";
          args = {
            p_tenant_id:
              subscription.tenant_id,
            p_reason:
              "Subscription terminated from Platform Subscription Engine.",
          };
        } else if (action === "renew") {
          confirmationMessage =
            `Renew ${workspaceName}? Verified payment will be required and the billing period will be extended.`;

          rpcName = "renew_subscription";
          args = {
            p_tenant_id:
              subscription.tenant_id,
            p_reason:
              "Subscription renewed from Platform Subscription Engine.",
          };
        } else {
          throw new Error(
            "Unsupported subscription lifecycle action.",
          );
        }

        const confirmed =
          window.confirm(
            confirmationMessage,
          );

        if (!confirmed) {
          return {
            cancelled: true,
            action,
          };
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
        if (result?.cancelled) return;

        const message =
          result?.action === "suspend"
            ? "Subscription suspended."
            : result?.action === "resume"
              ? "Subscription resumed."
              : result?.action === "cancel"
                ? "Subscription cancellation updated."
                : result?.action === "terminate"
                  ? "Subscription terminated."
                  : result?.action === "renew"
                    ? "Subscription renewed."
                    : "Subscription plan updated.";

        toast.success(message);
        await refreshCommercialData();
      },
      onError: (error: any) =>
        toast.error(
          error?.message ||
            "Subscription lifecycle action failed.",
        ),
    });

  const changePlan = useMutation({
    mutationFn: async (
      state: PlanChangeState,
    ) => {
      if (
        normalizeStatus(
          state.nextPlanCode,
        ) ===
          normalizeStatus(
            state.subscription.plan_code,
          ) &&
        normalizeStatus(
          state.nextBillingCycle,
        ) ===
          normalizeStatus(
            state.subscription.billing_cycle,
          )
      ) {
        throw new Error(
          "Select a different plan or billing cycle.",
        );
      }

      if (!state.reason.trim()) {
        throw new Error(
          "An administrative reason is required.",
        );
      }

      if (
        state.effectiveTiming ===
        "next_period"
      ) {
        if (
          !state.subscription
            .current_period_end
        ) {
          throw new Error(
            "This subscription has no current period end. Use an immediate change or configure the billing period first.",
          );
        }

        const effectiveAt = new Date(
          state.subscription
            .current_period_end,
        );

        if (
          Number.isNaN(
            effectiveAt.getTime(),
          ) ||
          effectiveAt.getTime() <=
            Date.now()
        ) {
          throw new Error(
            "The current billing period has already ended. Apply the plan change immediately.",
          );
        }

        const { data, error } = await (
          supabase as any
        ).rpc(
          "schedule_subscription_plan_change",
          {
            p_tenant_id:
              state.subscription.tenant_id,
            p_new_plan_code:
              state.nextPlanCode,
            p_billing_cycle:
              state.nextBillingCycle,
            p_effective_at:
              state.subscription
                .current_period_end,
            p_reason:
              state.reason.trim(),
          },
        );

        if (error) {
          throw error;
        }

        return {
          mode: "scheduled" as const,
          data,
        };
      }

      const { data, error } = await (
        supabase as any
      ).rpc(
        "change_subscription_plan",
        {
          p_tenant_id:
            state.subscription.tenant_id,
          p_new_plan_code:
            state.nextPlanCode,
          p_billing_cycle:
            state.nextBillingCycle,
          p_reason:
            state.reason.trim(),
        },
      );

      if (error) {
        throw error;
      }

      return {
        mode: "immediate" as const,
        data,
      };
    },
    onSuccess: async (result) => {
      toast.success(
        result.mode === "scheduled"
          ? "Subscription plan change scheduled."
          : "Subscription plan updated.",
      );
      setPlanChange(null);
      await refreshCommercialData();
    },
    onError: (error: any) =>
      toast.error(
        error?.message ||
          "Subscription plan change failed.",
      ),
  });

  const cancelScheduledPlanChange =
    useMutation({
      mutationFn: async (
        subscription: SubscriptionRow,
      ) => {
        const confirmed = window.confirm(
          `Cancel the scheduled plan change for ${
            subscription.tenants?.name ||
            "this workspace"
          }?`,
        );

        if (!confirmed) {
          return { cancelled: true };
        }

        const { data, error } = await (
          supabase as any
        ).rpc(
          "cancel_scheduled_subscription_plan_change",
          {
            p_tenant_id:
              subscription.tenant_id,
            p_reason:
              "Scheduled plan change cancelled from Platform Subscription Engine.",
          },
        );

        if (error) {
          throw error;
        }

        return {
          cancelled: false,
          data,
        };
      },
      onSuccess: async (result) => {
        if (result?.cancelled) return;

        toast.success(
          "Scheduled plan change cancelled.",
        );
        await refreshCommercialData();
      },
      onError: (error: any) =>
        toast.error(
          error?.message ||
            "Scheduled plan change could not be cancelled.",
        ),
    });
  const rows = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return subscriptions.filter(
      (subscription) => {
        const status =
          normalizeStatus(
            subscription.status,
          );

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "trial"
            ? [
                "trial",
                "trial_active",
              ].includes(status)
            : status === statusFilter);

        const matchesPlan =
          planFilter === "all" ||
          normalizeStatus(
            subscription.plan_code,
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
          subscription.tenants?.name
            ?.toLowerCase()
            .includes(query) ||
          subscription.plan_code
            ?.toLowerCase()
            .includes(query) ||
          subscription.status
            ?.toLowerCase()
            .includes(query) ||
          subscription.billing_cycle
            ?.toLowerCase()
            .includes(query) ||
          subscription.pending_plan_code
            ?.toLowerCase()
            .includes(query) ||
          subscription.pending_billing_cycle
            ?.toLowerCase()
            .includes(query) ||
          subscription.tenants
            ?.payment_status
            ?.toLowerCase()
            .includes(query) ||
          subscription.tenants
            ?.workspace_status
            ?.toLowerCase()
            .includes(query) ||
          subscription.subscription_invoices?.some(
            (invoice) =>
              invoice.invoice_no
                ?.toLowerCase()
                .includes(query),
          )
        );
      },
    );
  }, [
    subscriptions,
    search,
    statusFilter,
    planFilter,
  ]);

  const metrics = useMemo(() => {
    const active = subscriptions.filter(
      (subscription) =>
        normalizeStatus(
          subscription.status,
        ) === "active",
    );

    const trials = subscriptions.filter(
      (subscription) =>
        [
          "trial",
          "trial_active",
        ].includes(
          normalizeStatus(
            subscription.status,
          ),
        ),
    );

    const pendingPayment =
      subscriptions.filter(
        (subscription) =>
          normalizeStatus(
            subscription.status,
          ) === "pending_payment" ||
          normalizeStatus(
            subscription.tenants
              ?.payment_status,
          ) === "pending",
      );

    const suspended =
      subscriptions.filter(
        (subscription) =>
          normalizeStatus(
            subscription.status,
          ) === "suspended",
      );

    const expiringSoon =
      subscriptions.filter(
        (subscription) => {
          const remaining = daysUntil(
            subscription.current_period_end ||
              subscription.trial_ends_at,
          );

          return (
            remaining !== null &&
            remaining >= 0 &&
            remaining <= 14
          );
        },
      );

    const overdueBilling =
      subscriptions.filter(
        (subscription) =>
          subscription.subscription_invoices?.some(
            (invoice) => {
              if (!invoice.due_date) {
                return false;
              }

              return (
                ![
                  "paid",
                  "void",
                ].includes(
                  normalizeStatus(
                    invoice.status,
                  ),
                ) &&
                new Date(
                  invoice.due_date,
                ).getTime() <
                  Date.now()
              );
            },
          ),
      );

    const monthlyRecurringRevenue =
      active.reduce((sum, subscription) => {
        const plan = plans.find(
          (item) =>
            item.code ===
            subscription.plan_code,
        );

        return (
          sum +
          Number(
            plan?.monthly_price || 0,
          )
        );
      }, 0);

    return {
      active: active.length,
      trials: trials.length,
      pendingPayment:
        pendingPayment.length,
      suspended: suspended.length,
      expiringSoon:
        expiringSoon.length,
      overdueBilling:
        overdueBilling.length,
      scheduledPlanChanges:
        subscriptions.filter(
          (subscription) =>
            Boolean(
              subscription.pending_plan_code &&
                subscription.pending_plan_change_at,
            ),
        ).length,
      monthlyRecurringRevenue,
      collectionRate: subscriptions.length
        ? Math.round(
            (active.length /
              subscriptions.length) *
              100,
          )
        : 0,
    };
  }, [subscriptions, plans]);

  const exportCsv = () => {
    if (!rows.length) {
      toast.error(
        "There are no subscriptions to export.",
      );
      return;
    }

    const header = [
      "Workspace",
      "Tenant ID",
      "Plan",
      "Subscription Status",
      "Billing Cycle",
      "Payment Status",
      "Workspace Status",
      "Current Period Start",
      "Current Period End",
      "Trial Ends At",
      "Grace Period Ends At",
      "Pending Plan Code",
      "Pending Billing Cycle",
      "Pending Plan Change At",
      "Pending Plan Change Reason",
      "Cancel At Period End",
      "Cancelled At",
      "Invoices",
      "Payment Attempts",
      "Created At",
    ];

    const lines = rows.map(
      (subscription) => [
        subscription.tenants?.name ||
          "Unknown workspace",
        subscription.tenant_id,
        subscription.plan_code,
        subscription.status,
        subscription.billing_cycle,
        subscription.tenants
          ?.payment_status || "",
        subscription.tenants
          ?.workspace_status || "",
        subscription.current_period_start ||
          "",
        subscription.current_period_end ||
          "",
        subscription.trial_ends_at || "",
        subscription.grace_period_ends_at ||
          "",
        subscription.pending_plan_code ||
          "",
        subscription.pending_billing_cycle ||
          "",
        subscription.pending_plan_change_at ||
          "",
        subscription.pending_plan_change_reason ||
          "",
        subscription.cancel_at_period_end,
        subscription.cancelled_at || "",
        subscription
          .subscription_invoices?.length ||
          0,
        subscription.payment_attempts
          ?.length || 0,
        subscription.created_at || "",
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
    anchor.download = `shopcore-subscriptions-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    toast.success(
      "Subscription report exported.",
    );
  };

  const busy =
    activatePayment.isPending ||
    generateInvoice.isPending ||
    updateSubscriptionStatus.isPending ||
    changePlan.isPending ||
    cancelScheduledPlanChange.isPending;

  const planOptions = useMemo(
    () =>
      Array.from(
        new Set(
          subscriptions
            .map((item) =>
              normalizeStatus(
                item.plan_code,
              ),
            )
            .filter(Boolean),
        ),
      ),
    [subscriptions],
  );

  /*
   * The workspace layout: a toolbar, then the figures.
   *
   * This was a hero panel carrying an eyebrow, a 3xl heading, a paragraph
   * of description and four buttons. The heading repeated the page title
   * already shown in the topbar, and no workspace screen looks like this —
   * which is most of why the console read as separate software.
   */
  return (
    <PageContainer className="px-0 py-0 lg:px-0">
      <PlatformPageHeader
        title="Subscriptions"
        description="Every workspace's plan, what it is paying and where it is in its billing cycle."
      />

      <PageToolbar>
        {/*
          Real links, not buttons that navigate — middle-click and
          open-in-new-tab work, which matters for an operator comparing two
          screens. The icon sits inside the anchor because `asChild` hands
          Radix’s Slot exactly one child, and ToolbarButton renders two.
        */}
        <Button asChild variant="ghost" size="sm">
          <Link to="/platform-admin/invoices">
            <FileText className="mr-2 h-4 w-4" />
            Invoices
          </Link>
        </Button>

        <Button asChild variant="ghost" size="sm">
          <Link to="/platform-admin/payment-attempts">
            <WalletCards className="mr-2 h-4 w-4" />
            Payment Attempts
          </Link>
        </Button>

        <ToolbarButton icon={Download} onClick={exportCsv} disabled={!rows.length}>
          Export CSV
        </ToolbarButton>

        <PrimaryAction
          icon={RefreshCw}
          disabled={commercialQ.isFetching}
          onClick={() => {
            void commercialQ.refetch();
            toast.info("Refreshing subscription engine...");
          }}
        >
          Refresh
        </PrimaryAction>
      </PageToolbar>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <PlatformKpiCard
          icon={
            <CreditCard className="h-6 w-6" />
          }
          label="Monthly Recurring Revenue"
          value={money(
            metrics.monthlyRecurringRevenue,
          )}
          tone="violet"
        />

        <PlatformKpiCard
          icon={
            <ShieldCheck className="h-6 w-6" />
          }
          label="Active"
          value={metrics.active.toLocaleString()}
          tone="emerald"
        />

        <PlatformKpiCard
          icon={
            <Store className="h-6 w-6" />
          }
          label="Trials"
          value={metrics.trials.toLocaleString()}
          tone="blue"
        />

        <PlatformKpiCard
          icon={
            <Clock3 className="h-6 w-6" />
          }
          label="Pending Payment"
          value={metrics.pendingPayment.toLocaleString()}
          tone="orange"
        />

        <PlatformKpiCard
          icon={
            <CalendarClock className="h-6 w-6" />
          }
          label="Expiring Soon"
          value={metrics.expiringSoon.toLocaleString()}
          tone="cyan"
        />

        <PlatformKpiCard
          icon={
            <PauseCircle className="h-6 w-6" />
          }
          label="Suspended"
          value={metrics.suspended.toLocaleString()}
          tone="rose"
        />

        <PlatformKpiCard
          icon={
            <AlertTriangle className="h-6 w-6" />
          }
          label="Overdue Billing"
          value={metrics.overdueBilling.toLocaleString()}
          tone="orange"
        />

        <PlatformKpiCard
          icon={
            <Edit3 className="h-6 w-6" />
          }
          label="Scheduled Changes"
          value={metrics.scheduledPlanChanges.toLocaleString()}
          tone="violet"
        />
      </div>


      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 grid gap-3 xl:grid-cols-[1fr_220px_220px]">
          <div className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-muted/40 px-4">
            <Search className="h-4 w-4 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder={t("platformAdmin.pages.subscriptions.search")}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as SubscriptionStatusFilter,
              )
            }
            className="h-11 rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">
              All statuses
            </option>
            <option value="active">
              Active
            </option>
            <option value="trial">
              Trial
            </option>
            <option value="pending_payment">
              Pending payment
            </option>
            <option value="suspended">
              Suspended
            </option>
            <option value="cancelled">
              Cancelled
            </option>
            <option value="expired">
              Expired
            </option>
            <option value="terminated">
              Terminated
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
        </div>

        {commercialQ.isLoading ? (
          <div className="py-12 text-center text-sm font-bold text-muted-foreground">
            Loading subscription engine...
          </div>
        ) : commercialQ.isError ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 dark:bg-rose-950/35 p-6 text-sm font-bold text-rose-700">
            {commercialQ.error instanceof Error
              ? commercialQ.error.message
              : "Subscription records could not be loaded."}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-muted-foreground">
            No subscriptions match the current
            filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[2050px] text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">
                    Workspace
                  </th>
                  <th className="px-4 py-3">
                    Plan
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
                    Billing
                  </th>
                  <th className="px-4 py-3">
                    Current Period
                  </th>
                  <th className="px-4 py-3">
                    Trial / Grace
                  </th>
                  <th className="px-4 py-3">
                    Invoices
                  </th>
                  <th className="px-4 py-3">
                    Attempts
                  </th>
                  <th className="px-4 py-3">
                    Renewal
                  </th>
                  <th className="px-4 py-3">
                    Pending Change
                  </th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((subscription) => {
                  const normalized =
                    normalizeStatus(
                      subscription.status,
                    );

                  const active =
                    normalized === "active";

                  const suspended =
                    normalized === "suspended";

                  const cancelled = [
                    "cancelled",
                    "canceled",
                    "terminated",
                  ].includes(normalized);

                  const latestInvoice =
                    subscription
                      .subscription_invoices?.[0];

                  const latestAttempt =
                    subscription
                      .payment_attempts?.[0];

                  const periodRemaining =
                    daysUntil(
                      subscription.current_period_end,
                    );

                  const trialRemaining =
                    daysUntil(
                      subscription.trial_ends_at,
                    );

                  const graceRemaining =
                    daysUntil(
                      subscription.grace_period_ends_at,
                    );

                  return (
                    <tr
                      key={subscription.id}
                      className="border-t border-border align-top transition hover:bg-muted/40/70"
                    >
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() =>
                            setSelectedTenantId(
                              subscription.tenant_id,
                            )
                          }
                        >
                          <p className="font-semibold text-primary hover:text-blue-900">
                            {subscription.tenants
                              ?.name ||
                              "Unknown workspace"}
                          </p>

                          <p className="mt-1 max-w-[180px] truncate text-[11px] font-medium text-muted-foreground">
                            {subscription.tenant_id}
                          </p>
                        </button>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">
                          {formatLabel(
                            subscription.plan_code ||
                              "starter",
                          )}
                        </p>

                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                          {money(
                            plans.find(
                              (plan) =>
                                plan.code ===
                                subscription.plan_code,
                            )?.monthly_price ||
                              0,
                            plans.find(
                              (plan) =>
                                plan.code ===
                                subscription.plan_code,
                            )?.currency ||
                              "RWF",
                          )}
                          /month
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        {statusBadge(
                          subscription.status,
                        )}

                        {subscription.cancel_at_period_end ? (
                          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-600">
                            Cancels at period end
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">
                        {statusBadge(
                          subscription.tenants
                            ?.payment_status,
                        )}

                        {latestInvoice ? (
                          <p className="mt-2 text-xs font-semibold text-muted-foreground">
                            {latestInvoice.invoice_no ||
                              "Latest invoice"}{" "}
                            ·{" "}
                            {money(
                              latestInvoice.total,
                              latestInvoice.currency ||
                                "RWF",
                            )}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs font-medium text-muted-foreground">
                            No invoice
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {statusBadge(
                          subscription.tenants
                            ?.workspace_status,
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">
                          {formatLabel(
                            subscription.billing_cycle ||
                              "monthly",
                          )}
                        </p>

                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                          Started{" "}
                          {formatDate(
                            subscription.current_period_start ||
                              subscription.created_at,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">
                          {formatDate(
                            subscription.current_period_end,
                          )}
                        </p>

                        <p
                          className={[
                            "mt-1 text-xs font-bold",
                            periodRemaining !==
                              null &&
                            periodRemaining <= 14
                              ? "text-orange-600"
                              : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {periodRemaining === null
                            ? "No renewal date"
                            : periodRemaining < 0
                              ? `${Math.abs(
                                  periodRemaining,
                                )} days overdue`
                              : `${periodRemaining} days remaining`}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">
                          Trial:{" "}
                          {subscription.trial_ends_at
                            ? formatDate(
                                subscription.trial_ends_at,
                              )
                            : "None"}
                        </p>

                        {trialRemaining !== null ? (
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            {trialRemaining >= 0
                              ? `${trialRemaining} trial days remaining`
                              : "Trial expired"}
                          </p>
                        ) : null}

                        {subscription.grace_period_ends_at ? (
                          <p className="mt-2 text-xs font-bold text-orange-600">
                            Grace:{" "}
                            {graceRemaining !== null
                              ? `${graceRemaining} days`
                              : formatDate(
                                  subscription.grace_period_ends_at,
                                )}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">
                          {subscription
                            .subscription_invoices
                            ?.length || 0}
                        </p>

                        {latestInvoice ? (
                          <div className="mt-2">
                            {statusBadge(
                              latestInvoice.status,
                            )}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">
                          {subscription
                            .payment_attempts
                            ?.length || 0}
                        </p>

                        {latestAttempt ? (
                          <div className="mt-2">
                            {statusBadge(
                              latestAttempt.status,
                            )}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">
                        {periodRemaining !== null &&
                        periodRemaining <= 14 ? (
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-orange-600" />

                            <p className="max-w-[180px] text-xs font-bold leading-5 text-orange-700">
                              Renewal review required
                            </p>
                          </div>
                        ) : latestInvoice &&
                          isFailedStatus(
                            latestInvoice.status,
                          ) ? (
                          <p className="text-xs font-bold text-rose-600">
                            Billing failed
                          </p>
                        ) : (
                          <p className="text-xs font-bold text-emerald-600">
                            Ready
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {subscription.pending_plan_code &&
                        subscription.pending_plan_change_at ? (
                          <div className="min-w-[220px] rounded-xl border border-violet-500/25 bg-violet-500/10 dark:bg-violet-950/35 p-3">
                            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                              {formatLabel(
                                subscription.pending_plan_code,
                              )}
                            </p>

                            <p className="mt-1 text-[11px] font-bold text-violet-700">
                              {formatLabel(
                                subscription.pending_billing_cycle ||
                                  subscription.billing_cycle,
                              )}
                              {" · "}
                              {formatDateTime(
                                subscription.pending_plan_change_at,
                              )}
                            </p>

                            {subscription.pending_plan_change_reason ? (
                              <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-5 text-violet-700">
                                {
                                  subscription.pending_plan_change_reason
                                }
                              </p>
                            ) : null}

                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3 h-8 rounded-lg border-violet-500/25 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-100"
                              disabled={busy}
                              onClick={() =>
                                cancelScheduledPlanChange.mutate(
                                  subscription,
                                )
                              }
                            >
                              <XCircle className="mr-1.5 h-3.5 w-3.5" />
                              Cancel schedule
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs font-bold text-muted-foreground">
                            No scheduled change
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            className="rounded-xl border-blue-500/25 bg-blue-500/10 dark:bg-blue-950/35 font-semibold text-primary hover:bg-blue-100"
                            onClick={() =>
                              setSelectedTenantId(
                                subscription.tenant_id,
                              )
                            }
                          >
                            View
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-xl border-violet-500/25 bg-violet-500/10 dark:bg-violet-950/35 font-semibold text-violet-700 hover:bg-violet-100"
                            disabled={busy}
                            onClick={() =>
                              generateInvoice.mutate(
                                subscription,
                              )
                            }
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Invoice
                          </Button>

                          <Button
                            className="rounded-xl bg-primary font-semibold hover:bg-primary/90"
                            disabled={
                              active ||
                              busy ||
                              cancelled
                            }
                            onClick={() =>
                              activatePayment.mutate(
                                subscription,
                              )
                            }
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {active
                              ? "Activated"
                              : "Activate"}
                          </Button>

                          {active ? (
                            <Button
                              variant="outline"
                              className="rounded-xl border-orange-500/25 bg-orange-500/10 dark:bg-orange-950/35 font-semibold text-orange-700 hover:bg-orange-100"
                              disabled={busy}
                              onClick={() =>
                                updateSubscriptionStatus.mutate(
                                  {
                                    subscription,
                                    action:
                                      "suspend",
                                  },
                                )
                              }
                            >
                              <PauseCircle className="mr-2 h-4 w-4" />
                              Suspend
                            </Button>
                          ) : suspended ? (
                            <Button
                              variant="outline"
                              className="rounded-xl border-emerald-500/25 bg-emerald-500/10 dark:bg-emerald-950/35 font-semibold text-emerald-700 hover:bg-emerald-100"
                              disabled={busy}
                              onClick={() =>
                                updateSubscriptionStatus.mutate(
                                  {
                                    subscription,
                                    action:
                                      "resume",
                                  },
                                )
                              }
                            >
                              <PlayCircle className="mr-2 h-4 w-4" />
                              Resume
                            </Button>
                          ) : null}

                          <Button
                            variant="outline"
                            className="rounded-xl border-cyan-500/25 bg-cyan-500/10 dark:bg-cyan-950/35 font-semibold text-cyan-700 hover:bg-cyan-100"
                            disabled={
                              busy ||
                              cancelled
                            }
                            onClick={() =>
                              updateSubscriptionStatus.mutate(
                                {
                                  subscription,
                                  action:
                                    "renew",
                                },
                              )
                            }
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Renew
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-xl border-violet-500/25 bg-violet-500/10 dark:bg-violet-950/35 font-semibold text-violet-700 hover:bg-violet-100"
                            disabled={
                              busy ||
                              cancelled
                            }
                            onClick={() =>
                              setPlanChange({
                                subscription,
                                nextPlanCode:
                                  subscription.plan_code,
                                nextBillingCycle:
                                  (normalizeStatus(
                                    subscription.billing_cycle,
                                  ) === "six_months"
                                    ? "six_months"
                                    : normalizeStatus(
                                          subscription.billing_cycle,
                                        ) === "annual"
                                      ? "annual"
                                      : "monthly"),
                                effectiveTiming:
                                  "immediate",
                                reason: "",
                              })
                            }
                          >
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Change Plan
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-xl border-rose-500/25 bg-rose-500/10 dark:bg-rose-950/35 font-semibold text-rose-700 hover:bg-rose-100"
                            disabled={
                              busy ||
                              cancelled
                            }
                            onClick={() =>
                              updateSubscriptionStatus.mutate(
                                {
                                  subscription,
                                  action:
                                    "cancel",
                                },
                              )
                            }
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-xl border-slate-300 bg-muted font-semibold text-foreground hover:bg-slate-200"
                            disabled={
                              busy ||
                              normalized ===
                                "terminated"
                            }
                            onClick={() =>
                              updateSubscriptionStatus.mutate(
                                {
                                  subscription,
                                  action:
                                    "terminate",
                                },
                              )
                            }
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Terminate
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

      <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("platformAdmin.pages.subscriptions.title")}
          </p>

          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Subscription Distribution
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {planOptions.map((plan) => {
              const count =
                subscriptions.filter(
                  (subscription) =>
                    normalizeStatus(
                      subscription.plan_code,
                    ) === plan,
                ).length;

              return (
                <div
                  key={plan}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <TrendingUp className="h-5 w-5 text-violet-600" />

                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {formatLabel(plan)}
                  </p>

                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {count}
                  </p>
                </div>
              );
            })}

            {!planOptions.length ? (
              <div className="rounded-2xl border border-border bg-card p-5 text-sm font-bold text-muted-foreground">
                No plan distribution available.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Subscription Events
          </p>

          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Latest Activity
          </h2>

          <div className="mt-6 space-y-3">
            {events.slice(0, 8).map(
              (event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-slate-100 bg-card p-4"
                >
                  <p className="text-sm font-semibold text-foreground">
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
              ),
            )}

            {!events.length && (
              <div className="rounded-2xl border border-slate-100 bg-card p-4 text-sm font-bold text-muted-foreground">
                No subscription events yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <PlanChangeDialog
        open={Boolean(planChange)}
        state={planChange}
        plans={plans}
        prices={prices}
        limits={limits}
        usage={usage}
        busy={changePlan.isPending}
        onClose={() =>
          setPlanChange(null)
        }
        onChange={(next) =>
          setPlanChange(next)
        }
        onConfirm={() => {
          if (planChange) {
            changePlan.mutate(
              planChange,
            );
          }
        }}
      />

      <Tenant360Drawer
        open={Boolean(selectedTenantId)}
        tenantId={selectedTenantId}
        onClose={() =>
          setSelectedTenantId(null)
        }
      />
    </PageContainer>
  );
}

function PlanChangeDialog({
  open,
  state,
  plans,
  prices,
  limits,
  usage,
  busy,
  onClose,
  onChange,
  onConfirm,
}: {
  open: boolean;
  state: PlanChangeState | null;
  plans: PlanCatalogRow[];
  prices: PlanPriceRow[];
  limits: PlanLimitRow[];
  usage: UsageMetricRow[];
  busy: boolean;
  onClose: () => void;
  onChange: (
    state: PlanChangeState,
  ) => void;
  onConfirm: () => void;
}) {
  if (!state) {
    return null;
  }

  const currentPlan = plans.find(
    (plan) =>
      normalizeStatus(plan.code) ===
      normalizeStatus(
        state.subscription.plan_code,
      ),
  );

  const nextPlan = plans.find(
    (plan) =>
      normalizeStatus(plan.code) ===
      normalizeStatus(
        state.nextPlanCode,
      ),
  );

  const currentPrice = getPlanPrice(
    state.subscription.plan_code,
    state.subscription.billing_cycle,
    prices,
    plans,
  );

  const nextPrice = getPlanPrice(
    state.nextPlanCode,
    state.nextBillingCycle,
    prices,
    plans,
  );

  const direction =
    planOrder(state.nextPlanCode) >
    planOrder(
      state.subscription.plan_code,
    )
      ? "upgrade"
      : planOrder(state.nextPlanCode) <
          planOrder(
            state.subscription.plan_code,
          )
        ? "downgrade"
        : "billing change";

  const capacityKeys = [
    {
      key: "users",
      label: "Users",
    },
    {
      key: "branches",
      label: "Branches",
    },
    {
      key: "products",
      label: "Products",
    },
    {
      key: "warehouses",
      label: "Warehouses",
    },
    {
      key: "pos_terminals",
      label: "POS terminals",
    },
    {
      key: "storage_gb",
      label: "Storage GB",
    },
  ];

  const tenantUsage = usage.filter(
    (metric) =>
      metric.tenant_id ===
      state.subscription.tenant_id,
  );

  const warnings = capacityKeys
    .map((capacity) => {
      const nextLimit = getLimitValue(
        nextPlan,
        limits,
        capacity.key,
      );

      const used = Number(
        tenantUsage.find(
          (metric) =>
            normalizeStatus(
              metric.metric_key,
            ) === capacity.key,
        )?.metric_value || 0,
      );

      if (
        nextLimit !== null &&
        used > nextLimit
      ) {
        return `${capacity.label}: ${used.toLocaleString()} currently used, but the selected plan allows ${nextLimit.toLocaleString()}.`;
      }

      return null;
    })
    .filter(Boolean) as string[];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) {
          onClose();
        }
      }}
    >
      <DialogContent className="z-[130] max-h-[92vh] max-w-5xl overflow-y-auto rounded-[28px] border-border p-0">
        <div className="border-b border-border bg-muted/40 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-foreground">
              <Edit3 className="h-5 w-5 text-violet-700" />
              Change subscription plan
            </DialogTitle>

            <DialogDescription className="pt-2 font-medium leading-6 text-muted-foreground">
              Review pricing, billing commitment,
              capacity and downgrade risk before
              changing{" "}
              {state.subscription.tenants?.name ||
                "this workspace"}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <PlanSummaryCard
              eyebrow="Current agreement"
              title={
                currentPlan?.name ||
                formatLabel(
                  state.subscription.plan_code,
                )
              }
              billingCycle={
                state.subscription.billing_cycle
              }
              effectiveMonthly={
                currentPrice.effectiveMonthly
              }
              total={currentPrice.total}
              currency={currentPrice.currency}
              tone="slate"
            />

            <PlanSummaryCard
              eyebrow={`Proposed ${direction}`}
              title={
                nextPlan?.name ||
                formatLabel(
                  state.nextPlanCode,
                )
              }
              billingCycle={
                state.nextBillingCycle
              }
              effectiveMonthly={
                nextPrice.effectiveMonthly
              }
              total={nextPrice.total}
              currency={nextPrice.currency}
              tone={
                direction === "upgrade"
                  ? "emerald"
                  : direction === "downgrade"
                    ? "orange"
                    : "violet"
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <Label className="text-xs font-semibold text-foreground">
                New plan
              </Label>

              <select
                value={state.nextPlanCode}
                onChange={(event) =>
                  onChange({
                    ...state,
                    nextPlanCode:
                      event.target.value,
                  })
                }
                className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-bold text-foreground outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              >
                {plans.map((plan) => (
                  <option
                    key={plan.code}
                    value={plan.code}
                  >
                    {plan.name ||
                      formatLabel(
                        plan.code,
                      )}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <Label className="text-xs font-semibold text-foreground">
                Billing cycle
              </Label>

              <select
                value={
                  state.nextBillingCycle
                }
                onChange={(event) =>
                  onChange({
                    ...state,
                    nextBillingCycle:
                      event.target
                        .value as PlanChangeState["nextBillingCycle"],
                  })
                }
                className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-bold text-foreground outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              >
                <option value="monthly">
                  Monthly
                </option>
                <option value="six_months">
                  6 months
                </option>
                <option value="annual">
                  12 months
                </option>
              </select>
            </label>
          </div>

          <div>
            <Label className="text-xs font-semibold text-foreground">
              Effective timing
            </Label>

            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    value: "immediate",
                    title: "Apply immediately",
                    description:
                      "Updates the plan and billing cycle now. Any financial adjustment should be handled through invoicing.",
                  },
                  {
                    value: "next_period",
                    title: "Next billing period",
                    description:
                      "Schedules the plan and billing-cycle change for the current period end without altering the active agreement today.",
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...state,
                      effectiveTiming:
                        option.value,
                    })
                  }
                  className={[
                    "rounded-2xl border p-4 text-left transition",
                    state.effectiveTiming ===
                    option.value
                      ? "border-violet-300 bg-violet-500/10 dark:bg-violet-950/35 ring-2 ring-violet-100"
                      : "border-border bg-card hover:bg-muted/40",
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {option.title}
                  </p>

                  <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {state.effectiveTiming ===
          "next_period" ? (
            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/10 dark:bg-violet-950/35 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">
                Scheduled effective date
              </p>

              <p className="mt-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
                {state.subscription.current_period_end
                  ? formatDateTime(
                      state.subscription.current_period_end,
                    )
                  : "Current period end is not configured"}
              </p>

              <p className="mt-1 text-xs font-medium leading-5 text-violet-700">
                The selected plan will remain pending until this date.
              </p>
            </div>
          ) : null}

          <div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Capacity comparison
              </p>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {capacityKeys.map(
                (capacity) => {
                  const currentLimit =
                    getLimitValue(
                      currentPlan,
                      limits,
                      capacity.key,
                    );

                  const nextLimit =
                    getLimitValue(
                      nextPlan,
                      limits,
                      capacity.key,
                    );

                  return (
                    <div
                      key={capacity.key}
                      className="rounded-xl border border-border bg-muted/40 p-4"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {capacity.label}
                      </p>

                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                        <span className="text-muted-foreground">
                          {currentLimit ===
                          null
                            ? "Unlimited"
                            : currentLimit.toLocaleString()}
                        </span>

                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />

                        <span
                          className={
                            nextLimit ===
                              null ||
                            (currentLimit !==
                              null &&
                              nextLimit >=
                                currentLimit)
                              ? "text-emerald-700"
                              : "text-orange-700"
                          }
                        >
                          {nextLimit === null
                            ? "Unlimited"
                            : nextLimit.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>

          {warnings.length ? (
            <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 dark:bg-orange-950/35 p-5">
              <div className="flex items-start gap-3">
                <TrendingDown className="mt-0.5 h-5 w-5 text-orange-700" />

                <div>
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                    Downgrade capacity review required
                  </p>

                  <div className="mt-2 space-y-1">
                    {warnings.map(
                      (warning) => (
                        <p
                          key={warning}
                          className="text-xs font-semibold leading-5 text-orange-700 dark:text-orange-300"
                        >
                          {warning}
                        </p>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 dark:bg-blue-950/35 p-4">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">
              Proration and billing note
            </p>

            <p className="mt-1 text-xs font-medium leading-5 text-primary dark:text-blue-300">
              Immediate changes update the active
              catalog assignment now. Next-period
              changes remain pending until the current
              billing period ends. Any prorated charge,
              credit, or balance adjustment should be
              generated through the subscription
              invoice workflow.
            </p>
          </div>

          <label>
            <Label className="text-xs font-semibold text-foreground">
              Administrative reason
            </Label>

            <Textarea
              value={state.reason}
              onChange={(event) =>
                onChange({
                  ...state,
                  reason:
                    event.target.value,
                })
              }
              placeholder="Explain why this plan or billing-cycle change is being applied."
              className="mt-2 min-h-28 rounded-xl"
            />
          </label>
        </div>

        <DialogFooter className="border-t border-border bg-muted/40 px-6 py-4">
          <Button
            variant="outline"
            className="rounded-xl font-semibold"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            className="rounded-xl bg-primary font-semibold hover:bg-primary/90"
            disabled={
              busy ||
              !state.reason.trim()
            }
            onClick={onConfirm}
          >
            {busy ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : direction === "upgrade" ? (
              <TrendingUp className="mr-2 h-4 w-4" />
            ) : direction ===
              "downgrade" ? (
              <TrendingDown className="mr-2 h-4 w-4" />
            ) : (
              <Edit3 className="mr-2 h-4 w-4" />
            )}

            {state.effectiveTiming ===
            "next_period"
              ? `Schedule ${direction}`
              : `Confirm ${direction}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanSummaryCard({
  eyebrow,
  title,
  billingCycle,
  effectiveMonthly,
  total,
  currency,
  tone,
}: {
  eyebrow: string;
  title: string;
  billingCycle: string;
  effectiveMonthly: number;
  total: number;
  currency: string;
  tone:
    | "slate"
    | "emerald"
    | "orange"
    | "violet";
}) {
  const toneClass = {
    slate:
      "border-border bg-muted/40",
    emerald:
      "border-emerald-500/25 bg-emerald-500/10 dark:bg-emerald-950/35",
    orange:
      "border-orange-500/25 bg-orange-500/10 dark:bg-orange-950/35",
    violet:
      "border-violet-500/25 bg-violet-500/10 dark:bg-violet-950/35",
  }[tone];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </p>

      <p className="mt-2 text-xl font-semibold text-foreground">
        {title}
      </p>

      <p className="mt-3 text-sm font-semibold text-foreground">
        {money(
          effectiveMonthly,
          currency,
        )}
        /month
      </p>

      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        {money(total, currency)} ·{" "}
        {formatLabel(billingCycle)}
      </p>
    </div>
  );
}

/* KpiCard now lives in components/PlatformKpiCard — one card style for the
   console and the workspace, instead of a private copy per page. */

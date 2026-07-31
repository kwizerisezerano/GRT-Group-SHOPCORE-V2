import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Landmark,
  Loader2,
  RefreshCw,
  RotateCcw,
  SearchX,
  ShieldCheck,
  Smartphone,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformSearchBar } from "@/pages/platform-admin/components/PlatformSearchBar";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import Tenant360Drawer from "@/pages/platform-admin/components/Tenant360Drawer";
import InvoicePreviewModal from "@/pages/platform-admin/components/InvoicePreviewModal";

type DecisionType =
  | "verify"
  | "reject"
  | "retry";

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type TenantSubscriptionRecord = {
  id?: string | null;
  plan_code?: string | null;
  billing_cycle?: string | null;
  status?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
};

type InvoiceRecord = {
  id: string;
  invoice_no: string | null;
  status: string;
  currency: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  due_date: string | null;
  paid_at: string | null;
  created_at: string | null;

  tenants?: {
    name?: string | null;
  } | null;

  tenant_subscriptions?:
    | TenantSubscriptionRecord
    | TenantSubscriptionRecord[]
    | null;

  invoice_items?: InvoiceItem[];
};

type PaymentAttempt = {
  id: string;
  tenant_id: string | null;
  invoice_id: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
  provider: string | null;
  provider_reference: string | null;
  status: string;
  failure_reason: string | null;
  attempted_at: string | null;
  verified_at: string | null;
  verified_by?: string | null;

  tenants?: {
    name?: string | null;
    workspace_status?: string | null;
    subscription_status?: string | null;
    payment_status?: string | null;
    subscription_plan?: string | null;
    billing_cycle?: string | null;
  } | null;

  subscription_invoices?: InvoiceRecord | null;
};

type DecisionState = {
  type: DecisionType;
  attempt: PaymentAttempt;
} | null;

const normalizeStatus = (
  value: string | null | undefined,
) => value?.trim().toLowerCase() || "unknown";

const formatStatus = (
  value: string | null | undefined,
) =>
  normalizeStatus(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );

const formatPlan = (
  value: string | null | undefined,
) =>
  normalizeStatus(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );

const formatBillingCycle = (
  value: string | null | undefined,
) => {
  switch (normalizeStatus(value)) {
    case "monthly":
      return "Monthly";

    case "six_months":
      return "6 months";

    case "annual":
      return "12 months";

    default:
      return "Not specified";
  }
};

const money = (
  amount?: number | null,
  currency = "RWF",
) =>
  new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: currency || "RWF",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  })
    .format(Number(amount || 0))
    .replace(/\s+/g, " ");

const formatDate = (
  value: string | null | undefined,
) => {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-RW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const csvEscape = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const isPaidStatus = (
  value: string | null | undefined,
) =>
  [
    "paid",
    "verified",
    "completed",
    "successful",
    "success",
  ].includes(normalizeStatus(value));

const isPendingStatus = (
  value: string | null | undefined,
) =>
  [
    "pending",
    "processing",
    "initiated",
    "submitted",
    "awaiting_verification",
  ].includes(normalizeStatus(value));

const isFailedStatus = (
  value: string | null | undefined,
) =>
  [
    "failed",
    "rejected",
    "declined",
    "expired",
    "cancelled",
    "canceled",
  ].includes(normalizeStatus(value));

const getSubscription = (
  invoice: InvoiceRecord | null | undefined,
): TenantSubscriptionRecord | null => {
  const relation = invoice?.tenant_subscriptions;

  if (!relation) {
    return null;
  }

  return Array.isArray(relation)
    ? relation[0] ?? null
    : relation;
};

const getPaymentMethodLabel = (
  value: string | null | undefined,
) => {
  switch (normalizeStatus(value)) {
    case "mobile_money":
      return "Mobile Money";

    case "bank_transfer":
      return "Bank transfer";

    case "card":
      return "Card payment";

    default:
      return formatStatus(value || "manual");
  }
};

const getProviderLabel = (
  value: string | null | undefined,
) => {
  switch (normalizeStatus(value)) {
    case "mtn_momo":
      return "MTN MoMo";

    case "airtel_money":
      return "Airtel Money";

    case "hosted_card_checkout":
      return "Hosted card checkout";

    case "manual_bank_transfer":
      return "Manual bank transfer";

    case "platform_admin":
      return "Platform Admin";

    default:
      return formatStatus(value || "platform");
  }
};

const getPaymentMethodIcon = (
  paymentMethod: string | null | undefined,
) => {
  switch (normalizeStatus(paymentMethod)) {
    case "mobile_money":
      return Smartphone;

    case "bank_transfer":
      return Landmark;

    case "card":
      return CreditCard;

    default:
      return WalletCards;
  }
};

const copyValue = async (
  value: string,
  label: string,
) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`${label} could not be copied.`);
  }
};



export default function PaymentAttempts() {
  const { t, formatDate } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [methodFilter, setMethodFilter] =
    useState("all");

  const [selectedTenantId, setSelectedTenantId] =
    useState<string | null>(null);

  const [selectedInvoice, setSelectedInvoice] =
    useState<InvoiceRecord | null>(null);

  const [decision, setDecision] =
    useState<DecisionState>(null);

  const [decisionNotes, setDecisionNotes] =
    useState("");

  const attemptsQuery = useQuery({
    queryKey: ["platform-payment-attempts"],
    queryFn: async (): Promise<PaymentAttempt[]> => {
      const { data, error } = await (
        supabase as any
      )
        .from("payment_attempts")
        .select(`
          id,
          tenant_id,
          invoice_id,
          amount,
          currency,
          payment_method,
          provider,
          provider_reference,
          status,
          failure_reason,
          attempted_at,
          verified_at,
          verified_by,
          tenants (
            name,
            workspace_status,
            subscription_status,
            payment_status,
            subscription_plan,
            billing_cycle
          ),
          subscription_invoices (
            id,
            invoice_no,
            status,
            currency,
            subtotal,
            tax_total,
            discount_total,
            total,
            due_date,
            paid_at,
            created_at,
            tenants (
              name
            ),
            tenant_subscriptions (
              id,
              plan_code,
              billing_cycle,
              status,
              current_period_start,
              current_period_end
            ),
            invoice_items (
              id,
              description,
              quantity,
              unit_price,
              total
            )
          )
        `)
        .order("attempted_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const refreshPlatformBilling = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [
          "platform-payment-attempts",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "platform-engine-invoices",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "platform-subscription-engine",
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

  const verifyAttempt = useMutation({
    mutationFn: async ({
      attempt,
      notes,
    }: {
      attempt: PaymentAttempt;
      notes: string;
    }) => {
      if (!attempt.invoice_id) {
        throw new Error(
          "This payment attempt is not linked to a subscription invoice.",
        );
      }

      if (
        isPaidStatus(attempt.status) ||
        isPaidStatus(
          attempt.subscription_invoices?.status,
        )
      ) {
        throw new Error(
          "This payment or invoice has already been verified.",
        );
      }

      const { error } = await (
        supabase as any
      ).rpc(
        "mark_subscription_invoice_paid",
        {
          p_invoice_id: attempt.invoice_id,
          p_payment_method:
            attempt.payment_method || "manual",
          p_provider:
            attempt.provider || "platform_admin",
          p_provider_reference:
            attempt.provider_reference ||
            `ATTEMPT-${attempt.id}`,
        },
      );

      if (error) {
        throw error;
      }

      /*
       * The existing payment-verification RPC controls invoice,
       * subscription, tenant, and workspace activation.
       *
       * We update the linked attempt after the trusted RPC
       * succeeds so the Platform Admin queue reflects the
       * verified state immediately.
       */
      const { error: attemptUpdateError } =
        await (supabase as any)
          .from("payment_attempts")
          .update({
            status: "paid",
            failure_reason: null,
            verified_at: new Date().toISOString(),
          })
          .eq("id", attempt.id);

      if (attemptUpdateError) {
        throw attemptUpdateError;
      }

      if (attempt.tenant_id) {
        const {
          data: {
            user: currentUser,
          },
        } = await supabase.auth.getUser();

        const { error: eventError } = await (
          supabase as any
        )
          .from("subscription_events")
          .insert({
            tenant_id: attempt.tenant_id,
            actor_id: currentUser?.id || null,
            event_type:
              "payment_attempt_verified",
            title:
              "Payment attempt verified",
            description:
              notes.trim() ||
              "Payment verified from the Platform Admin payment attempts center.",
            metadata: {
              payment_attempt_id: attempt.id,
              invoice_id: attempt.invoice_id,
              payment_method:
                attempt.payment_method,
              provider: attempt.provider,
              provider_reference:
                attempt.provider_reference,
              amount: attempt.amount,
              currency: attempt.currency,
            },
          });

        if (eventError) {
          console.warn(
            "Payment verification event could not be recorded:",
            eventError,
          );
        }
      }
    },

    onSuccess: async () => {
      toast.success(
        "Payment verified and workspace activation requested.",
      );

      setDecision(null);
      setDecisionNotes("");

      await refreshPlatformBilling();
    },

    onError: (error: any) => {
      toast.error(
        error?.message ||
          "Payment verification failed.",
      );
    },
  });

  const rejectAttempt = useMutation({
    mutationFn: async ({
      attempt,
      notes,
    }: {
      attempt: PaymentAttempt;
      notes: string;
    }) => {
      const reason = notes.trim();

      if (reason.length < 5) {
        throw new Error(
          "Enter a clear rejection reason.",
        );
      }

      if (isPaidStatus(attempt.status)) {
        throw new Error(
          "A verified payment attempt cannot be rejected.",
        );
      }

      const { error } = await (
        supabase as any
      )
        .from("payment_attempts")
        .update({
          status: "rejected",
          failure_reason: reason,
          verified_at: null,
          verified_by: null,
        })
        .eq("id", attempt.id);

      if (error) {
        throw error;
      }

      if (attempt.tenant_id) {
        const {
          data: {
            user: currentUser,
          },
        } = await supabase.auth.getUser();

        const { error: eventError } = await (
          supabase as any
        )
          .from("subscription_events")
          .insert({
            tenant_id: attempt.tenant_id,
            actor_id: currentUser?.id || null,
            event_type:
              "payment_attempt_rejected",
            title:
              "Payment attempt rejected",
            description: reason,
            metadata: {
              payment_attempt_id: attempt.id,
              invoice_id: attempt.invoice_id,
              payment_method:
                attempt.payment_method,
              provider: attempt.provider,
              provider_reference:
                attempt.provider_reference,
              amount: attempt.amount,
              currency: attempt.currency,
            },
          });

        if (eventError) {
          console.warn(
            "Payment rejection event could not be recorded:",
            eventError,
          );
        }
      }
    },

    onSuccess: async () => {
      toast.success(
        "Payment attempt rejected.",
      );

      setDecision(null);
      setDecisionNotes("");

      await refreshPlatformBilling();
    },

    onError: (error: any) => {
      toast.error(
        error?.message ||
          "Payment attempt could not be rejected.",
      );
    },
  });

  const retryAttempt = useMutation({
    mutationFn: async ({
      attempt,
      notes,
    }: {
      attempt: PaymentAttempt;
      notes: string;
    }) => {
      if (!isFailedStatus(attempt.status)) {
        throw new Error(
          "Only failed, rejected, declined, expired, cancelled, or canceled attempts may be retried.",
        );
      }

      if (!attempt.invoice_id) {
        throw new Error(
          "The failed payment is not linked to an invoice.",
        );
      }

      if (
        isPaidStatus(
          attempt.subscription_invoices?.status,
        )
      ) {
        throw new Error(
          "The linked invoice has already been paid.",
        );
      }

      const retryReference =
        `ADMIN-RETRY-${Date.now()}`;

      const { data, error } = await (
        supabase as any
      )
        .from("payment_attempts")
        .insert({
          tenant_id: attempt.tenant_id,
          invoice_id: attempt.invoice_id,
          amount: attempt.amount,
          currency:
            attempt.currency || "RWF",
          payment_method:
            attempt.payment_method || "manual",
          provider:
            attempt.provider ||
            "platform_admin",
          provider_reference:
            retryReference,
          status: "pending",
          failure_reason: null,
          attempted_at:
            new Date().toISOString(),
          verified_at: null,
          verified_by: null,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      if (attempt.tenant_id) {
        const {
          data: {
            user: currentUser,
          },
        } = await supabase.auth.getUser();

        const { error: eventError } = await (
          supabase as any
        )
          .from("subscription_events")
          .insert({
            tenant_id: attempt.tenant_id,
            actor_id: currentUser?.id || null,
            event_type:
              "payment_attempt_retried",
            title:
              "Payment retry created",
            description:
              notes.trim() ||
              "Platform Admin created a replacement payment attempt.",
            metadata: {
              previous_attempt_id:
                attempt.id,
              new_attempt_id: data?.id,
              invoice_id: attempt.invoice_id,
              provider_reference:
                retryReference,
              amount: attempt.amount,
              currency: attempt.currency,
            },
          });

        if (eventError) {
          console.warn(
            "Payment retry event could not be recorded:",
            eventError,
          );
        }
      }
    },

    onSuccess: async () => {
      toast.success(
        "Replacement payment attempt created.",
      );

      setDecision(null);
      setDecisionNotes("");

      await refreshPlatformBilling();
    },

    onError: (error: any) => {
      toast.error(
        error?.message ||
          "Replacement payment attempt could not be created.",
      );
    },
  });

  const attempts = attemptsQuery.data ?? [];

  const rows = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return attempts.filter((attempt) => {
      const matchesSearch =
        !query ||
        attempt.tenants?.name
          ?.toLowerCase()
          .includes(query) ||
        attempt.subscription_invoices?.invoice_no
          ?.toLowerCase()
          .includes(query) ||
        attempt.payment_method
          ?.toLowerCase()
          .includes(query) ||
        attempt.provider
          ?.toLowerCase()
          .includes(query) ||
        attempt.provider_reference
          ?.toLowerCase()
          .includes(query) ||
        attempt.status
          ?.toLowerCase()
          .includes(query) ||
        attempt.failure_reason
          ?.toLowerCase()
          .includes(query) ||
        getSubscription(
          attempt.subscription_invoices,
        )?.plan_code
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending"
          ? isPendingStatus(attempt.status)
          : statusFilter === "paid"
            ? isPaidStatus(attempt.status)
            : statusFilter === "failed"
              ? isFailedStatus(attempt.status)
              : normalizeStatus(
                  attempt.status,
                ) === statusFilter);

      const matchesMethod =
        methodFilter === "all" ||
        normalizeStatus(
          attempt.payment_method,
        ) === methodFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesMethod
      );
    });
  }, [
    attempts,
    methodFilter,
    search,
    statusFilter,
  ]);

  const statistics = useMemo(() => {
    const paid = attempts.filter((item) =>
      isPaidStatus(item.status),
    );

    const pending = attempts.filter((item) =>
      isPendingStatus(item.status),
    );

    const failed = attempts.filter((item) =>
      isFailedStatus(item.status),
    );

    const verifiedRevenue = paid.reduce(
      (sum, item) =>
        sum + Number(item.amount || 0),
      0,
    );

    const pendingValue = pending.reduce(
      (sum, item) =>
        sum + Number(item.amount || 0),
      0,
    );

    const successRate = attempts.length
      ? Math.round(
          (paid.length / attempts.length) *
            100,
        )
      : 0;

    return {
      total: attempts.length,
      paid: paid.length,
      pending: pending.length,
      failed: failed.length,
      verifiedRevenue,
      pendingValue,
      successRate,
    };
  }, [attempts]);

  const exportCsv = () => {
    const header = [
      "Workspace",
      "Plan",
      "Billing Cycle",
      "Invoice",
      "Invoice Status",
      "Amount",
      "Currency",
      "Method",
      "Provider",
      "Reference",
      "Attempt Status",
      "Failure Reason",
      "Workspace Status",
      "Subscription Status",
      "Payment Status",
      "Attempted At",
      "Verified At",
    ];

    const lines = rows.map((attempt) => {
      const subscription = getSubscription(
        attempt.subscription_invoices,
      );

      return [
        attempt.tenants?.name ||
          "Unknown workspace",
        subscription?.plan_code ||
          attempt.tenants
            ?.subscription_plan ||
          "",
        subscription?.billing_cycle ||
          attempt.tenants?.billing_cycle ||
          "",
        attempt.subscription_invoices
          ?.invoice_no || "Unlinked",
        attempt.subscription_invoices
          ?.status || "",
        attempt.amount,
        attempt.currency,
        attempt.payment_method || "manual",
        attempt.provider || "platform",
        attempt.provider_reference || "",
        attempt.status,
        attempt.failure_reason || "",
        attempt.tenants?.workspace_status ||
          "",
        attempt.tenants
          ?.subscription_status || "",
        attempt.tenants?.payment_status ||
          "",
        attempt.attempted_at || "",
        attempt.verified_at || "",
      ];
    });

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

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      `shopcore_payment_attempts_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    link.click();

    URL.revokeObjectURL(url);
  };

  const openDecision = (
    type: DecisionType,
    attempt: PaymentAttempt,
  ) => {
    setDecision({
      type,
      attempt,
    });

    setDecisionNotes(
      type === "verify"
        ? "Payment details reviewed and confirmed by Platform Administration."
        : "",
    );
  };

  const closeDecision = () => {
    if (
      verifyAttempt.isPending ||
      rejectAttempt.isPending ||
      retryAttempt.isPending
    ) {
      return;
    }

    setDecision(null);
    setDecisionNotes("");
  };

  const submitDecision = () => {
    if (!decision) {
      return;
    }

    const payload = {
      attempt: decision.attempt,
      notes: decisionNotes,
    };

    if (decision.type === "verify") {
      verifyAttempt.mutate(payload);
      return;
    }

    if (decision.type === "reject") {
      rejectAttempt.mutate(payload);
      return;
    }

    retryAttempt.mutate(payload);
  };

  const busy =
    verifyAttempt.isPending ||
    rejectAttempt.isPending ||
    retryAttempt.isPending;

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Billing Engine"
        title={t("platformAdmin.pages.paymentAttempts.title")}
        description={t("platformAdmin.pages.paymentAttempts.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl font-black"
              onClick={exportCsv}
              disabled={rows.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>

            <Button
              className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
              disabled={
                attemptsQuery.isFetching
              }
              onClick={() => {
                void attemptsQuery.refetch();
                toast.info(
                  "Refreshing payment attempts...",
                );
              }}
            >
              <RefreshCw
                className={[
                  "mr-2 h-4 w-4",
                  attemptsQuery.isFetching
                    ? "animate-spin"
                    : "",
                ].join(" ")}
              />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/35 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

            <div>
              <p className="text-sm font-black text-blue-950">
                Trusted payment verification
              </p>

              <p className="mt-1 text-xs font-medium leading-5 text-blue-800">
                Verification must remain restricted to Platform Administration,
                trusted payment-provider webhooks, Edge Functions, or service-role
                backend processes. Tenant users must never be allowed to approve
                their own payment attempts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            variant="outline"
            className="h-auto rounded-2xl px-5 py-4 font-black"
          >
            <Link to="/platform-admin/invoices">
              <FileText className="mr-2 h-5 w-5" />
              Subscription Invoices
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-auto rounded-2xl px-5 py-4 font-black"
          >
            <Link to="/platform-admin/subscriptions">
              <WalletCards className="mr-2 h-5 w-5" />
              Subscriptions
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <PlatformKpiCard
          icon={
            <WalletCards className="h-6 w-6" />
          }
          label="Attempts"
          value={statistics.total.toLocaleString()}
          tone="blue"
        />

        <PlatformKpiCard
          icon={
            <CheckCircle2 className="h-6 w-6" />
          }
          label="Verified"
          value={statistics.paid.toLocaleString()}
          tone="emerald"
        />

        <PlatformKpiCard
          icon={
            <Clock3 className="h-6 w-6" />
          }
          label="Pending"
          value={statistics.pending.toLocaleString()}
          tone="orange"
        />

        <PlatformKpiCard
          icon={
            <AlertCircle className="h-6 w-6" />
          }
          label="Failed"
          value={statistics.failed.toLocaleString()}
          tone="rose"
        />

        <PlatformKpiCard
          icon={
            <FileCheck2 className="h-6 w-6" />
          }
          label="Verified Revenue"
          value={money(
            statistics.verifiedRevenue,
          )}
          tone="violet"
        />

        <PlatformKpiCard
          icon={
            <CreditCard className="h-6 w-6" />
          }
          label="Pending Value"
          value={money(
            statistics.pendingValue,
          )}
          tone="orange"
        />

        <PlatformKpiCard
          icon={
            <ShieldCheck className="h-6 w-6" />
          }
          label="Success Rate"
          value={`${statistics.successRate}%`}
          tone="cyan"
        />
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 grid gap-3 xl:grid-cols-[1fr_220px_220px]">
          <PlatformSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search workspace, invoice, plan, provider, reference or status..."
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
            className="h-11 rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">
              All statuses
            </option>

            <option value="pending">
              Pending review
            </option>

            <option value="paid">
              Verified / paid
            </option>

            <option value="failed">
              Failed / rejected
            </option>

            <option value="processing">
              Processing
            </option>

            <option value="awaiting_verification">
              Awaiting verification
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="expired">
              Expired
            </option>

            <option value="cancelled">
              Cancelled
            </option>
          </select>

          <select
            value={methodFilter}
            onChange={(event) =>
              setMethodFilter(
                event.target.value,
              )
            }
            className="h-11 rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">
              All payment methods
            </option>

            <option value="mobile_money">
              Mobile Money
            </option>

            <option value="card">
              Card payment
            </option>

            <option value="bank_transfer">
              Bank transfer
            </option>
          </select>
        </div>

        {attemptsQuery.isLoading ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <Loader2 className="h-6 w-6 animate-spin text-blue-700" />

            <p className="ml-3 text-sm font-bold text-muted-foreground">
              Loading payment attempts...
            </p>
          </div>
        ) : attemptsQuery.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/35 p-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-700" />

            <p className="mt-4 text-sm font-black text-rose-950">
              Payment attempts could not be loaded.
            </p>

            <p className="mt-2 text-xs font-medium text-rose-700">
              {(attemptsQuery.error as any)
                ?.message ||
                "Verify Platform Admin permissions and database relationships."}
            </p>

            <Button
              variant="outline"
              className="mt-5 border-rose-300 bg-white font-black text-rose-700"
              onClick={() =>
                void attemptsQuery.refetch()
              }
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-muted/40 py-14 text-center">
            <SearchX className="mx-auto h-8 w-8 text-muted-foreground" />

            <p className="mt-4 text-sm font-black text-foreground">
              No payment attempts match the
              current filters.
            </p>

            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Clear the search or filters to
              review all payment activity.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[1780px] text-left text-sm">
              <thead className="bg-muted/40 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">
                    Workspace
                  </th>

                  <th className="px-4 py-3">
                    Plan
                  </th>

                  <th className="px-4 py-3">
                    Invoice
                  </th>

                  <th className="px-4 py-3">
                    Amount
                  </th>

                  <th className="px-4 py-3">
                    Payment route
                  </th>

                  <th className="px-4 py-3">
                    Reference
                  </th>

                  <th className="px-4 py-3">
                    Attempt status
                  </th>

                  <th className="px-4 py-3">
                    Workspace control
                  </th>

                  <th className="px-4 py-3">
                    Attempted
                  </th>

                  <th className="px-4 py-3">
                    Verified
                  </th>

                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((attempt) => {
                  const invoice =
                    attempt.subscription_invoices;

                  const subscription =
                    getSubscription(invoice);

                  const paid =
                    isPaidStatus(
                      attempt.status,
                    ) ||
                    isPaidStatus(
                      invoice?.status,
                    );

                  const failed =
                    isFailedStatus(
                      attempt.status,
                    );

                  const pending =
                    isPendingStatus(
                      attempt.status,
                    );

                  const PaymentIcon =
                    getPaymentMethodIcon(
                      attempt.payment_method,
                    );

                  return (
                    <tr
                      key={attempt.id}
                      className="border-t border-border align-top transition hover:bg-muted/40/70"
                    >
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="text-left"
                          disabled={
                            !attempt.tenant_id
                          }
                          onClick={() =>
                            setSelectedTenantId(
                              attempt.tenant_id,
                            )
                          }
                        >
                          <p className="font-black text-blue-700 transition hover:text-blue-900">
                            {attempt.tenants
                              ?.name ||
                              "Unknown workspace"}
                          </p>

                          <p className="mt-1 max-w-[180px] truncate text-[11px] font-medium text-muted-foreground">
                            {attempt.tenant_id ||
                              "No tenant"}
                          </p>
                        </button>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-black text-slate-850">
                          {formatPlan(
                            subscription?.plan_code ||
                              attempt.tenants
                                ?.subscription_plan ||
                              "Not specified",
                          )}
                        </p>

                        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <CalendarRange className="h-3.5 w-3.5" />

                          {formatBillingCycle(
                            subscription?.billing_cycle ||
                              attempt.tenants
                                ?.billing_cycle,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="text-left"
                          disabled={!invoice}
                          onClick={() =>
                            setSelectedInvoice(
                              invoice || null,
                            )
                          }
                        >
                          <p className="font-black text-foreground hover:text-blue-700">
                            {invoice?.invoice_no ||
                              "Unlinked"}
                          </p>

                          <div className="mt-1">
                            <PlatformStatusBadge
                              status={
                                invoice?.status ||
                                "unlinked"
                              }
                            />
                          </div>
                        </button>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-black text-foreground">
                          {money(
                            attempt.amount,
                            attempt.currency,
                          )}
                        </p>

                        {invoice &&
                        Number(invoice.total) !==
                          Number(
                            attempt.amount,
                          ) ? (
                          <p className="mt-1 text-[11px] font-bold text-orange-600">
                            Invoice:{" "}
                            {money(
                              invoice.total,
                              invoice.currency,
                            )}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
                            <PaymentIcon className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="font-black text-foreground">
                              {getPaymentMethodLabel(
                                attempt.payment_method,
                              )}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                              {getProviderLabel(
                                attempt.provider,
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {attempt.provider_reference ? (
                          <button
                            type="button"
                            onClick={() =>
                              void copyValue(
                                attempt.provider_reference!,
                                "Payment reference",
                              )
                            }
                            className="group flex max-w-[210px] items-center gap-2 text-left"
                          >
                            <p
                              className="truncate font-bold text-muted-foreground group-hover:text-blue-700"
                              title={
                                attempt.provider_reference
                              }
                            >
                              {
                                attempt.provider_reference
                              }
                            </p>

                            <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-blue-700" />
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">
                            No reference
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <PlatformStatusBadge
                          status={attempt.status}
                        />

                        {attempt.failure_reason ? (
                          <p className="mt-2 max-w-[230px] text-xs font-bold leading-5 text-rose-600">
                            {
                              attempt.failure_reason
                            }
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                              Workspace
                            </p>

                            <PlatformStatusBadge
                              status={
                                attempt.tenants
                                  ?.workspace_status ||
                                "unknown"
                              }
                            />
                          </div>

                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                              Subscription
                            </p>

                            <PlatformStatusBadge
                              status={
                                subscription?.status ||
                                attempt.tenants
                                  ?.subscription_status ||
                                "unknown"
                              }
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">
                          {formatDate(
                            attempt.attempted_at,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <p
                          className={[
                            "font-semibold",
                            attempt.verified_at
                              ? "text-emerald-700"
                              : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {attempt.verified_at
                            ? formatDate(
                                attempt.verified_at,
                              )
                            : "Not verified"}
                        </p>

                        {attempt.verified_by ? (
                          <p
                            className="mt-1 max-w-[180px] truncate text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground"
                            title={attempt.verified_by}
                          >
                            By {attempt.verified_by}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            title="Preview invoice"
                            disabled={!invoice}
                            onClick={() =>
                              setSelectedInvoice(
                                invoice || null,
                              )
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            className="rounded-xl bg-emerald-600 font-black hover:bg-emerald-700"
                            disabled={
                              busy ||
                              paid ||
                              failed ||
                              !pending ||
                              !attempt.invoice_id
                            }
                            onClick={() =>
                              openDecision(
                                "verify",
                                attempt,
                              )
                            }
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />

                            {paid
                              ? "Verified"
                              : "Verify"}
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-xl border-rose-200 bg-rose-50 dark:bg-rose-950/35 font-black text-rose-700 hover:bg-rose-100"
                            disabled={
                              busy ||
                              paid ||
                              failed
                            }
                            onClick={() =>
                              openDecision(
                                "reject",
                                attempt,
                              )
                            }
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-xl border-blue-200 bg-blue-50 dark:bg-blue-950/35 font-black text-blue-700 hover:bg-blue-100"
                            disabled={
                              busy || !failed
                            }
                            onClick={() =>
                              openDecision(
                                "retry",
                                attempt,
                              )
                            }
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Retry
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

      <InvoicePreviewModal
        open={Boolean(selectedInvoice)}
        invoice={selectedInvoice}
        onClose={() =>
          setSelectedInvoice(null)
        }
      />

      <Tenant360Drawer
        open={Boolean(selectedTenantId)}
        tenantId={selectedTenantId}
        onClose={() =>
          setSelectedTenantId(null)
        }
      />

      <Dialog
        open={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open) {
            closeDecision();
          }
        }}
      >
        <DialogContent className="z-[120] max-w-xl overflow-hidden rounded-[24px] border-border p-0">
          {decision ? (
            <>
              <div
                className={[
                  "border-b px-6 py-5",
                  decision.type === "verify"
                    ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/35"
                    : decision.type === "reject"
                      ? "border-rose-200 bg-rose-50 dark:bg-rose-950/35"
                      : "border-blue-200 bg-blue-50 dark:bg-blue-950/35",
                ].join(" ")}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-xl font-black text-foreground">
                    {decision.type ===
                    "verify" ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                    ) : decision.type ===
                      "reject" ? (
                      <XCircle className="h-6 w-6 text-rose-700" />
                    ) : (
                      <RotateCcw className="h-6 w-6 text-blue-700" />
                    )}

                    {decision.type === "verify"
                      ? "Verify payment"
                      : decision.type ===
                          "reject"
                        ? "Reject payment attempt"
                        : "Create retry attempt"}
                  </DialogTitle>

                  <DialogDescription className="pt-2 font-medium leading-6 text-muted-foreground">
                    {decision.type === "verify"
                      ? "This trusted action may mark the invoice paid, activate the subscription, and release the tenant workspace."
                      : decision.type === "reject"
                        ? "The customer will be able to submit another attempt after this request is rejected."
                        : "A new pending attempt will be created from the failed payment record."}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="space-y-5 px-6 py-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DecisionSummary
                    label="Workspace"
                    value={
                      decision.attempt.tenants
                        ?.name ||
                      "Unknown workspace"
                    }
                  />

                  <DecisionSummary
                    label="Invoice"
                    value={
                      decision.attempt
                        .subscription_invoices
                        ?.invoice_no ||
                      "Unlinked"
                    }
                  />

                  <DecisionSummary
                    label="Amount"
                    value={money(
                      decision.attempt.amount,
                      decision.attempt.currency,
                    )}
                  />

                  <DecisionSummary
                    label="Payment route"
                    value={`${getPaymentMethodLabel(
                      decision.attempt
                        .payment_method,
                    )} · ${getProviderLabel(
                      decision.attempt.provider,
                    )}`}
                  />
                </div>

                <div>
                  <Label
                    htmlFor="payment-decision-notes"
                    className="text-xs font-black text-foreground"
                  >
                    {decision.type === "reject"
                      ? "Rejection reason"
                      : decision.type === "retry"
                        ? "Retry notes"
                        : "Verification notes"}
                  </Label>

                  <textarea
                    id="payment-decision-notes"
                    value={decisionNotes}
                    onChange={(event) =>
                      setDecisionNotes(
                        event.target.value,
                      )
                    }
                    rows={4}
                    placeholder={
                      decision.type === "reject"
                        ? "Explain why the payment attempt is being rejected..."
                        : decision.type === "retry"
                          ? "Record why a replacement attempt is being created..."
                          : "Record the verification basis, payment evidence, or administrative note..."
                    }
                    className="mt-2 w-full resize-none rounded-xl border border-border bg-muted/40 px-3 py-3 text-sm font-medium text-foreground outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {decision.type === "verify" ? (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/35 p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" />

                      <p className="text-xs font-semibold leading-5 text-orange-800">
                        Confirm the provider reference,
                        amount, invoice, and actual receipt
                        of funds before approving this
                        payment.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="border-t border-border bg-muted/40 px-6 py-4">
                <Button
                  variant="outline"
                  className="rounded-xl font-black"
                  disabled={busy}
                  onClick={closeDecision}
                >
                  Cancel
                </Button>

                <Button
                  className={[
                    "rounded-xl font-black",
                    decision.type === "verify"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : decision.type === "reject"
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-blue-600 hover:bg-blue-700",
                  ].join(" ")}
                  disabled={
                    busy ||
                    (decision.type ===
                      "reject" &&
                      decisionNotes.trim()
                        .length < 5)
                  }
                  onClick={submitDecision}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : decision.type ===
                    "verify" ? (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  ) : decision.type ===
                    "reject" ? (
                    <XCircle className="mr-2 h-4 w-4" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}

                  {busy
                    ? "Processing..."
                    : decision.type ===
                        "verify"
                      ? "Confirm payment"
                      : decision.type ===
                          "reject"
                        ? "Reject attempt"
                        : "Create retry"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DecisionSummary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 text-sm font-black text-slate-850">
        {value}
      </p>
    </div>
  );
}
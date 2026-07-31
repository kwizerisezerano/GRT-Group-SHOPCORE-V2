import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  FileCheck2,
  Globe2,
  KeyRound,
  Landmark,
  Layers3,
  Loader2,
  Mail,
  Phone,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import OnboardingWorkspaceShell from "@/components/onboarding/OnboardingWorkspaceShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type PaymentMethod =
  | "mobile_money"
  | "card"
  | "bank_transfer";

type MobileMoneyNetwork =
  | "mtn_momo"
  | "airtel_money";

type TenantPaymentView = {
  id: string;
  name: string;
  subscription_plan: string | null;
  subscription_status: string | null;
  payment_status: string | null;
  workspace_status: string | null;
  trial_status: string | null;
  trial_ends_at: string | null;
  onboarding_completed: boolean | null;
  billing_cycle: string | null;
  next_billing_date: string | null;
  renewal_date: string | null;
};

type TenantSubscription = {
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
};

type SubscriptionPlanView = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  short_description: string | null;
  currency: string;
  monthly_price: number | null;
  six_month_price: number | null;
  yearly_price: number | null;
  six_month_discount: number | null;
  yearly_discount: number | null;
  badge_text: string | null;
};

type SubscriptionInvoice = {
  id: string;
  tenant_id?: string | null;
  subscription_id?: string | null;
  invoice_no: string | null;
  status: string | null;
  currency: string | null;
  subtotal: number | null;
  tax_total: number | null;
  discount_total: number | null;
  total: number | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string | null;
};

type PaymentAttempt = {
  id: string;
  tenant_id?: string | null;
  invoice_id: string | null;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  provider: string | null;
  provider_reference: string | null;
  status: string | null;
  failure_reason: string | null;
  attempted_at: string | null;
  verified_at: string | null;
  verified_by?: string | null;
};

type PaymentWorkspaceResponse = {
  tenant: TenantPaymentView | null;
  subscription: TenantSubscription | null;
  plan: SubscriptionPlanView | null;
  invoice: SubscriptionInvoice | null;
  invoice_items: InvoiceItem[];
  latest_attempt: PaymentAttempt | null;
};

type RouteState = {
  fromSignup?: boolean;
  selectedPlan?: string;
  selectedPlanName?: string;
  selectedBillingCycle?: string;
  selectedPrice?: number;
  selectedCurrency?: string;
  paymentMethod?: PaymentMethod;
};

const PAYMENT_TENANT_KEY =
  "shopcore_pending_payment_tenant_id";

const PAYMENT_ROUTE_KEY =
  "shopcore_pending_payment_route";

const PAYMENT_PLAN_KEY =
  "shopcore_pending_payment_plan";

const PAYMENT_BILLING_KEY =
  "shopcore_pending_payment_billing_cycle";

const PAYMENT_METHOD_KEY =
  "shopcore_pending_payment_method";

const bankDetails = {
  bankName: "ShopCore Settlement Account",
  accountName: "ShopCore Technologies",
  accountNumber: "Available from ShopCore Finance",
  currency: "RWF",
  branch: "Kigali, Rwanda",
};

const methodOptions: Array<{
  id: PaymentMethod;
  title: string;
  description: string;
  icon: typeof Smartphone;
  selectedClass: string;
  iconClass: string;
}> = [
  {
    id: "mobile_money",
    title: "Mobile Money",
    description:
      "Create an MTN MoMo or Airtel Money payment request linked to the invoice.",
    icon: Smartphone,
    selectedClass:
      "border-blue-300 bg-blue-50 ring-4 ring-blue-100",
    iconClass:
      "border-blue-200 bg-white text-blue-700",
  },
  {
    id: "card",
    title: "Card payment",
    description:
      "Prepare secure hosted checkout for an approved card-payment provider.",
    icon: CreditCard,
    selectedClass:
      "border-violet-300 bg-violet-50 ring-4 ring-violet-100",
    iconClass:
      "border-violet-200 bg-white text-violet-700",
  },
  {
    id: "bank_transfer",
    title: "Bank transfer",
    description:
      "Submit a bank transaction reference for authorized verification.",
    icon: Landmark,
    selectedClass:
      "border-emerald-300 bg-emerald-50 ring-4 ring-emerald-100",
    iconClass:
      "border-emerald-200 bg-white text-emerald-700",
  },
];

const normalizeStatus = (
  value: string | null | undefined,
) => value?.trim().toLowerCase() || "pending";

const formatStatus = (
  value: string | null | undefined,
) =>
  normalizeStatus(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );

const formatPlanCode = (
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

const formatMoney = (
  amount: number | null | undefined,
  currency: string | null | undefined,
) => {
  if (amount === null || amount === undefined) {
    return "Pending confirmation";
  }

  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: currency || "RWF",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  })
    .format(Number(amount))
    .replace(/\s+/g, " ");
};

const formatDate = (
  value: string | null | undefined,
  includeTime = true,
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
    ...(includeTime
      ? { timeStyle: "short" as const }
      : {}),
  }).format(date);
};

const isPaidStatus = (
  value: string | null | undefined,
) =>
  [
    "paid",
    "confirmed",
    "completed",
    "verified",
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
    "cancelled",
    "declined",
    "expired",
    "rejected",
  ].includes(normalizeStatus(value));

const copyText = async (
  value: string,
  successMessage: string,
) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("The value could not be copied.");
  }
};

export default function Payment() {
  const { tenantId: routeTenantId } =
    useParams<{ tenantId: string }>();

  const location = useLocation();
  const routeState = (location.state ?? {}) as RouteState;

  const {
    user,
    loading: authLoading,
    bootstrapping,
    tenantId: authenticatedTenantId,
    refreshTenant,
    isWorkspaceActive,
    workspaceAccessStatus,
  } = useAuth();

  const recoveredTenantId =
    routeTenantId?.trim() ||
    authenticatedTenantId ||
    sessionStorage.getItem(PAYMENT_TENANT_KEY);

  const recoveredPaymentMethod =
    sessionStorage.getItem(PAYMENT_METHOD_KEY);

  const initialPaymentMethod: PaymentMethod =
    routeState.paymentMethod ||
    (recoveredPaymentMethod === "card" ||
    recoveredPaymentMethod === "bank_transfer" ||
    recoveredPaymentMethod === "mobile_money"
      ? recoveredPaymentMethod
      : "mobile_money");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);

  const [tenant, setTenant] =
    useState<TenantPaymentView | null>(null);

  const [subscription, setSubscription] =
    useState<TenantSubscription | null>(null);

  const [plan, setPlan] =
    useState<SubscriptionPlanView | null>(null);

  const [invoice, setInvoice] =
    useState<SubscriptionInvoice | null>(null);

  const [invoiceItems, setInvoiceItems] =
    useState<InvoiceItem[]>([]);

  const [latestAttempt, setLatestAttempt] =
    useState<PaymentAttempt | null>(null);

  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethod>(initialPaymentMethod);

  const [mobileNetwork, setMobileNetwork] =
    useState<MobileMoneyNetwork>("mtn_momo");

  const [mobilePhone, setMobilePhone] =
    useState("");

  const [cardholderName, setCardholderName] =
    useState("");

  const [cardEmail, setCardEmail] = useState(
    user?.email || "",
  );

  const [cardConsent, setCardConsent] =
    useState(false);

  const [bankReference, setBankReference] =
    useState("");

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const invoicePaid =
    isPaidStatus(invoice?.status) ||
    isPaidStatus(latestAttempt?.status) ||
    isPaidStatus(tenant?.payment_status);

  const attemptPending =
    Boolean(latestAttempt) &&
    isPendingStatus(latestAttempt?.status);

  const attemptFailed =
    Boolean(latestAttempt) &&
    isFailedStatus(latestAttempt?.status);

  const payableAmount = useMemo(
    () =>
      formatMoney(
        invoice?.total,
        invoice?.currency || plan?.currency || "RWF",
      ),
    [
      invoice?.currency,
      invoice?.total,
      plan?.currency,
    ],
  );

  const packageName =
    plan?.name ||
    routeState.selectedPlanName ||
    formatPlanCode(
      subscription?.plan_code ||
        tenant?.subscription_plan ||
        routeState.selectedPlan ||
        sessionStorage.getItem(PAYMENT_PLAN_KEY),
    );

  const billingCycle =
    subscription?.billing_cycle ||
    tenant?.billing_cycle ||
    routeState.selectedBillingCycle ||
    sessionStorage.getItem(PAYMENT_BILLING_KEY);

  const subscriptionPeriod = useMemo(() => {
    if (
      !subscription?.current_period_start ||
      !subscription?.current_period_end
    ) {
      return "Pending activation";
    }

    return `${formatDate(
      subscription.current_period_start,
      false,
    )} — ${formatDate(
      subscription.current_period_end,
      false,
    )}`;
  }, [
    subscription?.current_period_end,
    subscription?.current_period_start,
  ]);

  const discountAmount = Math.max(
    Number(invoice?.discount_total || 0),
    0,
  );

  const hasDiscount = discountAmount > 0;

  const loadPaymentWorkspace = useCallback(
    async (showToast = false) => {
      if (!recoveredTenantId) {
        setLoadError(
          "No workspace identifier was supplied for this payment session.",
        );
        setLoading(false);
        return;
      }

      setLoadError(null);

      if (showToast) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const { data, error } = await (
          supabase as any
        ).rpc(
          "get_my_subscription_payment_workspace",
          {
            p_tenant_id: recoveredTenantId,
          },
        );

        if (error) {
          throw error;
        }

        const result =
          (data ?? {}) as PaymentWorkspaceResponse;

        if (!result.tenant) {
          throw new Error(
            "The payment workspace was not found or your account is not authorized to access it.",
          );
        }

        setTenant(result.tenant);
        setSubscription(
          result.subscription ?? null,
        );
        setPlan(result.plan ?? null);
        setInvoice(result.invoice ?? null);
        setInvoiceItems(
          Array.isArray(result.invoice_items)
            ? result.invoice_items
            : [],
        );
        setLatestAttempt(
          result.latest_attempt ?? null,
        );

        const storedMethod =
          result.latest_attempt?.payment_method;

        if (
          storedMethod === "mobile_money" ||
          storedMethod === "card" ||
          storedMethod === "bank_transfer"
        ) {
          setSelectedMethod(storedMethod);
        }

        setCardEmail((current) =>
          current || user?.email || "",
        );

        sessionStorage.setItem(
          PAYMENT_TENANT_KEY,
          recoveredTenantId,
        );

        sessionStorage.setItem(
          PAYMENT_ROUTE_KEY,
          `/onboarding/payment/${recoveredTenantId}`,
        );

        if (result.subscription?.plan_code) {
          sessionStorage.setItem(
            PAYMENT_PLAN_KEY,
            result.subscription.plan_code,
          );
        }

        if (result.subscription?.billing_cycle) {
          sessionStorage.setItem(
            PAYMENT_BILLING_KEY,
            result.subscription.billing_cycle,
          );
        }

        if (storedMethod) {
          sessionStorage.setItem(
            PAYMENT_METHOD_KEY,
            storedMethod,
          );
        }

        if (showToast) {
          toast.success(
            "Payment and activation status refreshed.",
          );
        }
      } catch (error: any) {
        console.error(
          "Payment workspace load failed:",
          error,
        );

        const message =
          error?.message ||
          "Failed to load the payment workspace.";

        setLoadError(message);

        if (showToast) {
          toast.error(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [recoveredTenantId, user?.email],
  );

  useEffect(() => {
    if (authLoading || bootstrapping || !user) {
      return;
    }

    void loadPaymentWorkspace();
  }, [
    authLoading,
    bootstrapping,
    loadPaymentWorkspace,
    user,
  ]);

  useEffect(() => {
    if (!recoveredTenantId) {
      return;
    }

    sessionStorage.setItem(
      PAYMENT_TENANT_KEY,
      recoveredTenantId,
    );

    sessionStorage.setItem(
      PAYMENT_ROUTE_KEY,
      `/onboarding/payment/${recoveredTenantId}`,
    );
  }, [recoveredTenantId]);

  useEffect(() => {
    sessionStorage.setItem(
      PAYMENT_METHOD_KEY,
      selectedMethod,
    );
  }, [selectedMethod]);

  useEffect(() => {
    if (!invoicePaid) {
      return;
    }

    void refreshTenant();
  }, [invoicePaid, refreshTenant]);

  useEffect(() => {
    if (
      !attemptPending ||
      invoicePaid ||
      !user ||
      !recoveredTenantId
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadPaymentWorkspace();
      void refreshTenant();
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    attemptPending,
    invoicePaid,
    loadPaymentWorkspace,
    recoveredTenantId,
    refreshTenant,
    user,
  ]);

  const handleRefresh = async () => {
    await loadPaymentWorkspace(true);
    await refreshTenant();
  };

  const validatePaymentRequest = () => {
    if (!recoveredTenantId) {
      return "The workspace identifier is missing.";
    }

    if (!invoice?.id) {
      return "No payable subscription invoice was found.";
    }

    if (
      normalizeStatus(invoice.status) !== "issued"
    ) {
      return invoicePaid
        ? "This subscription invoice is already paid."
        : "This invoice is not currently available for payment.";
    }

    if (invoicePaid) {
      return "This subscription invoice is already paid.";
    }

    if (attemptPending) {
      return "A payment attempt is already awaiting processing or verification.";
    }

    if (selectedMethod === "mobile_money") {
      const normalizedPhone =
        mobilePhone.replace(/\s+/g, "");

      if (normalizedPhone.length < 9) {
        return "Enter a valid Mobile Money telephone number.";
      }
    }

    if (selectedMethod === "card") {
      if (!cardholderName.trim()) {
        return "Enter the cardholder name.";
      }

      if (
        !cardEmail.trim() ||
        !cardEmail.includes("@")
      ) {
        return "Enter a valid billing email address.";
      }

      if (!cardConsent) {
        return "Confirm the secure hosted-checkout authorization before continuing.";
      }
    }

    if (
      selectedMethod === "bank_transfer" &&
      bankReference.trim().length < 4
    ) {
      return "Enter the bank transaction reference.";
    }

    return null;
  };

  const buildProvider = () => {
    if (selectedMethod === "mobile_money") {
      return mobileNetwork;
    }

    if (selectedMethod === "card") {
      return "hosted_card_checkout";
    }

    return "manual_bank_transfer";
  };

  const buildProviderReference = () => {
    if (selectedMethod === "mobile_money") {
      const normalizedPhone =
        mobilePhone.replace(/\s+/g, "");

      return `${mobileNetwork.toUpperCase()}-${normalizedPhone}`;
    }

    if (selectedMethod === "card") {
      return `CARD-CHECKOUT-${Date.now()}`;
    }

    return bankReference.trim();
  };

  const submitPaymentAttempt = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const validationError =
      validatePaymentRequest();

    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const { data: attemptId, error } = await (
        supabase as any
      ).rpc(
        "create_my_subscription_payment_attempt",
        {
          p_tenant_id: recoveredTenantId,
          p_invoice_id: invoice!.id,
          p_payment_method: selectedMethod,
          p_provider: buildProvider(),
          p_provider_reference:
            buildProviderReference(),
        },
      );

      if (error) {
        throw error;
      }

      toast.success(
        selectedMethod === "bank_transfer"
          ? "Bank transfer submitted for verification."
          : selectedMethod === "mobile_money"
            ? "Mobile Money payment request created."
            : "Hosted card checkout request prepared.",
      );

      await loadPaymentWorkspace();

      if (selectedMethod === "mobile_money") {
        toast.info(
          "The payment request is recorded. Customer approval and automatic confirmation will be enabled when the Mobile Money gateway is connected.",
          {
            duration: 9000,
          },
        );
      }

      if (selectedMethod === "card") {
        toast.info(
          "The checkout request is recorded. The next integration will redirect card payments through a secure hosted provider page.",
          {
            duration: 9000,
          },
        );
      }

      console.info(
        "Created subscription payment attempt:",
        attemptId,
      );
    } catch (error: any) {
      console.error(
        "Subscription payment attempt failed:",
        error,
      );

      toast.error(
        error?.message ||
          "The payment attempt could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const paymentProgressSteps = [
    {
      label: "Workspace created",
      complete: Boolean(tenant?.id),
    },
    {
      label: "Package selected",
      complete: Boolean(
        plan?.code ||
          subscription?.plan_code ||
          tenant?.subscription_plan,
      ),
    },
    {
      label: "Invoice issued",
      complete: Boolean(invoice?.id),
    },
    {
      label: "Payment submitted",
      complete: Boolean(latestAttempt?.id),
    },
    {
      label: "Payment verified",
      complete: invoicePaid,
    },
  ];

  if (authLoading || bootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#cfd5db] px-4">
        <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-700" />

          <h1 className="mt-5 text-lg font-black text-slate-950">
            Preparing payment workspace
          </h1>

          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            Verifying your account, subscription invoice,
            and workspace activation state.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{
          continueOnboarding: true,
          paymentTenantId: recoveredTenantId,
          returnTo: recoveredTenantId
            ? `/onboarding/payment/${recoveredTenantId}`
            : "/activation",
        }}
      />
    );
  }

  if (isWorkspaceActive) {
    sessionStorage.removeItem(
      PAYMENT_TENANT_KEY,
    );
    sessionStorage.removeItem(
      PAYMENT_ROUTE_KEY,
    );
    sessionStorage.removeItem(
      PAYMENT_PLAN_KEY,
    );
    sessionStorage.removeItem(
      PAYMENT_BILLING_KEY,
    );
    sessionStorage.removeItem(
      PAYMENT_METHOD_KEY,
    );

    return <Navigate to="/dashboard" replace />;
  }

  if (!recoveredTenantId) {
    return <Navigate to="/activation" replace />;
  }

  if (!routeTenantId && recoveredTenantId) {
    return (
      <Navigate
        to={`/onboarding/payment/${recoveredTenantId}`}
        replace
      />
    );
  }

  return (
    <OnboardingWorkspaceShell
      mode="payment"
      homePath="/activation"
      headerLabel="Secure payment workspace"
      tenantName={tenant?.name}
      subscriptionPlan={packageName}
      billingCycle={formatBillingCycle(billingCycle)}
      workspaceAccessStatus={workspaceAccessStatus}
      progressSteps={paymentProgressSteps}
      sidebarEyebrow="Subscription activation"
      sidebarTitle="Complete the subscription payment for your business workspace."
      sidebarDescription="Operational access remains controlled until the linked subscription invoice is confirmed by a trusted payment process."
      summaryItems={[
        {
          icon: ReceiptText,
          label: "Subscription invoice",
          value:
            invoice?.invoice_no ||
            "Invoice preparation pending",
        },
        {
          icon: CreditCard,
          label: "Amount payable",
          value: payableAmount,
        },
        {
          icon: Landmark,
          label: "Payment route",
          value:
            selectedMethod === "mobile_money"
              ? "Mobile Money"
              : selectedMethod === "card"
                ? "Hosted card checkout"
                : "Bank transfer",
        },
        {
          icon: ShieldCheck,
          label: "Workspace access",
          value: formatStatus(
            workspaceAccessStatus,
          ),
        },
      ]}
      sidebarFooter={
        latestAttempt ? (
          <div className="rounded-2xl border border-white/10 bg-white p-5 text-slate-950">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Latest payment attempt
            </p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">
                  {formatStatus(
                    latestAttempt.status,
                  )}
                </p>

                <p className="mt-1 text-xs font-medium text-slate-500">
                  {formatDate(
                    latestAttempt.attempted_at,
                  )}
                </p>
              </div>

              <AttemptStatus
                status={
                  latestAttempt.status ||
                  "pending"
                }
              />
            </div>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
            Payment activation
          </p>

          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Complete your workspace payment
          </h2>

          <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-500">
            Review the issued subscription
            invoice, select a payment method, and
            create a controlled payment attempt.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void handleRefresh()
          }
          disabled={refreshing}
          className="shrink-0 rounded-xl font-black"
        >
          <RefreshCw
            className={[
              "mr-2 h-4 w-4",
              refreshing
                ? "animate-spin"
                : "",
            ].join(" ")}
          />
          Refresh
        </Button>
      </div>

      {loadError ? (
        <div className="mt-7 rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />

            <div>
              <p className="text-sm font-black text-rose-950">
                Payment workspace unavailable
              </p>

              <p className="mt-1 text-xs font-medium leading-5 text-rose-800">
                {loadError}
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-4 border-rose-300 bg-white text-rose-700 hover:bg-rose-100"
                onClick={() =>
                  void handleRefresh()
                }
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-blue-700" />

            <div>
              <h3 className="text-sm font-black text-slate-950">
                Subscription invoice
              </h3>

              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Commercial edition and payable
                billing commitment
              </p>
            </div>
          </div>

          {invoice ? (
            <InvoiceStatus
              status={
                invoice.status || "issued"
              }
            />
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-40 items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-blue-700" />

            <p className="ml-3 text-sm font-bold text-slate-500">
              Loading invoice details...
            </p>
          </div>
        ) : invoice ? (
          <>
            <div className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryItem
                label="Invoice"
                value={
                  invoice.invoice_no ||
                  "Pending number"
                }
              />

              <SummaryItem
                label="Commercial edition"
                value={packageName}
              />

              <SummaryItem
                label="Billing cycle"
                value={formatBillingCycle(
                  billingCycle,
                )}
              />

              <SummaryItem
                label="Amount due"
                value={payableAmount}
              />
            </div>

            <div className="grid gap-4 border-t border-slate-200 bg-slate-50/70 p-5 sm:grid-cols-2">
              <SummaryItem
                label="Subscription period"
                value={subscriptionPeriod}
              />

              <SummaryItem
                label="Payment due"
                value={formatDate(
                  invoice.due_date,
                  false,
                )}
              />
            </div>

            <div className="border-t border-slate-200 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Invoice items
                  </p>

                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Charges used to calculate the
                    subscription invoice.
                  </p>
                </div>

                <Layers3 className="h-5 w-5 text-slate-400" />
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                {invoiceItems.length > 0 ? (
                  invoiceItems.map(
                    (item, index) => (
                      <div
                        key={item.id}
                        className={[
                          "grid gap-3 bg-white p-4 sm:grid-cols-[1fr_auto]",
                          index <
                          invoiceItems.length - 1
                            ? "border-b border-slate-200"
                            : "",
                        ].join(" ")}
                      >
                        <div>
                          <p className="text-sm font-black text-slate-900">
                            {item.description}
                          </p>

                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Quantity{" "}
                            {Number(
                              item.quantity,
                            ).toLocaleString(
                              "en-RW",
                            )}{" "}
                            ×{" "}
                            {formatMoney(
                              item.unit_price,
                              invoice.currency,
                            )}
                          </p>
                        </div>

                        <p className="text-sm font-black text-slate-950">
                          {formatMoney(
                            item.total,
                            invoice.currency,
                          )}
                        </p>
                      </div>
                    ),
                  )
                ) : (
                  <div className="bg-white p-4">
                    <p className="text-xs font-medium text-slate-500">
                      No detailed invoice items
                      were returned.
                    </p>
                  </div>
                )}
              </div>

              <div className="ml-auto mt-5 max-w-sm space-y-3">
                <InvoiceTotalRow
                  label="List price"
                  value={formatMoney(
                    invoice.subtotal,
                    invoice.currency,
                  )}
                />

                {Number(
                  invoice.tax_total || 0,
                ) > 0 ? (
                  <InvoiceTotalRow
                    label="Tax"
                    value={formatMoney(
                      invoice.tax_total,
                      invoice.currency,
                    )}
                  />
                ) : null}

                {hasDiscount ? (
                  <InvoiceTotalRow
                    label="Commitment discount"
                    value={`− ${formatMoney(
                      discountAmount,
                      invoice.currency,
                    )}`}
                    emphasized="discount"
                  />
                ) : null}

                <div className="border-t border-slate-200 pt-3">
                  <InvoiceTotalRow
                    label="Total payable"
                    value={formatMoney(
                      invoice.total,
                      invoice.currency,
                    )}
                    emphasized="total"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6">
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <div className="flex gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" />

                <div>
                  <p className="text-sm font-black text-orange-950">
                    No payable invoice found
                  </p>

                  <p className="mt-1 text-xs font-medium leading-5 text-orange-800">
                    The subscription invoice may
                    still be generating. Refresh the
                    workspace after a few moments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {invoicePaid ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />

            <div>
              <p className="text-sm font-black text-emerald-950">
                Payment confirmed
              </p>

              <p className="mt-1 text-xs font-medium leading-5 text-emerald-800">
                ShopCore is refreshing the tenant,
                subscription, and workspace
                activation state. The dashboard
                will open when activation is
                complete.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={submitPaymentAttempt}
          className="mt-8"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {methodOptions.map((method) => {
              const Icon = method.icon;
              const selected =
                selectedMethod === method.id;

              return (
                <button
                  key={method.id}
                  type="button"
                  disabled={attemptPending}
                  onClick={() =>
                    setSelectedMethod(
                      method.id,
                    )
                  }
                  className={[
                    "rounded-2xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? method.selectedClass
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-xl border",
                        selected
                          ? method.iconClass
                          : "border-slate-200 bg-slate-50 text-slate-500",
                      ].join(" ")}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <span
                      className={[
                        "flex h-5 w-5 items-center justify-center rounded-full border",
                        selected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300 bg-white text-transparent",
                      ].join(" ")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <p className="mt-4 text-sm font-black text-slate-950">
                    {method.title}
                  </p>

                  <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                    {method.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            {selectedMethod ===
            "mobile_money" ? (
              <MobileMoneyForm
                network={mobileNetwork}
                onNetworkChange={
                  setMobileNetwork
                }
                phone={mobilePhone}
                onPhoneChange={setMobilePhone}
              />
            ) : null}

            {selectedMethod === "card" ? (
              <CardPaymentForm
                cardholderName={
                  cardholderName
                }
                onCardholderNameChange={
                  setCardholderName
                }
                email={cardEmail}
                onEmailChange={setCardEmail}
                consent={cardConsent}
                onConsentChange={setCardConsent}
                invoiceNumber={
                  invoice?.invoice_no ||
                  "Pending invoice"
                }
                amount={invoice?.total ?? null}
                currency={
                  invoice?.currency ||
                  plan?.currency ||
                  "RWF"
                }
                packageName={packageName}
                billingCycle={formatBillingCycle(
                  billingCycle,
                )}
              />
            ) : null}

            {selectedMethod ===
            "bank_transfer" ? (
              <BankTransferForm
                reference={bankReference}
                onReferenceChange={
                  setBankReference
                }
                invoiceAmount={
                  invoice?.total ?? null
                }
                currency={
                  invoice?.currency || "RWF"
                }
              />
            ) : null}
          </div>

          {latestAttempt ? (
            <ExistingAttemptPanel
              attempt={latestAttempt}
              failed={attemptFailed}
            />
          ) : null}

          <Button
            type="submit"
            disabled={
              submitting ||
              loading ||
              !invoice ||
              attemptPending ||
              normalizeStatus(
                invoice?.status,
              ) !== "issued"
            }
            className="mt-6 h-12 w-full rounded-xl bg-[#070b67] font-black hover:bg-[#050950] sm:w-auto sm:min-w-[280px]"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : selectedMethod === "card" ? (
              <ExternalLink className="mr-2 h-4 w-4" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}

            {submitting
              ? selectedMethod === "card"
                ? "Preparing secure checkout..."
                : "Creating payment attempt..."
              : attemptPending
                ? "Payment verification pending"
                : attemptFailed
                  ? "Create another payment attempt"
                  : selectedMethod === "card"
                    ? "Continue to secure card payment"
                    : "Continue with payment"}
          </Button>
        </form>
      )}

      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />

          <div>
            <p className="text-sm font-black text-slate-950">
              Secure payment verification
            </p>

            <p className="mt-1 text-xs font-medium leading-5 text-slate-600">
              A customer payment attempt cannot
              activate the workspace by itself.
              Confirmation must come from a trusted
              gateway webhook, secure Edge
              Function, or authorized Platform
              Admin verification process.
            </p>
          </div>
        </div>
      </div>
    </OnboardingWorkspaceShell>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function InvoiceTotalRow({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string;
  emphasized?: "discount" | "total";
}) {
  return (
    <div className="flex items-center justify-between gap-5">
      <p
        className={[
          "text-xs font-bold",
          emphasized === "total"
            ? "text-slate-950"
            : "text-slate-500",
        ].join(" ")}
      >
        {label}
      </p>

      <p
        className={[
          "text-right font-black",
          emphasized === "discount"
            ? "text-sm text-emerald-700"
            : emphasized === "total"
              ? "text-lg text-slate-950"
              : "text-sm text-slate-800",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function InvoiceStatus({
  status,
}: {
  status: string;
}) {
  const normalized = normalizeStatus(status);

  const className = isPaidStatus(normalized)
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : normalized === "void"
      ? "border-slate-300 bg-slate-100 text-slate-600"
      : "border-orange-200 bg-orange-50 text-orange-700";

  return (
    <span
      className={[
        "inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        className,
      ].join(" ")}
    >
      {formatStatus(status)}
    </span>
  );
}

function AttemptStatus({
  status,
}: {
  status: string;
}) {
  const normalized = normalizeStatus(status);

  const className = isPaidStatus(normalized)
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : isFailedStatus(normalized)
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-orange-200 bg-orange-50 text-orange-700";

  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        className,
      ].join(" ")}
    >
      {formatStatus(status)}
    </span>
  );
}

function ExistingAttemptPanel({
  attempt,
  failed,
}: {
  attempt: PaymentAttempt;
  failed: boolean;
}) {
  return (
    <div
      className={[
        "mt-5 rounded-2xl border p-5",
        failed
          ? "border-rose-200 bg-rose-50"
          : "border-cyan-200 bg-cyan-50",
      ].join(" ")}
    >
      <div className="flex gap-3">
        <FileCheck2
          className={[
            "mt-0.5 h-5 w-5 shrink-0",
            failed
              ? "text-rose-700"
              : "text-cyan-700",
          ].join(" ")}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                className={[
                  "text-sm font-black",
                  failed
                    ? "text-rose-950"
                    : "text-cyan-950",
                ].join(" ")}
              >
                {failed
                  ? "Previous payment attempt failed"
                  : "Existing payment attempt"}
              </p>

              <p
                className={[
                  "mt-1 text-xs font-medium leading-5",
                  failed
                    ? "text-rose-800"
                    : "text-cyan-800",
                ].join(" ")}
              >
                Status:{" "}
                {formatStatus(attempt.status)}.{" "}
                {failed
                  ? "Review the failure reason and submit another attempt using the correct payment details."
                  : "Another attempt can be created only after this request fails, expires, or is rejected."}
              </p>
            </div>

            <AttemptStatus
              status={attempt.status || "pending"}
            />
          </div>

          {attempt.failure_reason ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-white/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-rose-500">
                Failure reason
              </p>

              <p className="mt-1 text-xs font-semibold leading-5 text-rose-800">
                {attempt.failure_reason}
              </p>
            </div>
          ) : null}

          {attempt.provider_reference ? (
            <button
              type="button"
              onClick={() =>
                void copyText(
                  attempt.provider_reference!,
                  "Payment reference copied.",
                )
              }
              className={[
                "mt-3 inline-flex items-center gap-2 text-xs font-black hover:underline",
                failed
                  ? "text-rose-800"
                  : "text-cyan-800",
              ].join(" ")}
            >
              <Copy className="h-3.5 w-3.5" />
              {attempt.provider_reference}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MobileMoneyForm({
  network,
  onNetworkChange,
  phone,
  onPhoneChange,
}: {
  network: MobileMoneyNetwork;
  onNetworkChange: (
    value: MobileMoneyNetwork,
  ) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Smartphone className="h-5 w-5 text-blue-700" />

        <div>
          <h3 className="text-sm font-black text-slate-950">
            Mobile Money details
          </h3>

          <p className="mt-1 text-xs font-medium text-slate-500">
            Use the telephone number that will approve
            the payment request.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="text-xs font-black text-slate-700">
            Mobile Money network
          </span>

          <select
            value={network}
            onChange={(event) =>
              onNetworkChange(
                event.target
                  .value as MobileMoneyNetwork,
              )
            }
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="mtn_momo">
              MTN Mobile Money
            </option>

            <option value="airtel_money">
              Airtel Money
            </option>
          </select>
        </label>

        <label>
          <span className="text-xs font-black text-slate-700">
            Telephone number
          </span>

          <div className="relative mt-2">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <Input
              type="tel"
              value={phone}
              onChange={(event) =>
                onPhoneChange(event.target.value)
              }
              placeholder="+250 7XX XXX XXX"
              className="h-11 bg-slate-50 pl-10 focus:bg-white"
            />
          </div>
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs font-medium leading-5 text-blue-800">
          The current action records a secure payment
          attempt. Automated push approval and provider
          confirmation will be enabled through the
          Mobile Money Edge Function and webhook.
        </p>
      </div>
    </div>
  );
}

function CardPaymentForm({
  cardholderName,
  onCardholderNameChange,
  email,
  onEmailChange,
  consent,
  onConsentChange,
  invoiceNumber,
  amount,
  currency,
  packageName,
  billingCycle,
}: {
  cardholderName: string;
  onCardholderNameChange: (
    value: string,
  ) => void;
  email: string;
  onEmailChange: (value: string) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  invoiceNumber: string;
  amount: number | null;
  currency: string;
  packageName: string;
  billingCycle: string;
}) {
  const displayName =
    cardholderName.trim() ||
    "CARDHOLDER NAME";

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700">
            <CreditCard className="h-5 w-5" />
          </div>

          <div>
            <h3 className="text-base font-black text-slate-950">
              Secure debit and credit card checkout
            </h3>

            <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-slate-500">
              Review the payment details in ShopCore,
              then continue to the certified provider
              checkout to enter the card number,
              expiration date, and security code.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CardNetworkBadge label="VISA" />
          <CardNetworkBadge label="Mastercard" />
          <CardNetworkBadge label="3-D Secure" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="space-y-5">
          <div className="relative min-h-[230px] overflow-hidden rounded-[24px] border border-slate-700 bg-[#0a1020] p-6 text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.85)]">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border border-white/10 bg-blue-500/10" />
            <div className="absolute -bottom-28 left-12 h-56 w-56 rounded-full border border-white/10 bg-violet-500/10" />

            <div className="relative flex h-full min-h-[182px] flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                    ShopCore secure checkout
                  </p>

                  <p className="mt-2 text-xs font-semibold text-white/45">
                    Hosted card payment
                  </p>
                </div>

                <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-black tracking-wide">
                  VISA
                </div>
              </div>

              <div className="py-6">
                <p className="font-mono text-xl font-bold tracking-[0.18em] text-white sm:text-2xl">
                  •••• •••• •••• ••••
                </p>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-6">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
                    Cardholder
                  </p>

                  <p className="mt-1 truncate text-sm font-black uppercase tracking-wide text-white/90">
                    {displayName}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
                    Protection
                  </p>

                  <p className="mt-1 text-sm font-black text-emerald-300">
                    3-D Secure
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-xs font-black text-slate-700">
                Cardholder name
              </span>

              <Input
                value={cardholderName}
                onChange={(event) =>
                  onCardholderNameChange(
                    event.target.value,
                  )
                }
                placeholder="Name shown on the card"
                autoComplete="cc-name"
                className="mt-2 h-11 bg-slate-50 focus:bg-white"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-700">
                Billing email
              </span>

              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <Input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    onEmailChange(
                      event.target.value,
                    )
                  }
                  placeholder="billing@company.com"
                  autoComplete="email"
                  className="h-11 bg-slate-50 pl-10 focus:bg-white"
                />
              </div>
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) =>
                onConsentChange(
                  event.target.checked,
                )
              }
              className="mt-0.5 h-4 w-4 rounded border-violet-300 text-violet-700 focus:ring-violet-500"
            />

            <span>
              <span className="block text-xs font-black text-violet-950">
                Authorize secure hosted checkout
              </span>

              <span className="mt-1 block text-xs font-medium leading-5 text-violet-800">
                I confirm the invoice and amount and
                agree to continue to an approved payment
                provider. Card details will be entered
                only on the provider’s protected page.
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 bg-white px-5 py-4">
              <p className="text-sm font-black text-slate-950">
                Card payment summary
              </p>

              <p className="mt-1 text-xs font-medium text-slate-500">
                Confirm these details before opening the
                provider checkout.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <CheckoutSummaryRow
                label="Invoice"
                value={invoiceNumber}
              />

              <CheckoutSummaryRow
                label="Commercial edition"
                value={packageName}
              />

              <CheckoutSummaryRow
                label="Billing cycle"
                value={billingCycle}
              />

              <CheckoutSummaryRow
                label="Payment method"
                value="Visa / Mastercard"
              />

              <div className="border-t border-slate-200 pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Total payable
                </p>

                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatMoney(amount, currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

              <div>
                <p className="text-sm font-black text-emerald-950">
                  Protected provider checkout
                </p>

                <p className="mt-1 text-xs font-medium leading-5 text-emerald-800">
                  The provider handles sensitive card
                  details, fraud screening, OTP, and
                  3-D Secure authentication. ShopCore
                  receives only the transaction result
                  and provider reference.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <SecurityPoint
              icon={KeyRound}
              label="OTP / 3-D Secure"
            />

            <SecurityPoint
              icon={Globe2}
              label="Hosted provider"
            />

            <SecurityPoint
              icon={ShieldCheck}
              label="Server verification"
            />
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-xs font-medium leading-5 text-orange-800">
              The current build prepares the hosted
              checkout request. A production card
              provider Edge Function must return the
              secure checkout URL before live card
              collection is enabled.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardNetworkBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black tracking-wide text-slate-700 shadow-sm">
      {label}
    </span>
  );
}

function CheckoutSummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-5">
      <p className="text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p className="max-w-[60%] text-right text-xs font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function SecurityPoint({
  icon: Icon,
  label,
}: {
  icon: typeof ShieldCheck;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <Icon className="h-4 w-4 shrink-0 text-blue-700" />

      <span className="text-[11px] font-black text-slate-700">
        {label}
      </span>
    </div>
  );
}

function BankTransferForm({
  reference,
  onReferenceChange,
  invoiceAmount,
  currency,
}: {
  reference: string;
  onReferenceChange: (value: string) => void;
  invoiceAmount: number | null;
  currency: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Landmark className="h-5 w-5 text-emerald-700" />

        <div>
          <h3 className="text-sm font-black text-slate-950">
            Bank transfer details
          </h3>

          <p className="mt-1 text-xs font-medium text-slate-500">
            Transfer the exact invoice total, then submit
            the bank transaction reference for verification.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">
          Exact amount to transfer
        </p>

        <p className="mt-2 text-xl font-black text-emerald-950">
          {formatMoney(invoiceAmount, currency)}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ["Account name", bankDetails.accountName],
          ["Account number", bankDetails.accountNumber],
          ["Bank", bankDetails.bankName],
          ["Currency", bankDetails.currency],
          ["Branch", bankDetails.branch],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              {label}
            </p>

            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-800">
                {value}
              </p>

              <button
                type="button"
                onClick={() =>
                  void copyText(
                    value,
                    `${label} copied.`,
                  )
                }
                className="text-slate-400 hover:text-slate-950"
                aria-label={`Copy ${label}`}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <Label
          htmlFor="bank-reference"
          className="text-xs font-black text-slate-700"
        >
          Bank transaction reference
        </Label>

        <Input
          id="bank-reference"
          value={reference}
          onChange={(event) =>
            onReferenceChange(event.target.value)
          }
          placeholder="Enter the transaction or deposit reference"
          className="mt-2 h-11 bg-slate-50 focus:bg-white"
        />
      </div>

      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex gap-3">
          <UploadCloud className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

          <p className="text-xs font-medium leading-5 text-emerald-800">
            Payment-proof upload will be added after the
            secure storage bucket and proof-document
            policies are finalized. The transaction
            reference already creates a payment attempt
            for Platform Admin review.
          </p>
        </div>
      </div>
    </div>
  );
}
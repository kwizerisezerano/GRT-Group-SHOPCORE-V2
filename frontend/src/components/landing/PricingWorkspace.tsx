import { useMemo, useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleMinus,
  Crown,
  Database,
  Headphones,
  Layers3,
  LockKeyhole,
  Package,
  ReceiptText,
  Server,
  ShieldCheck,
  Star,
  Store,
  Users,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";

type BillingCycle = "monthly" | "six_months" | "annual";
type AccessLevel = "included" | "limited" | "addon" | "unavailable";
type PlanCode =
  | "starter"
  | "professional"
  | "business_plus"
  | "enterprise_pro";

type PlanPrice = {
  billing_cycle: BillingCycle;
  billing_months: number;
  list_price: number;
  discount_percent: number;
  final_price: number;
  currency: string;
};

type PlanFeature = {
  feature_key: string;
  name: string;
  description: string | null;
  category: string;
  feature_type: string;
  access_level: AccessLevel;
  display_note: string | null;
  is_highlighted: boolean;
};

type PlanLimit = {
  limit_key: string;
  name: string;
  value: number | null;
  is_unlimited: boolean;
  unit: string | null;
};

type SubscriptionPlan = {
  id: string;
  code: PlanCode;
  name: string;
  description: string;
  short_description: string;
  currency: string;
  monthly_price: number;
  six_month_price: number;
  yearly_price: number;
  six_month_discount: number;
  yearly_discount: number;
  is_popular: boolean;
  display_order: number;
  badge_text: string | null;
  button_label: string | null;
  prices: PlanPrice[];
  features: PlanFeature[];
  limits: PlanLimit[];
};

type PlanPresentation = {
  icon: ElementType;
  eyebrow: string;
  audience: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  button: string;
};

const billingCycles: Array<{
  id: BillingCycle;
  label: string;
  compactLabel: string;
  description: string;
  suffix: string;
  discount: number;
}> = [
  {
    id: "monthly",
    label: "Monthly",
    compactLabel: "Monthly",
    description: "Flexible monthly billing",
    suffix: "/ month",
    discount: 0,
  },
  {
    id: "six_months",
    label: "6 months",
    compactLabel: "6 months",
    description: "Save 8% with a six-month commitment",
    suffix: "/ 6 months",
    discount: 8,
  },
  {
    id: "annual",
    label: "12 months",
    compactLabel: "Annual",
    description: "Save 15% with annual billing",
    suffix: "/ year",
    discount: 15,
  },
];

const planPresentation: Record<PlanCode, PlanPresentation> = {
  starter: {
    icon: Store,
    eyebrow: "Essential operations",
    audience: "Small shops and single-location businesses",
    accent: "border-blue-300 ring-blue-100",
    accentSoft: "border-border bg-muted",
    accentText: "text-blue-700 dark:text-blue-200",
    button: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400",
  },
  professional: {
    icon: Building2,
    eyebrow: "Growing retail control",
    audience: "Growing retailers and structured SMEs",
    accent: "border-blue-400 ring-blue-100",
    accentSoft: "border-border bg-muted",
    accentText: "text-blue-700 dark:text-blue-200",
    button: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400",
  },
  business_plus: {
    icon: Layers3,
    eyebrow: "Connected business operations",
    audience: "Established multi-location organizations",
    accent: "border-blue-300 ring-blue-100",
    accentSoft: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950",
    accentText: "text-blue-700 dark:text-blue-200",
    button: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400",
  },
  enterprise_pro: {
    icon: Crown,
    eyebrow: "Enterprise governance",
    audience: "Large businesses requiring complete control",
    accent: "border-border ring-border",
    accentSoft: "border-border bg-muted",
    accentText: "text-foreground",
    button: "bg-primary hover:bg-primary/90",
  },
};

const comparisonFeatureKeys = [
  "pos",
  "products",
  "suppliers",
  "purchases",
  "quotations",
  "inventory_advanced",
  "stock_transfers",
  "warehouses",
  "loyalty",
  "expenses",
  "crm",
  "procurement",
  "staff",
  "payroll",
  "workspace",
  "meetings",
  "reports_advanced",
  "executive_analytics",
  "audit_logs",
  "approval_workflows",
  "offline_mode",
  "desktop_app",
  "ebm",
  "api_access",
  "automation",
  "ai_operations",
  "multi_company",
  "sso",
  "custom_integrations",
  "priority_support",
] as const;

const comparisonSections = [
  {
    title: "Retail operations",
    icon: ReceiptText,
    keys: [
      "pos",
      "products",
      "suppliers",
      "purchases",
      "quotations",
    ],
  },
  {
    title: "Inventory and locations",
    icon: Warehouse,
    keys: [
      "inventory_advanced",
      "stock_transfers",
      "warehouses",
      "loyalty",
      "expenses",
    ],
  },
  {
    title: "Business management",
    icon: Building2,
    keys: [
      "crm",
      "procurement",
      "staff",
      "payroll",
      "workspace",
      "meetings",
    ],
  },
  {
    title: "Governance and intelligence",
    icon: BarChart3,
    keys: [
      "reports_advanced",
      "executive_analytics",
      "audit_logs",
      "approval_workflows",
      "automation",
      "ai_operations",
    ],
  },
  {
    title: "Platform and enterprise",
    icon: Server,
    keys: [
      "offline_mode",
      "desktop_app",
      "ebm",
      "api_access",
      "multi_company",
      "sso",
      "custom_integrations",
      "priority_support",
    ],
  },
];

const assuranceItems = [
  {
    icon: ShieldCheck,
    title: "Secure tenant isolation",
    text: "Every workspace is separated through tenant-aware access controls.",
  },
  {
    icon: Database,
    title: "Cloud and offline continuity",
    text: "Approved operations continue when connectivity becomes unavailable.",
  },
  {
    icon: BadgeCheck,
    title: "Transparent package limits",
    text: "Features, capacities and billing commitments are defined before payment.",
  },
  {
    icon: Headphones,
    title: "Local implementation support",
    text: "Configuration and rollout assistance are available based on package scope.",
  },
];

const getText = (source: unknown, keys: string[], fallback: string) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
};

const getArray = (source: unknown, keys: string[]) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const asBoolean = (value: unknown) => value === true;

const normalisePrice = (value: unknown): PlanPrice | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const price = value as Record<string, unknown>;
  const cycle = price.billing_cycle;

  if (
    cycle !== "monthly" &&
    cycle !== "six_months" &&
    cycle !== "annual"
  ) {
    return null;
  }

  return {
    billing_cycle: cycle,
    billing_months: asNumber(price.billing_months, cycle === "monthly" ? 1 : 6),
    list_price: asNumber(price.list_price),
    discount_percent: asNumber(price.discount_percent),
    final_price: asNumber(price.final_price),
    currency:
      typeof price.currency === "string" && price.currency
        ? price.currency
        : "RWF",
  };
};

const normaliseFeature = (value: unknown): PlanFeature | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const feature = value as Record<string, unknown>;
  const featureKey = getText(feature, ["feature_key"], "");

  if (!featureKey) {
    return null;
  }

  const rawAccess = getText(feature, ["access_level"], "included");
  const accessLevel: AccessLevel =
    rawAccess === "limited" ||
    rawAccess === "addon" ||
    rawAccess === "unavailable"
      ? rawAccess
      : "included";

  return {
    feature_key: featureKey,
    name: getText(feature, ["name"], featureKey),
    description:
      typeof feature.description === "string" ? feature.description : null,
    category: getText(feature, ["category"], "Platform"),
    feature_type: getText(feature, ["feature_type"], "capability"),
    access_level: accessLevel,
    display_note:
      typeof feature.display_note === "string"
        ? feature.display_note
        : null,
    is_highlighted: asBoolean(feature.is_highlighted),
  };
};

const normaliseLimit = (value: unknown): PlanLimit | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const limit = value as Record<string, unknown>;
  const limitKey = getText(limit, ["limit_key"], "");

  if (!limitKey) {
    return null;
  }

  const numericValue =
    typeof limit.value === "number" || typeof limit.value === "string"
      ? asNumber(limit.value)
      : null;

  return {
    limit_key: limitKey,
    name: getText(limit, ["name"], limitKey),
    value: numericValue,
    is_unlimited: asBoolean(limit.is_unlimited),
    unit: typeof limit.unit === "string" ? limit.unit : null,
  };
};

const normalisePlan = (value: unknown): SubscriptionPlan | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const plan = value as Record<string, unknown>;
  const code = getText(plan, ["code"], "") as PlanCode;

  // Allow any plan code, not just those in planPresentation
  // This prevents filtering out valid plans from database
  if (!code) {
    return null;
  }

  const prices = Array.isArray(plan.prices)
    ? plan.prices.map(normalisePrice).filter(Boolean) as PlanPrice[]
    : [];

  const features = Array.isArray(plan.features)
    ? plan.features.map(normaliseFeature).filter(Boolean) as PlanFeature[]
    : [];

  const limits = Array.isArray(plan.limits)
    ? plan.limits.map(normaliseLimit).filter(Boolean) as PlanLimit[]
    : [];

  const presentation = planPresentation[code] || {
    icon: Store,
    eyebrow: "Plan",
    audience: "Business plan",
    accent: "border-border ring-border",
    accentSoft: "border-border bg-muted",
    accentText: "text-foreground",
    button: "bg-primary hover:bg-primary/90",
  };

  return {
    id: getText(plan, ["id"], `plan-${code}`),
    code,
    name: getText(plan, ["name"], code),
    description: getText(plan, ["description"], ""),
    short_description: getText(
      plan,
      ["short_description"],
      getText(plan, ["description"], ""),
    ),
    currency: getText(plan, ["currency"], "RWF"),
    monthly_price: asNumber(plan.monthly_price),
    six_month_price: asNumber(plan.six_month_price),
    yearly_price: asNumber(plan.yearly_price),
    six_month_discount: asNumber(plan.six_month_discount),
    yearly_discount: asNumber(plan.yearly_discount),
    is_popular: asBoolean(plan.is_popular),
    display_order: asNumber(plan.display_order, 99),
    badge_text:
      typeof plan.badge_text === "string" ? plan.badge_text : null,
    button_label:
      typeof plan.button_label === "string" ? plan.button_label : null,
    prices,
    features,
    limits,
  };
};

const formatMoney = (value: number, currency = "RWF") =>
  new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s+/g, " ");

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);

const getPrice = (plan: SubscriptionPlan, cycle: BillingCycle) => {
  const databasePrice = plan.prices.find(
    (price) => price.billing_cycle === cycle,
  );

  if (databasePrice) {
    return databasePrice;
  }

  if (cycle === "six_months") {
    return {
      billing_cycle: cycle,
      billing_months: 6,
      list_price: plan.monthly_price * 6,
      discount_percent: plan.six_month_discount,
      final_price: plan.six_month_price,
      currency: plan.currency,
    };
  }

  if (cycle === "annual") {
    return {
      billing_cycle: cycle,
      billing_months: 12,
      list_price: plan.monthly_price * 12,
      discount_percent: plan.yearly_discount,
      final_price: plan.yearly_price,
      currency: plan.currency,
    };
  }

  return {
    billing_cycle: cycle,
    billing_months: 1,
    list_price: plan.monthly_price,
    discount_percent: 0,
    final_price: plan.monthly_price,
    currency: plan.currency,
  };
};

const getFeature = (plan: SubscriptionPlan, featureKey: string) =>
  plan.features.find((feature) => feature.feature_key === featureKey);

const getLimit = (plan: SubscriptionPlan | undefined, limitKey: string) =>
  plan?.limits.find((limit) => limit.limit_key === limitKey);

const formatLimit = (limit?: PlanLimit) => {
  if (!limit) {
    return "Not specified";
  }

  if (limit.is_unlimited) {
    return "Unlimited";
  }

  if (limit.value === null) {
    return "Not specified";
  }

  const value = formatCompactNumber(limit.value);

  if (!limit.unit) {
    return value;
  }

  return `${value} ${limit.unit}`;
};

const getFeatureName = (
  plans: SubscriptionPlan[],
  featureKey: string,
) => {
  for (const plan of plans) {
    const feature = getFeature(plan, featureKey);

    if (feature) {
      return feature.name;
    }
  }

  return featureKey
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getPlanFeaturePreview = (plan: SubscriptionPlan) => {
  const highlighted = plan.features.filter(
    (feature) =>
      feature.is_highlighted &&
      feature.access_level !== "unavailable",
  );

  const available = plan.features.filter(
    (feature) => feature.access_level !== "unavailable",
  );

  const selected = highlighted.length >= 6 ? highlighted : available;

  return selected.slice(0, 7);
};

function AccessIndicator({
  feature,
  compact = false,
}: {
  feature?: PlanFeature;
  compact?: boolean;
}) {
  if (!feature || feature.access_level === "unavailable") {
    return (
      <div
        className={[
          "inline-flex items-center gap-1.5 text-slate-400",
          compact ? "justify-center" : "",
        ].join(" ")}
      >
        <X className="h-4 w-4" />
        {!compact ? (
          <span className="text-xs font-bold">Not included</span>
        ) : null}
      </div>
    );
  }

  if (feature.access_level === "limited") {
    return (
      <div
        className={[
          "inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-200",
          compact ? "justify-center" : "",
        ].join(" ")}
      >
        <CircleMinus className="h-4 w-4" />
        {!compact ? (
          <span className="text-xs font-bold">Limited</span>
        ) : null}
      </div>
    );
  }

  if (feature.access_level === "addon") {
    return (
      <div
        className={[
          "inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-200",
          compact ? "justify-center" : "",
        ].join(" ")}
      >
        <Package className="h-4 w-4" />
        {!compact ? (
          <span className="text-xs font-bold">Add-on</span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-200",
        compact ? "justify-center" : "",
      ].join(" ")}
    >
      <Check className="h-4 w-4" />
      {!compact ? (
        <span className="text-xs font-bold">Included</span>
      ) : null}
    </div>
  );
}

export default function PricingWorkspace() {
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("monthly");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "Retail operations",
  ]);

  const {
    activeBranch,
    branchHealth,
  } = useLandingExperience();

  const branches = getArray(demoBusiness, ["branches"]);

  const branch =
    branchHealth.find((item) => item.id === activeBranch) ??
    branches.find(
      (item) => getText(item, ["id", "key"], "") === activeBranch,
    ) ??
    branches[0];

  const branchName = getText(
    branch,
    ["name", "label", "title"],
    "Active business",
  );

  const branchCount = branchHealth.length || branches.length || 1;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-subscription-plan-catalog"],
    queryFn: async () => {
      try {
        const client = supabase as unknown as {
          from: (relation: string) => {
            select: (columns: string) => {
              order: (
                column: string,
                options?: { ascending?: boolean },
              ) => Promise<{
                data: unknown[] | null;
                error: { message?: string } | null;
              }>;
            };
          };
        };

        const { data: rows, error } = await client
          .from("public_subscription_plan_catalog")
          .select("*")
          .order("display_order", { ascending: true });

        if (error) {
          throw new Error(
            error.message || "Unable to load subscription plans.",
          );
        }

        const normalised = (rows ?? [])
          .map(normalisePlan)
          .filter(Boolean) as SubscriptionPlan[];

        if (normalised.length === 0) {
          console.warn("No pricing plans found in the catalog.");
          return [];
        }

        return normalised;
      } catch (err) {
        console.error("Error loading pricing plans:", err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const plans = useMemo(() => {
    if (!data?.length) {
      return [];
    }

    return data.sort(
      (first, second) =>
        first.display_order - second.display_order,
    );
  }, [data]);

  const recommendedPlan = useMemo(() => {
    if (plans.length === 0) {
      return undefined;
    }

    const suitable = plans.find((plan) => {
      const branchLimit = getLimit(plan, "branches");

      if (!branchLimit) {
        return false;
      }

      return (
        branchLimit.is_unlimited ||
        (branchLimit.value !== null &&
          branchCount <= branchLimit.value)
      );
    });

    return suitable ?? plans[plans.length - 1];
  }, [branchCount, plans]);

  const activeCycle =
    billingCycles.find((cycle) => cycle.id === billingCycle) ??
    billingCycles[0];

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections((current) =>
      current.includes(sectionTitle)
        ? current.filter((item) => item !== sectionTitle)
        : [...current, sectionTitle],
    );
  };

  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-y border-border bg-card py-20 sm:py-28"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_18%_10%,rgba(37,99,235,0.08),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(124,58,237,0.08),transparent_32%)]" />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-foreground">
            <ReceiptText className="h-3.5 w-3.5" />
            ShopCore editions
          </div>

          <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-slate-900 dark:!text-blue-100 sm:text-5xl">
            Four editions. Clear limits. Predictable business growth.
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-base font-medium leading-8 text-slate-700 dark:!text-slate-200 sm:text-lg">
            Start with the operating modules your business needs today, then
            upgrade as users, branches, warehouses, terminals and governance
            requirements expand. Six-month and annual commitments include
            transparent savings.
          </p>
        </div>

        <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center">
          <div className="relative w-full">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 rounded-2xl blur-2xl opacity-30 dark:opacity-20"></div>
            <div className="relative grid w-full grid-cols-3 gap-2 rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-2 shadow-2xl">
              {billingCycles.map((cycle) => {
                const selected = billingCycle === cycle.id;
                const isBestValue = cycle.discount >= 15;

                return (
                  <button
                    key={cycle.id}
                    type="button"
                    onClick={() => setBillingCycle(cycle.id)}
                    className={[
                      "relative group flex flex-col items-center justify-center rounded-xl px-4 py-6 transition-all duration-300",
                      selected
                        ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl scale-105 ring-2 ring-blue-400 ring-offset-2 ring-offset-background"
                        : "bg-transparent text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-foreground",
                    ].join(" ")}
                  >
                    {selected && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <div className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 shadow-lg">
                          <Check className="h-3 w-3 text-white" />
                          <span className="text-[9px] font-black uppercase tracking-wider text-white">
                            Selected
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {isBestValue && !selected && (
                      <div className="absolute -top-2 right-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-900 shadow-md">
                          <Star className="h-3 w-3" />
                        </div>
                      </div>
                    )}
                    
                    <span className="text-sm font-bold tracking-tight">
                      {cycle.compactLabel}
                    </span>

                    {cycle.discount > 0 ? (
                      <div className="mt-3 flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5 rounded-full bg-white/20 dark:bg-black/20 px-3 py-1.5 backdrop-blur-sm">
                          <Zap className="h-3.5 w-3.5 text-yellow-300" />
                          <span className="text-[11px] font-black uppercase tracking-wider">
                            Save {cycle.discount}%
                          </span>
                        </div>
                        <span className="text-[9px] font-medium tracking-wide opacity-80">
                          {cycle.description}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                          Flexible
                        </span>
                        <span className="text-[9px] font-medium tracking-wide opacity-60">
                          No commitment
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-8 text-center text-sm font-medium text-muted-foreground">
            {activeCycle.description}. Prices shown in Rwandan francs.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            <div className="col-span-full py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                Loading pricing plans...
              </p>
            </div>
          ) : plans.length === 0 ? (
            <div className="col-span-full py-12 text-center">
              <CircleMinus className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                Unable to load pricing plans. Please try again later.
              </p>
            </div>
          ) : (
            plans.map((plan) => {
            const presentation = planPresentation[plan.code];
            const Icon = presentation.icon;
            const price = getPrice(plan, billingCycle);
            const savings = Math.max(
              price.list_price - price.final_price,
              0,
            );
            const previewFeatures = getPlanFeaturePreview(plan);
            const branchLimit = getLimit(plan, "branches");
            const usersLimit = getLimit(plan, "users");
            const productLimit = getLimit(plan, "products");
            const warehouseLimit = getLimit(plan, "warehouses");
            const posLimit = getLimit(plan, "pos_terminals");
            const storageLimit = getLimit(plan, "storage_gb");
            const recommended = plan.code === recommendedPlan?.code;

            return (
              <article
                key={plan.code}
                className={[
                  "relative flex min-h-full flex-col rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl",
                  recommended
                    ? "border-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/50 dark:to-card shadow-xl ring-4 ring-blue-500/20"
                    : "border-border bg-card shadow-lg hover:border-blue-500/50",
                ].join(" ")}
              >
                {recommended ? (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 shadow-lg">
                      <Crown className="h-4 w-4 text-yellow-300" />
                      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white">
                        Most Popular
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="flex min-h-7 items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {plan.badge_text ? (
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
                          presentation.accentSoft,
                          presentation.accentText,
                        ].join(" ")}
                      >
                        {plan.badge_text}
                      </span>
                    ) : null}
                  </div>

                  {isLoading ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  ) : null}
                </div>

                <div
                  className={[
                    "mt-5 flex h-12 w-12 items-center justify-center rounded-2xl border",
                    presentation.accentSoft,
                  ].join(" ")}
                >
                  <Icon className={["h-5 w-5", presentation.accentText].join(" ")} />
                </div>

                <p
                  className={[
                    "mt-5 text-[11px] font-black uppercase tracking-[0.15em]",
                    plan.code === "enterprise_pro"
                      ? "text-muted-foreground"
                      : "text-muted-foreground",
                  ].join(" ")}
                >
                  {presentation.eyebrow}
                </p>

                <h3
                  className={[
                    "mt-2 text-2xl font-black tracking-tight",
                    plan.code === "enterprise_pro"
                      ? "text-white"
                      : "text-foreground",
                  ].join(" ")}
                >
                  {plan.name}
                </h3>

                <p
                  className={[
                    "mt-2 min-h-[48px] text-sm font-medium leading-6",
                    plan.code === "enterprise_pro"
                      ? "text-muted-foreground"
                      : "text-muted-foreground",
                  ].join(" ")}
                >
                  {plan.short_description}
                </p>

                <div className="mt-6">
                  {price.discount_percent > 0 ? (
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-bold line-through text-muted-foreground">
                        {formatMoney(price.list_price, price.currency)}
                      </span>
                      <div className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1">
                        <Zap className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          Save {formatMoney(savings, price.currency)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Pay as you operate
                    </p>
                  )}

                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                    <span className="text-[40px] font-black tracking-[-0.05em] text-foreground">
                      {formatMoney(price.final_price, price.currency)}
                    </span>
                    <span className="pb-2 text-sm font-bold text-muted-foreground">
                      {activeCycle.suffix}
                    </span>
                  </div>

                  {billingCycle !== "monthly" ? (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2">
                      <BadgeCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                        {formatMoney(
                          Math.round(
                            price.final_price / price.billing_months,
                          ),
                          price.currency,
                        )} per month equivalent
                      </p>
                    </div>
                  ) : null}
                </div>

                <div
                  className={[
                    "mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-muted p-4",
                  ].join(" ")}
                >
                  {[
                    {
                      label: "Users",
                      value: formatLimit(usersLimit),
                      icon: Users,
                    },
                    {
                      label: "Products",
                      value:
                        plan.code === "enterprise_pro"
                          ? "10,000+ products"
                          : formatLimit(productLimit),
                      icon: Package,
                    },
                    {
                      label: "Branches",
                      value: formatLimit(branchLimit),
                      icon: Building2,
                    },
                    {
                      label: "Warehouses",
                      value: formatLimit(warehouseLimit),
                      icon: Warehouse,
                    },
                    {
                      label: "POS terminals",
                      value: formatLimit(posLimit),
                      icon: Store,
                    },
                    {
                      label: "Storage",
                      value: formatLimit(storageLimit),
                      icon: Database,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-2 rounded-lg bg-card p-2.5 shadow-sm">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                            {item.label}
                          </p>
                          <p
                            className="mt-0.5 truncate text-xs font-bold text-foreground"
                            title={item.value}
                          >
                            {item.value}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex-1">
                  <p className="text-xs font-black uppercase tracking-wider text-foreground">
                    Included in this edition
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {previewFeatures.map((feature) => (
                      <div
                        key={feature.feature_key}
                        className="flex items-start gap-3 rounded-lg bg-muted p-3 transition-colors hover:bg-muted/80"
                      >
                        {feature.access_level === "limited" ? (
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                            <CircleMinus className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          </div>
                        ) : (
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold leading-5 text-foreground">
                            {feature.name}
                          </p>

                          {feature.display_note ? (
                            <p className="mt-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
                              {feature.display_note}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-7">
                  <Button
                    className={[
                      "h-12 w-full rounded-xl font-black shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl",
                      recommended
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
                        : "bg-slate-900 text-white hover:bg-slate-800",
                    ].join(" ")}
                    asChild
                  >
                    <Link
                      to={`/signup?plan=${plan.code}&billing=${billingCycle}`}
                    >
                      {plan.button_label || `Choose ${plan.name}`}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>

                  <p className="mt-3 text-center text-xs font-medium text-muted-foreground">
                    {presentation.audience}
                  </p>
                </div>
              </article>
            );
          })
          )}
        </div>

        {isError ? (
          <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-200">
            <CircleMinus className="h-4 w-4" />
            The live catalog could not be refreshed. Approved ShopCore edition
            prices, discounts and package values are displayed.
          </div>
        ) : null}

        <div className="mt-10 overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_30px_90px_-55px_rgba(15,23,42,0.9)]">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-blue-600 dark:text-blue-200">
                <Building2 className="h-3.5 w-3.5" />
                Operating fit
              </div>

              <h3 className="mt-5 max-w-2xl text-2xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-3xl">
                {recommendedPlan?.name} matches the current preview scale.
              </h3>

              <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-muted-foreground">
                The active business model currently represents{" "}
                <span className="font-black text-foreground">{branchName}</span>{" "}
                with{" "}
                <span className="font-black text-foreground">
                  {branchCount} operating{" "}
                  {branchCount === 1 ? "branch" : "branches"}
                </span>
                . Package recommendations consider branch capacity first,
                while users, terminals, warehouses and required modules
                should also be reviewed before subscribing.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  asChild
                  className="rounded-xl bg-card font-black text-foreground hover:bg-muted"
                >
                  <Link
                    to={`/signup?plan=${recommendedPlan?.code ?? "professional"}&billing=${billingCycle}`}
                  >
                    Continue with {recommendedPlan?.name}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl border-border bg-transparent font-black text-foreground hover:bg-muted hover:text-foreground"
                >
                  <Link to="/contact-sales">
                    Discuss requirements
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Users,
                  label: "User capacity",
                  value: formatLimit(
                    getLimit(recommendedPlan, "users"),
                  ),
                },
                {
                  icon: Package,
                  label: "Product capacity",
                  value:
                    recommendedPlan?.code === "enterprise_pro"
                      ? "10,000+ products"
                      : formatLimit(
                          getLimit(recommendedPlan, "products"),
                        ),
                },
                {
                  icon: Building2,
                  label: "Branch capacity",
                  value: formatLimit(
                    getLimit(recommendedPlan, "branches"),
                  ),
                },
                {
                  icon: Warehouse,
                  label: "Warehouse capacity",
                  value: formatLimit(
                    getLimit(recommendedPlan, "warehouses"),
                  ),
                },
                {
                  icon: Zap,
                  label: "Transaction capacity",
                  value: formatLimit(
                    getLimit(
                      recommendedPlan,
                      "monthly_transactions",
                    ),
                  ),
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-muted p-4"
                  >
                    <Icon className="h-5 w-5 text-blue-400 dark:text-blue-200" />

                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                      {item.label}
                    </p>

                    <p className="mt-1 text-sm font-black text-slate-900 dark:!text-blue-100">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-[28px] border border-border bg-card shadow-[0_24px_70px_-52px_rgba(15,23,42,0.5)]">
          <button
            type="button"
            onClick={() => setComparisonOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-7"
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700 dark:text-blue-200">
                Detailed comparison
              </p>

              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-2xl">
                Compare modules, capabilities and package access.
              </h3>

              <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                Review the complete commercial distinction before selecting
                an edition.
              </p>
            </div>

            <span className="flex h-11 w-11 shrink-0 items-center justify-center text-foreground">
              <ChevronDown
                className={[
                  "h-5 w-5 transition-transform",
                  comparisonOpen ? "rotate-180" : "",
                ].join(" ")}
              />
            </span>
          </button>

          {comparisonOpen ? (
            <div className="border-t border-slate-200">
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="sticky top-0 z-10 grid grid-cols-[280px_repeat(4,minmax(165px,1fr))] border-b border-border bg-card">
                    <div className="p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                        Capability
                      </p>
                    </div>

                    {plans.map((plan) => (
                      <div
                        key={plan.code}
                        className={[
                          "border-l border-slate-200 p-4 text-center",
                          plan.is_popular ? "bg-muted/60" : "",
                        ].join(" ")}
                      >
                        <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                          {plan.name}
                        </p>

                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {formatMoney(
                            getPrice(plan, billingCycle).final_price,
                            plan.currency,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>

                  {comparisonSections.map((section) => {
                    const Icon = section.icon;
                    const expanded = expandedSections.includes(
                      section.title,
                    );

                    return (
                      <div key={section.title}>
                        <button
                          type="button"
                          onClick={() => toggleSection(section.title)}
                          className="grid w-full grid-cols-[280px_repeat(4,minmax(165px,1fr))] border-b border-border bg-muted text-left"
                        >
                          <div className="col-span-5 flex items-center justify-between gap-3 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-blue-600 dark:text-blue-200" />
                              <span className="text-xs font-black uppercase tracking-[0.12em] text-foreground">
                                {section.title}
                              </span>
                            </div>

                            <ChevronDown
                              className={[
                                "h-4 w-4 text-slate-500 transition-transform",
                                expanded ? "rotate-180" : "",
                              ].join(" ")}
                            />
                          </div>
                        </button>

                        {expanded
                          ? section.keys
                              .filter((key) =>
                                comparisonFeatureKeys.includes(
                                  key as (typeof comparisonFeatureKeys)[number],
                                ),
                              )
                              .map((featureKey) => (
                                <div
                                  key={featureKey}
                                  className="grid grid-cols-[280px_repeat(4,minmax(165px,1fr))] border-b border-slate-100 last:border-b-0"
                                >
                                  <div className="p-4">
                                    <p className="text-sm font-bold text-slate-900 dark:!text-blue-100">
                                      {getFeatureName(plans, featureKey)}
                                    </p>
                                  </div>

                                  {plans.map((plan) => {
                                    const feature = getFeature(
                                      plan,
                                      featureKey,
                                    );

                                    return (
                                      <div
                                        key={`${plan.code}-${featureKey}`}
                                        className={[
                                          "border-l border-slate-100 p-4 text-center",
                                          plan.is_popular
                                            ? "bg-muted/30"
                                            : "",
                                        ].join(" ")}
                                      >
                                        <AccessIndicator
                                          feature={feature}
                                          compact
                                        />

                                        {feature?.display_note ? (
                                          <p className="mx-auto mt-1 max-w-[150px] text-[10px] font-semibold leading-4 text-slate-400">
                                            {feature.display_note}
                                          </p>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))
                          : null}
                      </div>
                    );
                  })}

                  <div className="bg-muted p-5">
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                      <AccessIndicator
                        feature={{
                          feature_key: "included",
                          name: "Included",
                          description: null,
                          category: "",
                          feature_type: "",
                          access_level: "included",
                          display_note: null,
                          is_highlighted: false,
                        }}
                      />

                      <AccessIndicator
                        feature={{
                          feature_key: "limited",
                          name: "Limited",
                          description: null,
                          category: "",
                          feature_type: "",
                          access_level: "limited",
                          display_note: null,
                          is_highlighted: false,
                        }}
                      />

                      <AccessIndicator
                        feature={{
                          feature_key: "addon",
                          name: "Add-on",
                          description: null,
                          category: "",
                          feature_type: "",
                          access_level: "addon",
                          display_note: null,
                          is_highlighted: false,
                        }}
                      />

                      <AccessIndicator />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {assuranceItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-muted p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center text-foreground">
                  <Icon className="h-4 w-4" />
                </div>

                <h3 className="mt-4 text-sm font-black text-slate-900 dark:!text-blue-100">
                  {item.title}
                </h3>

                <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-5 rounded-[24px] border border-border bg-card p-6 text-center shadow-sm sm:flex-row sm:text-left">
          <div>
            <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
              Need a tailored deployment or implementation review?
            </p>

            <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
              Discuss data migration, EBM configuration, training, custom
              integrations and rollout requirements with the ShopCore team.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-11 shrink-0 rounded-xl border-border bg-card font-black text-foreground hover:bg-muted"
          >
            <Link to="/contact-sales">
              Contact sales
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
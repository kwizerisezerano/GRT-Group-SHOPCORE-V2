import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  Edit3,
  Eye,
  HardDrive,
  Layers3,
  Loader2,
  Package,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Store,
  ToggleRight,
  Users,
  Warehouse,
  X,
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

type FeatureAccessLevel =
  | "included"
  | "limited"
  | "addon"
  | "unavailable";

type PlanPrice = {
  billing_cycle: string;
  price: number | null;
  discount_percent: number | null;
  savings_amount: number | null;
  effective_monthly_price: number | null;
  currency: string | null;
  period_months: number | null;
  is_active: boolean | null;
};

type PlanFeature = {
  feature_key: string;
  name: string;
  description: string | null;
  category: string | null;
  feature_type: string | null;
  access_level: FeatureAccessLevel;
  display_note: string | null;
  is_highlighted: boolean | null;
  display_order: number | null;
};

type PlanLimit = {
  limit_key: string;
  name: string;
  value: number | null;
  is_unlimited: boolean | null;
  unit: string | null;
};

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  short_description: string | null;
  positioning: string | null;
  currency: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  max_users: number | null;
  max_branches: number | null;
  max_products: number | null;
  features_legacy: unknown;
  is_active: boolean | null;
  is_public: boolean | null;
  is_popular: boolean | null;
  display_order: number | null;
  badge_text: string | null;
  cta_label: string | null;
  cta_route: string | null;
  created_at: string | null;
  prices: PlanPrice[];
  features: PlanFeature[];
  limits: PlanLimit[];
};

type EditState = {
  plan: PlanRow;
  monthlyPrice: string;
  sixMonthPrice: string;
  annualPrice: string;
  users: string;
  branches: string;
  products: string;
  warehouses: string;
  posTerminals: string;
  desktopDevices: string;
  storageGb: string;
  monthlyTransactions: string;
  isPublic: boolean;
  isActive: boolean;
  isPopular: boolean;
  badgeText: string;
};

const APPROVED_PRODUCT_LIMITS: Record<
  string,
  number
> = {
  starter: 500,
  professional: 1000,
  business_plus: 5000,
  enterprise_pro: 10000,
};

const APPROVED_PLAN_ORDER = [
  "starter",
  "professional",
  "business_plus",
  "enterprise_pro",
];

const APPROVED_MONTHLY_PRICES: Record<
  string,
  number
> = {
  starter: 15999,
  professional: 20999,
  business_plus: 35999,
  enterprise_pro: 79999,
};

function normalizeKey(
  value?: string | null,
) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_") || ""
  );
}

function formatLabel(
  value?: string | null,
) {
  return (
    value
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase(),
      ) || "Not configured"
  );
}

function money(
  value?: number | null,
  currency = "RWF",
) {
  return `${currency} ${Number(
    value || 0,
  ).toLocaleString()}`;
}

function getPrice(
  plan: PlanRow,
  billingCycle: string,
) {
  return (
    plan.prices.find(
      (price) =>
        normalizeKey(price.billing_cycle) ===
        normalizeKey(billingCycle),
    ) || null
  );
}

function getLimit(
  plan: PlanRow,
  limitKey: string,
) {
  return (
    plan.limits.find(
      (limit) =>
        normalizeKey(limit.limit_key) ===
        normalizeKey(limitKey),
    ) || null
  );
}

function formatLimit(
  limit: PlanLimit | null,
  fallback?: number | null,
) {
  if (limit?.is_unlimited) {
    return "Unlimited";
  }

  const value =
    limit?.value ?? fallback ?? null;

  if (value === null) {
    return "Not configured";
  }

  return `${Number(value).toLocaleString()}${
    limit?.unit ? ` ${limit.unit}` : ""
  }`;
}

function toNumber(
  value: string,
) {
  const parsed = Number(
    value.replace(/,/g, "").trim(),
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function buildEditState(
  plan: PlanRow,
): EditState {
  return {
    plan,
    monthlyPrice: String(
      getPrice(plan, "monthly")?.price ??
        plan.monthly_price ??
        APPROVED_MONTHLY_PRICES[
          plan.code
        ] ??
        0,
    ),
    sixMonthPrice: String(
      getPrice(plan, "six_months")?.price ??
        0,
    ),
    annualPrice: String(
      getPrice(plan, "annual")?.price ??
        plan.yearly_price ??
        0,
    ),
    users: String(
      getLimit(plan, "users")?.value ??
        plan.max_users ??
        0,
    ),
    branches: String(
      getLimit(plan, "branches")?.value ??
        plan.max_branches ??
        0,
    ),
    products: String(
      APPROVED_PRODUCT_LIMITS[
        plan.code
      ] ??
        getLimit(plan, "products")
          ?.value ??
        plan.max_products ??
        0,
    ),
    warehouses: String(
      getLimit(plan, "warehouses")
        ?.value ?? 0,
    ),
    posTerminals: String(
      getLimit(plan, "pos_terminals")
        ?.value ?? 0,
    ),
    desktopDevices: String(
      getLimit(plan, "desktop_devices")
        ?.value ?? 0,
    ),
    storageGb: String(
      getLimit(plan, "storage_gb")
        ?.value ?? 0,
    ),
    monthlyTransactions: String(
      getLimit(
        plan,
        "monthly_transactions",
      )?.value ?? 0,
    ),
    isPublic:
      plan.is_public !== false,
    isActive:
      plan.is_active !== false,
    isPopular:
      plan.is_popular === true,
    badgeText: plan.badge_text || "",
  };
}



export default function Plans() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [previewPlan, setPreviewPlan] =
    useState<PlanRow | null>(null);
  const [editState, setEditState] =
    useState<EditState | null>(null);

  const plansQ = useQuery({
    queryKey: [
      "platform-subscription-plans",
    ],
    queryFn: async (): Promise<
      PlanRow[]
    > => {
      const { data, error } = await (
        supabase as any
      )
        .from(
          "public_subscription_plan_catalog",
        )
        .select("*");

      if (error) {
        throw error;
      }

      const plans = (data ?? []).map(
        (row: any): PlanRow => ({
          id: row.id,
          code: row.code,
          name: row.name,
          description:
            row.description ?? null,
          short_description:
            row.short_description ?? null,
          positioning:
            row.positioning ?? null,
          currency: row.currency || "RWF",
          monthly_price:
            row.monthly_price ?? null,
          yearly_price:
            row.yearly_price ?? null,
          max_users:
            row.max_users ?? null,
          max_branches:
            row.max_branches ?? null,
          max_products:
            row.max_products ?? null,
          features_legacy:
            row.features_legacy ??
            row.features ??
            null,
          is_active:
            row.is_active ?? true,
          is_public:
            row.is_public ?? true,
          is_popular:
            row.is_popular ?? false,
          display_order:
            row.display_order ?? 0,
          badge_text:
            row.badge_text ?? null,
          cta_label:
            row.cta_label ?? null,
          cta_route:
            row.cta_route ?? null,
          created_at:
            row.created_at ?? null,
          prices: Array.isArray(
            row.prices,
          )
            ? row.prices
            : [],
          features: Array.isArray(
            row.features,
          )
            ? row.features
            : [],
          limits: Array.isArray(
            row.limits,
          )
            ? row.limits
            : [],
        }),
      );

      return plans.sort(
        (first, second) => {
          const firstIndex =
            APPROVED_PLAN_ORDER.indexOf(
              first.code,
            );
          const secondIndex =
            APPROVED_PLAN_ORDER.indexOf(
              second.code,
            );

          if (
            firstIndex !== -1 ||
            secondIndex !== -1
          ) {
            return (
              (firstIndex === -1
                ? 99
                : firstIndex) -
              (secondIndex === -1
                ? 99
                : secondIndex)
            );
          }

          return (
            Number(
              first.display_order || 0,
            ) -
            Number(
              second.display_order || 0,
            )
          );
        },
      );
    },
    refetchInterval: 60000,
  });

  const savePlan = useMutation({
    mutationFn: async (
      state: EditState,
    ) => {
      const monthlyPrice = toNumber(
        state.monthlyPrice,
      );
      const sixMonthPrice = toNumber(
        state.sixMonthPrice,
      );
      const annualPrice = toNumber(
        state.annualPrice,
      );

      if (
        monthlyPrice <= 0 ||
        sixMonthPrice <= 0 ||
        annualPrice <= 0
      ) {
        throw new Error(
          "Monthly, six-month and annual prices must all be greater than zero.",
        );
      }

      const expectedProducts =
        APPROVED_PRODUCT_LIMITS[
          state.plan.code
        ];

      const productLimit = toNumber(
        state.products,
      );

      if (
        expectedProducts &&
        productLimit !== expectedProducts
      ) {
        throw new Error(
          `${state.plan.name} must keep the approved product capacity of ${expectedProducts.toLocaleString()}.`,
        );
      }

      const { error: planError } =
        await (supabase as any)
          .from("subscription_plans")
          .update({
            monthly_price:
              monthlyPrice,
            yearly_price:
              annualPrice,
            max_users: toNumber(
              state.users,
            ),
            max_branches: toNumber(
              state.branches,
            ),
            max_products:
              productLimit,
            is_active: state.isActive,
            is_public: state.isPublic,
            is_popular:
              state.isPopular,
            badge_text:
              state.badgeText.trim() ||
              null,
          })
          .eq("id", state.plan.id);

      if (planError) {
        throw planError;
      }

      const priceRows = [
        {
          plan_code: state.plan.code,
          billing_cycle: "monthly",
          price: monthlyPrice,
          discount_percent: 0,
          savings_amount: 0,
          effective_monthly_price:
            monthlyPrice,
          currency:
            state.plan.currency ||
            "RWF",
          period_months: 1,
          is_active: true,
        },
        {
          plan_code: state.plan.code,
          billing_cycle:
            "six_months",
          price: sixMonthPrice,
          discount_percent: 8,
          savings_amount: Math.max(
            monthlyPrice * 6 -
              sixMonthPrice,
            0,
          ),
          effective_monthly_price:
            Math.round(
              sixMonthPrice / 6,
            ),
          currency:
            state.plan.currency ||
            "RWF",
          period_months: 6,
          is_active: true,
        },
        {
          plan_code: state.plan.code,
          billing_cycle: "annual",
          price: annualPrice,
          discount_percent: 15,
          savings_amount: Math.max(
            monthlyPrice * 12 -
              annualPrice,
            0,
          ),
          effective_monthly_price:
            Math.round(
              annualPrice / 12,
            ),
          currency:
            state.plan.currency ||
            "RWF",
          period_months: 12,
          is_active: true,
        },
      ];

      const { error: pricesError } =
        await (supabase as any)
          .from(
            "subscription_plan_prices",
          )
          .upsert(priceRows, {
            onConflict:
              "plan_code,billing_cycle",
          });

      if (pricesError) {
        throw pricesError;
      }

      const limitRows = [
        {
          plan_code: state.plan.code,
          limit_key: "users",
          limit_name: "Users",
          limit_value: toNumber(
            state.users,
          ),
          is_unlimited: false,
          unit: "users",
        },
        {
          plan_code: state.plan.code,
          limit_key: "branches",
          limit_name: "Branches",
          limit_value: toNumber(
            state.branches,
          ),
          is_unlimited: false,
          unit: "branches",
        },
        {
          plan_code: state.plan.code,
          limit_key: "products",
          limit_name: "Products",
          limit_value:
            productLimit,
          is_unlimited: false,
          unit: "products",
        },
        {
          plan_code: state.plan.code,
          limit_key: "warehouses",
          limit_name: "Warehouses",
          limit_value: toNumber(
            state.warehouses,
          ),
          is_unlimited: false,
          unit: "warehouses",
        },
        {
          plan_code: state.plan.code,
          limit_key:
            "pos_terminals",
          limit_name:
            "POS terminals",
          limit_value: toNumber(
            state.posTerminals,
          ),
          is_unlimited: false,
          unit: "terminals",
        },
        {
          plan_code: state.plan.code,
          limit_key:
            "desktop_devices",
          limit_name:
            "Desktop devices",
          limit_value: toNumber(
            state.desktopDevices,
          ),
          is_unlimited: false,
          unit: "devices",
        },
        {
          plan_code: state.plan.code,
          limit_key: "storage_gb",
          limit_name: "Storage",
          limit_value: toNumber(
            state.storageGb,
          ),
          is_unlimited: false,
          unit: "GB",
        },
        {
          plan_code: state.plan.code,
          limit_key:
            "monthly_transactions",
          limit_name:
            "Monthly transactions",
          limit_value: toNumber(
            state.monthlyTransactions,
          ),
          is_unlimited: false,
          unit: "transactions",
        },
      ];

      const { error: limitsError } =
        await (supabase as any)
          .from(
            "subscription_plan_limits",
          )
          .upsert(limitRows, {
            onConflict:
              "plan_code,limit_key",
          });

      if (limitsError) {
        throw limitsError;
      }
    },
    onSuccess: async () => {
      toast.success(
        "Subscription plan updated.",
      );
      setEditState(null);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "platform-subscription-plans",
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "shopcore-public-pricing-catalog",
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "platform-subscription-engine",
          ],
        }),
      ]);
    },
    onError: (error: any) =>
      toast.error(
        error?.message ||
          "Subscription plan could not be updated.",
      ),
  });

  const plans = plansQ.data ?? [];

  const rows = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return plans.filter((plan) => {
      if (!query) {
        return true;
      }

      return (
        plan.code
          .toLowerCase()
          .includes(query) ||
        plan.name
          .toLowerCase()
          .includes(query) ||
        plan.description
          ?.toLowerCase()
          .includes(query) ||
        plan.positioning
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [plans, search]);

  const stats = useMemo(
    () => ({
      total: plans.length,
      active: plans.filter(
        (plan) => plan.is_active,
      ).length,
      publicPlans: plans.filter(
        (plan) => plan.is_public,
      ).length,
      popular: plans.filter(
        (plan) => plan.is_popular,
      ).length,
    }),
    [plans],
  );

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow={t("platformAdmin.pages.plans.eyebrow")}
        title={t("platformAdmin.pages.plans.title")}
        description={t("platformAdmin.pages.plans.description")}
        actions={
          <Button
            className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
            onClick={() => {
              void plansQ.refetch();
              toast.info(
                "Refreshing subscription plans...",
              );
            }}
            disabled={plansQ.isFetching}
          >
            <RefreshCw
              className={[
                "mr-2 h-4 w-4",
                plansQ.isFetching
                  ? "animate-spin"
                  : "",
              ].join(" ")}
            />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <PlatformKpiCard
          icon={
            <Layers3 className="h-6 w-6" />
          }
          label="Total Plans"
          value={stats.total.toLocaleString()}
          tone="blue"
        />

        <PlatformKpiCard
          icon={
            <ToggleRight className="h-6 w-6" />
          }
          label="Active Plans"
          value={stats.active.toLocaleString()}
          tone="emerald"
        />

        <PlatformKpiCard
          icon={
            <Eye className="h-6 w-6" />
          }
          label="Public Plans"
          value={stats.publicPlans.toLocaleString()}
          tone="cyan"
        />

        <PlatformKpiCard
          icon={
            <ShieldCheck className="h-6 w-6" />
          }
          label="Recommended"
          value={stats.popular.toLocaleString()}
          tone="violet"
        />
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/35 p-5">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

          <div>
            <p className="text-sm font-black text-blue-950">
              Catalog synchronization
            </p>

            <p className="mt-1 text-xs font-medium leading-5 text-blue-800">
              Changes saved here update the core plan,
              billing prices and operational limits.
              The public pricing section and signup
              flow should read from the same catalog
              view to prevent pricing or entitlement
              drift.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
        <div className="mb-5">
          <PlatformSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search plan name, code, positioning or description..."
          />
        </div>

        {plansQ.isLoading ? (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
            <p className="ml-3 text-sm font-bold text-muted-foreground">
              Loading subscription plans...
            </p>
          </div>
        ) : plansQ.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/35 p-6">
            <AlertTriangle className="h-6 w-6 text-rose-700" />

            <p className="mt-3 text-sm font-black text-rose-950">
              Subscription plans could not be loaded.
            </p>

            <p className="mt-2 text-xs font-medium leading-5 text-rose-700">
              {plansQ.error instanceof Error
                ? plansQ.error.message
                : "Verify the public subscription catalog view and Platform Admin permissions."}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-muted-foreground">
            No subscription plans found.
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
            {rows.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={() =>
                  setEditState(
                    buildEditState(plan),
                  )
                }
                onPreview={() =>
                  setPreviewPlan(plan)
                }
              />
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(editState)}
        onOpenChange={(open) => {
          if (
            !open &&
            !savePlan.isPending
          ) {
            setEditState(null);
          }
        }}
      >
        <DialogContent className="z-[120] max-h-[92vh] max-w-5xl overflow-y-auto rounded-[28px] border-border p-0">
          {editState ? (
            <>
              <div className="border-b border-border bg-muted/40 px-6 py-5">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-xl font-black text-foreground">
                    <Edit3 className="h-5 w-5 text-blue-700" />
                    Edit {editState.plan.name}
                  </DialogTitle>

                  <DialogDescription className="pt-2 font-medium leading-6 text-muted-foreground">
                    Update approved commercial pricing,
                    visibility and operating capacity.
                    Product limits are protected by the
                    approved ShopCore package structure.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="space-y-7 px-6 py-6">
                <EditorSection
                  title="Commitment pricing"
                  description="Monthly, six-month and annual billing values."
                >
                  <EditorField
                    label="Monthly price"
                    value={editState.monthlyPrice}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        monthlyPrice: value,
                      })
                    }
                  />

                  <EditorField
                    label="6-month total"
                    value={editState.sixMonthPrice}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        sixMonthPrice: value,
                      })
                    }
                  />

                  <EditorField
                    label="12-month total"
                    value={editState.annualPrice}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        annualPrice: value,
                      })
                    }
                  />
                </EditorSection>

                <EditorSection
                  title="Operational capacity"
                  description="Limits enforced by the commercial entitlement engine."
                >
                  <EditorField
                    label="Users"
                    value={editState.users}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        users: value,
                      })
                    }
                  />

                  <EditorField
                    label="Branches"
                    value={editState.branches}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        branches: value,
                      })
                    }
                  />

                  <EditorField
                    label="Products"
                    value={editState.products}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        products: value,
                      })
                    }
                    helper={`Approved: ${(
                      APPROVED_PRODUCT_LIMITS[
                        editState.plan.code
                      ] || 0
                    ).toLocaleString()}`}
                  />

                  <EditorField
                    label="Warehouses"
                    value={editState.warehouses}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        warehouses: value,
                      })
                    }
                  />

                  <EditorField
                    label="POS terminals"
                    value={editState.posTerminals}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        posTerminals: value,
                      })
                    }
                  />

                  <EditorField
                    label="Desktop devices"
                    value={editState.desktopDevices}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        desktopDevices: value,
                      })
                    }
                  />

                  <EditorField
                    label="Storage GB"
                    value={editState.storageGb}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        storageGb: value,
                      })
                    }
                  />

                  <EditorField
                    label="Monthly transactions"
                    value={editState.monthlyTransactions}
                    onChange={(value) =>
                      setEditState({
                        ...editState,
                        monthlyTransactions: value,
                      })
                    }
                  />
                </EditorSection>

                <EditorSection
                  title="Public presentation"
                  description="Controls used by landing pricing and signup."
                >
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-black text-foreground">
                      Badge text
                    </Label>

                    <Input
                      value={editState.badgeText}
                      onChange={(event) =>
                        setEditState({
                          ...editState,
                          badgeText:
                            event.target.value,
                        })
                      }
                      placeholder="Best Value"
                      className="mt-2 h-11"
                    />
                  </div>

                  <ToggleField
                    label="Active plan"
                    checked={editState.isActive}
                    onChange={(checked) =>
                      setEditState({
                        ...editState,
                        isActive: checked,
                      })
                    }
                  />

                  <ToggleField
                    label="Publicly visible"
                    checked={editState.isPublic}
                    onChange={(checked) =>
                      setEditState({
                        ...editState,
                        isPublic: checked,
                      })
                    }
                  />

                  <ToggleField
                    label="Recommended plan"
                    checked={editState.isPopular}
                    onChange={(checked) =>
                      setEditState({
                        ...editState,
                        isPopular: checked,
                      })
                    }
                  />
                </EditorSection>
              </div>

              <DialogFooter className="border-t border-border bg-muted/40 px-6 py-4">
                <Button
                  variant="outline"
                  className="rounded-xl font-black"
                  disabled={savePlan.isPending}
                  onClick={() =>
                    setEditState(null)
                  }
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>

                <Button
                  className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
                  disabled={savePlan.isPending}
                  onClick={() =>
                    savePlan.mutate(editState)
                  }
                >
                  {savePlan.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}

                  {savePlan.isPending
                    ? "Saving plan..."
                    : "Save plan"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewPlan)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewPlan(null);
          }
        }}
      >
        <DialogContent className="z-[120] max-h-[90vh] max-w-4xl overflow-y-auto rounded-[28px] border-border">
          {previewPlan ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-foreground">
                  {previewPlan.name} preview
                </DialogTitle>

                <DialogDescription>
                  Landing-page and signup catalog
                  preview.
                </DialogDescription>
              </DialogHeader>

              <PlanPreview plan={previewPlan} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanCard({
  plan,
  onEdit,
  onPreview,
}: {
  plan: PlanRow;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const monthly =
    getPrice(plan, "monthly");

  const sixMonths =
    getPrice(plan, "six_months");

  const annual =
    getPrice(plan, "annual");

  const products =
    getLimit(plan, "products");

  return (
    <article
      className={[
        "rounded-[1.75rem] border bg-card p-5 shadow-sm",
        plan.is_popular
          ? "border-violet-300 ring-2 ring-violet-100"
          : "border-border",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-black text-foreground">
              {plan.name}
            </p>

            {plan.badge_text ? (
              <span className="rounded-full border border-violet-200 bg-violet-50 dark:bg-violet-950/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-violet-700">
                {plan.badge_text}
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            {plan.code}
          </p>
        </div>

        <PlatformStatusBadge
          status={
            plan.is_active
              ? plan.is_public
                ? "active"
                : "private"
              : "disabled"
          }
        />
      </div>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 dark:bg-blue-950/35 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
          Monthly
        </p>

        <p className="mt-1 text-3xl font-black text-blue-950">
          {money(
            monthly?.price ??
              plan.monthly_price,
            plan.currency || "RWF",
          )}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <PriceSummary
            label="6 months"
            value={money(
              sixMonths?.price,
              plan.currency || "RWF",
            )}
            note={`${Number(
              sixMonths?.discount_percent ||
                8,
            )}% discount`}
          />

          <PriceSummary
            label="12 months"
            value={money(
              annual?.price ??
                plan.yearly_price,
              plan.currency || "RWF",
            )}
            note={`${Number(
              annual?.discount_percent ||
                15,
            )}% discount`}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <LimitCard
          icon={Users}
          label="Users"
          value={formatLimit(
            getLimit(plan, "users"),
            plan.max_users,
          )}
        />

        <LimitCard
          icon={Package}
          label="Products"
          value={
            plan.code === "enterprise_pro"
              ? "10,000+ products"
              : formatLimit(
                  products,
                  APPROVED_PRODUCT_LIMITS[
                    plan.code
                  ] ??
                    plan.max_products,
                )
          }
        />

        <LimitCard
          icon={Building2}
          label="Branches"
          value={formatLimit(
            getLimit(plan, "branches"),
            plan.max_branches,
          )}
        />

        <LimitCard
          icon={Warehouse}
          label="Warehouses"
          value={formatLimit(
            getLimit(plan, "warehouses"),
          )}
        />

        <LimitCard
          icon={Smartphone}
          label="POS terminals"
          value={formatLimit(
            getLimit(
              plan,
              "pos_terminals",
            ),
          )}
        />

        <LimitCard
          icon={HardDrive}
          label="Storage"
          value={formatLimit(
            getLimit(plan, "storage_gb"),
          )}
        />
      </div>

      <div className="mt-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
          Module access
        </p>

        <div className="mt-3 space-y-2">
          {plan.features
            .slice(0, 6)
            .map((feature) => (
              <FeatureRow
                key={feature.feature_key}
                feature={feature}
              />
            ))}

          {!plan.features.length ? (
            <div className="rounded-xl border border-slate-100 bg-muted/40 px-3 py-3 text-xs font-bold text-muted-foreground">
              No feature catalog configured.
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="rounded-xl font-black"
          onClick={onPreview}
        >
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>

        <Button
          className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
          onClick={onEdit}
        >
          <Edit3 className="mr-2 h-4 w-4" />
          Configure
        </Button>
      </div>
    </article>
  );
}

function PriceSummary({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white/70 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-600">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-blue-950">
        {value}
      </p>

      <p className="mt-1 text-[10px] font-bold text-emerald-600">
        {note}
      </p>
    </div>
  );
}

function LimitCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <Icon className="h-4 w-4 text-blue-700" />

      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-foreground">
        {value}
      </p>
    </div>
  );
}

function FeatureRow({
  feature,
}: {
  feature: PlanFeature;
}) {
  const tone =
    feature.access_level === "included"
      ? "border-emerald-100 bg-emerald-50 dark:bg-emerald-950/35 text-emerald-700"
      : feature.access_level === "limited"
        ? "border-blue-100 bg-blue-50 dark:bg-blue-950/35 text-blue-700"
        : feature.access_level === "addon"
          ? "border-orange-100 bg-orange-50 dark:bg-orange-950/35 text-orange-700"
          : "border-border bg-muted/40 text-muted-foreground";

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${tone}`}
    >
      <p className="truncate text-xs font-bold">
        {feature.name}
      </p>

      <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.1em]">
        {feature.access_level}
      </span>
    </div>
  );
}

function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div>
        <h3 className="text-sm font-black text-foreground">
          {title}
        </h3>

        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

function EditorField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
}) {
  return (
    <label>
      <span className="text-xs font-black text-foreground">
        {label}
      </span>

      <Input
        type="number"
        min="0"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 h-11"
      />

      {helper ? (
        <span className="mt-1 block text-[10px] font-bold text-blue-600">
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
      <span className="text-xs font-black text-foreground">
        {label}
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
      />
    </label>
  );
}

function PlanPreview({
  plan,
}: {
  plan: PlanRow;
}) {
  const highlightedFeatures =
    plan.features.filter(
      (feature) =>
        feature.is_highlighted,
    );

  return (
    <div className="mt-5 rounded-[2rem] border border-border bg-muted/40 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            {plan.positioning ||
              "ShopCore edition"}
          </p>

          <h3 className="mt-2 text-3xl font-black text-foreground">
            {plan.name}
          </h3>

          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
            {plan.short_description ||
              plan.description ||
              "Commercial edition configured for ShopCore Cloud ERP."}
          </p>
        </div>

        <PlatformStatusBadge
          status={
            plan.is_public
              ? "public"
              : "private"
          }
        />
      </div>

      <div className="mt-6 rounded-2xl border border-blue-200 bg-card p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
          Starting from
        </p>

        <p className="mt-2 text-4xl font-black text-foreground">
          {money(
            getPrice(plan, "monthly")
              ?.price ??
              plan.monthly_price,
            plan.currency || "RWF",
          )}
        </p>

        <p className="mt-1 text-xs font-bold text-muted-foreground">
          per month
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(highlightedFeatures.length
          ? highlightedFeatures
          : plan.features.slice(0, 8)
        ).map((feature) => (
          <div
            key={feature.feature_key}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

            <div>
              <p className="text-xs font-black text-foreground">
                {feature.name}
              </p>

              {feature.display_note ? (
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  {feature.display_note}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

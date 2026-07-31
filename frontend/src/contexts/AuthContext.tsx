import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/lib/apiClient";
import type {
  ApiSession as Session,
  ApiUser as User,
} from "@/lib/apiClient";
import {
  disableOfflineMode,
  getCachedOfflineAuth,
  isOfflineMode,
} from "@/lib/offlineAuth";

export type AppRole =
  | "owner"
  | "admin"
  | "manager"
  | "cashier"
  | "accountant"
  | "inventory_officer"
  | "sales_staff"
  | "staff"
  | "viewer";

export interface RolePermission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

export type WorkspaceAccessStatus =
  | "active"
  | "pending_payment"
  | "trial_active"
  | "trial_expired"
  | "blocked"
  | "unknown";

export type FeatureAccessLevel =
  | "included"
  | "limited"
  | "addon"
  | "unavailable";

export type EntitlementStatus =
  | "enabled"
  | "disabled"
  | "trial"
  | "suspended"
  | "expired";

export interface PlanFeature {
  feature_key: string;
  name: string;
  description: string | null;
  category: string;
  feature_type: string;
  access_level: FeatureAccessLevel;
  display_note: string | null;
  is_highlighted: boolean;
}

export interface PlanLimit {
  limit_key: string;
  name: string;
  value: number | null;
  is_unlimited: boolean;
  unit: string | null;
}

export interface ModuleEntitlement {
  id: string | null;
  tenant_id: string | null;
  module_key: string;
  module_name: string;
  status: EntitlementStatus;
  seats_included: number;
  seats_used: number;
  usage_count: number;
  last_used_at: string | null;
  metadata: Record<string, unknown>;
}

export interface CapacityUsage {
  users: number;
  branches: number;
  warehouses: number;
  products: number;
  pos_terminals: number;
  desktop_devices: number;
  storage_gb: number;
  monthly_transactions: number;
}

export interface PlanAccessDecision {
  allowed: boolean;
  featureKey: string;
  accessLevel: FeatureAccessLevel;
  source:
    | "plan"
    | "tenant_override"
    | "platform_core"
    | "catalog_unavailable";
  reason: string | null;
  feature: PlanFeature | null;
  entitlement: ModuleEntitlement | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  bootstrapping: boolean;
  entitlementLoading: boolean;

  tenantId: string | null;
  tenantName: string | null;
  role: AppRole | null;
  permissions: RolePermission[];

  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  billingCycle: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;

  paymentStatus: string | null;
  trialStatus: string | null;
  trialEndsAt: string | null;
  workspaceStatus: string | null;
  onboardingCompleted: boolean;

  workspaceAccessStatus: WorkspaceAccessStatus;
  isWorkspaceActive: boolean;
  requiresActivation: boolean;

  planFeatures: PlanFeature[];
  planLimits: PlanLimit[];
  moduleEntitlements: ModuleEntitlement[];
  capacityUsage: CapacityUsage;

  signOut: () => Promise<void>;
  refreshTenant: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;

  canViewModule: (module: string) => boolean;
  canAccessModule: (moduleKey: string) => boolean;
  getModuleAccess: (
    moduleKey: string,
  ) => PlanAccessDecision;

  hasFeature: (featureKey: string) => boolean;
  getFeatureAccess: (
    featureKey: string,
  ) => FeatureAccessLevel;

  getLimit: (limitKey: string) => PlanLimit | null;
  getUsage: (limitKey: string) => number;
  getRemainingCapacity: (
    limitKey: string,
  ) => number | null;
  isAtLimit: (limitKey: string) => boolean;

  canInviteUser: () => boolean;
  canCreateBranch: () => boolean;
  canCreateWarehouse: () => boolean;
  canRegisterPOSTerminal: () => boolean;
  canRegisterDesktopDevice: () => boolean;
  canCreateProduct: () => boolean;
}

type CachedAuthState = {
  user?: User | null;
  session?: Session | null;
  tenantId?: string | null;
  tenantName?: string | null;
  role?: AppRole | null;
  permissions?: RolePermission[];
  offline?: boolean;

  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  billingCycle?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;

  paymentStatus?: string | null;
  trialStatus?: string | null;
  trialEndsAt?: string | null;
  workspaceStatus?: string | null;
  onboardingCompleted?: boolean;
  workspaceAccessStatus?: WorkspaceAccessStatus;

  planFeatures?: PlanFeature[];
  planLimits?: PlanLimit[];
  moduleEntitlements?: ModuleEntitlement[];
  capacityUsage?: CapacityUsage;

  cached_at?: string;
};

const AUTH_CACHE_KEY =
  "shopcore_cached_auth_state";

const EMPTY_CAPACITY_USAGE: CapacityUsage = {
  users: 0,
  branches: 0,
  warehouses: 0,
  products: 0,
  pos_terminals: 0,
  desktop_devices: 0,
  storage_gb: 0,
  monthly_transactions: 0,
};

const ROLE_ORDER: AppRole[] = [
  "viewer",
  "staff",
  "sales_staff",
  "cashier",
  "inventory_officer",
  "accountant",
  "manager",
  "admin",
  "owner",
];

/**
 * Modules required for every authenticated ShopCore workspace.
 * These still require an active workspace and valid role access.
 */
const PLATFORM_CORE_MODULES = new Set([
  "dashboard",
  "settings",
  "profile",
  "activation",
  "billing",
  "support",
  "notifications",
  "security",
]);

/**
 * Maps historical route/module labels to the canonical commercial keys.
 * Add aliases here when existing pages use a different key from pricing.
 */
const MODULE_KEY_ALIASES: Record<string, string> = {
  home: "dashboard",
  overview: "dashboard",

  sale: "sales",
  sales_management: "sales",

  pos_system: "pos",
  point_of_sale: "pos",

  product: "products",
  product_catalog: "products",

  inventory_management: "inventory",
  stock: "inventory",
  stock_control: "inventory",

  purchase: "purchases",
  purchasing: "purchases",

  supplier: "suppliers",
  customer: "customers",

  warehouse_management: "warehouses",
  warehouse: "warehouses",

  branch_management: "branches",
  branch: "branches",

  transfer: "stock_transfers",
  transfers: "stock_transfers",

  stock_count: "stock_counts",
  stock_adjustment: "stock_adjustments",

  report: "reports",
  analytics_dashboard: "analytics",

  employee: "staff",
  employees: "staff",
  workforce: "staff",

  accounting_finance: "accounting",
  finance: "accounting",

  collaboration: "workspace",
  workspace_collaboration: "workspace",

  ebm_integration: "ebm",
  rra_ebm: "ebm",

  api_access: "api",
  custom_api: "api",

  ai: "ai_assistant",
  assistant: "ai_assistant",
};

const AuthContext =
  createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
};

export function roleAtLeast(
  current: AppRole | null,
  required: AppRole,
): boolean {
  if (!current) {
    return false;
  }

  return (
    ROLE_ORDER.indexOf(current) >=
    ROLE_ORDER.indexOf(required)
  );
}

function normalizeKey(
  value: string | null | undefined,
) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "") || ""
  );
}

function canonicalModuleKey(
  value: string | null | undefined,
) {
  const normalized = normalizeKey(value);

  return MODULE_KEY_ALIASES[normalized] || normalized;
}

function normalizeRole(
  value: string | null | undefined,
): AppRole {
  if (ROLE_ORDER.includes(value as AppRole)) {
    return value as AppRole;
  }

  return "viewer";
}

function normalizeAccessLevel(
  value: unknown,
): FeatureAccessLevel {
  if (
    value === "included" ||
    value === "limited" ||
    value === "addon" ||
    value === "unavailable"
  ) {
    return value;
  }

  return "unavailable";
}

function normalizeEntitlementStatus(
  value: unknown,
): EntitlementStatus {
  if (
    value === "enabled" ||
    value === "disabled" ||
    value === "trial" ||
    value === "suspended" ||
    value === "expired"
  ) {
    return value;
  }

  return "disabled";
}

function onlineNow() {
  return !isOfflineMode();
}

function normalizeOperationalStatus(
  value: string | null | undefined,
) {
  return value?.trim().toLowerCase() || "";
}

function resolveWorkspaceAccessStatus(params: {
  paymentStatus?: string | null;
  trialStatus?: string | null;
  trialEndsAt?: string | null;
  workspaceStatus?: string | null;
  subscriptionStatus?: string | null;
}): WorkspaceAccessStatus {
  const paymentStatus =
    normalizeOperationalStatus(
      params.paymentStatus,
    ) || "unpaid";

  const trialStatus =
    normalizeOperationalStatus(
      params.trialStatus,
    ) || "none";

  const workspaceStatus =
    normalizeOperationalStatus(
      params.workspaceStatus,
    ) || "pending_payment";

  const subscriptionStatus =
    normalizeOperationalStatus(
      params.subscriptionStatus,
    ) || "pending_payment";

  if (
    workspaceStatus === "blocked" ||
    workspaceStatus === "suspended" ||
    subscriptionStatus === "blocked" ||
    subscriptionStatus === "suspended" ||
    subscriptionStatus === "cancelled" ||
    subscriptionStatus === "terminated"
  ) {
    return "blocked";
  }

  const paid =
    paymentStatus === "paid" ||
    paymentStatus === "confirmed" ||
    paymentStatus === "completed" ||
    paymentStatus === "verified" ||
    paymentStatus === "successful";

  if (
    workspaceStatus === "active" &&
    (paid || subscriptionStatus === "active")
  ) {
    return "active";
  }

  if (
    paid &&
    subscriptionStatus === "active"
  ) {
    return "active";
  }

  if (
    trialStatus === "approved" ||
    trialStatus === "active"
  ) {
    if (!params.trialEndsAt) {
      return "trial_active";
    }

    const trialEnd = new Date(
      params.trialEndsAt,
    ).getTime();

    if (
      Number.isFinite(trialEnd) &&
      trialEnd > Date.now()
    ) {
      return "trial_active";
    }

    return "trial_expired";
  }

  if (
    workspaceStatus === "pending_payment" ||
    subscriptionStatus ===
      "pending_payment" ||
    paymentStatus === "unpaid" ||
    paymentStatus === "pending"
  ) {
    return "pending_payment";
  }

  return "unknown";
}

function readCachedAuth(): CachedAuthState | null {
  try {
    const raw =
      localStorage.getItem(AUTH_CACHE_KEY);

    return raw
      ? (JSON.parse(raw) as CachedAuthState)
      : null;
  } catch {
    return null;
  }
}

function writeCachedAuth(
  data: CachedAuthState,
) {
  try {
    if (!data.user) {
      return;
    }

    localStorage.setItem(
      AUTH_CACHE_KEY,
      JSON.stringify({
        ...data,
        cached_at: new Date().toISOString(),
      }),
    );
  } catch {
    // Local persistence may be unavailable.
  }
}

function clearCachedAuth() {
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    // Local persistence may be unavailable.
  }
}

function sameValue(
  first: unknown,
  second: unknown,
) {
  return (
    JSON.stringify(first ?? null) ===
    JSON.stringify(second ?? null)
  );
}

function asNumber(
  value: unknown,
  fallback = 0,
) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizePlanFeature(
  value: unknown,
): PlanFeature | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<
    string,
    unknown
  >;

  const featureKey = canonicalModuleKey(
    typeof row.feature_key === "string"
      ? row.feature_key
      : "",
  );

  if (!featureKey) {
    return null;
  }

  return {
    feature_key: featureKey,
    name:
      typeof row.name === "string"
        ? row.name
        : featureKey,
    description:
      typeof row.description === "string"
        ? row.description
        : null,
    category:
      typeof row.category === "string"
        ? row.category
        : "Platform",
    feature_type:
      typeof row.feature_type === "string"
        ? row.feature_type
        : "capability",
    access_level: normalizeAccessLevel(
      row.access_level,
    ),
    display_note:
      typeof row.display_note === "string"
        ? row.display_note
        : null,
    is_highlighted:
      row.is_highlighted === true,
  };
}

function normalizePlanLimit(
  value: unknown,
): PlanLimit | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<
    string,
    unknown
  >;

  const limitKey = normalizeKey(
    typeof row.limit_key === "string"
      ? row.limit_key
      : "",
  );

  if (!limitKey) {
    return null;
  }

  const rawValue = row.value;

  return {
    limit_key: limitKey,
    name:
      typeof row.name === "string"
        ? row.name
        : limitKey,
    value:
      rawValue === null ||
      rawValue === undefined
        ? null
        : asNumber(rawValue),
    is_unlimited:
      row.is_unlimited === true,
    unit:
      typeof row.unit === "string"
        ? row.unit
        : null,
  };
}

function normalizeModuleEntitlement(
  value: unknown,
): ModuleEntitlement | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<
    string,
    unknown
  >;

  const moduleKey = canonicalModuleKey(
    typeof row.module_key === "string"
      ? row.module_key
      : "",
  );

  if (!moduleKey) {
    return null;
  }

  return {
    id:
      typeof row.id === "string"
        ? row.id
        : null,
    tenant_id:
      typeof row.tenant_id === "string"
        ? row.tenant_id
        : null,
    module_key: moduleKey,
    module_name:
      typeof row.module_name === "string"
        ? row.module_name
        : moduleKey,
    status: normalizeEntitlementStatus(
      row.status,
    ),
    seats_included: asNumber(
      row.seats_included,
    ),
    seats_used: asNumber(row.seats_used),
    usage_count: asNumber(row.usage_count),
    last_used_at:
      typeof row.last_used_at === "string"
        ? row.last_used_at
        : null,
    metadata:
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<
            string,
            unknown
          >)
        : {},
  };
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(null);

  const [session, setSession] =
    useState<Session | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [tenantLoading, setTenantLoading] =
    useState(false);

  const [
    entitlementLoading,
    setEntitlementLoading,
  ] = useState(false);

  const [tenantId, setTenantId] =
    useState<string | null>(null);

  const [tenantName, setTenantName] =
    useState<string | null>(null);

  const [role, setRole] =
    useState<AppRole | null>(null);

  const [permissions, setPermissions] =
    useState<RolePermission[]>([]);

  const [
    subscriptionPlan,
    setSubscriptionPlan,
  ] = useState<string | null>(null);

  const [
    subscriptionStatus,
    setSubscriptionStatus,
  ] = useState<string | null>(null);

  const [billingCycle, setBillingCycle] =
    useState<string | null>(null);

  const [
    currentPeriodStart,
    setCurrentPeriodStart,
  ] = useState<string | null>(null);

  const [
    currentPeriodEnd,
    setCurrentPeriodEnd,
  ] = useState<string | null>(null);

  const [paymentStatus, setPaymentStatus] =
    useState<string | null>(null);

  const [trialStatus, setTrialStatus] =
    useState<string | null>(null);

  const [trialEndsAt, setTrialEndsAt] =
    useState<string | null>(null);

  const [
    workspaceStatus,
    setWorkspaceStatus,
  ] = useState<string | null>(null);

  const [
    onboardingCompleted,
    setOnboardingCompleted,
  ] = useState(false);

  const [
    workspaceAccessStatus,
    setWorkspaceAccessStatus,
  ] =
    useState<WorkspaceAccessStatus>(
      "unknown",
    );

  const [planFeatures, setPlanFeatures] =
    useState<PlanFeature[]>([]);

  const [planLimits, setPlanLimits] =
    useState<PlanLimit[]>([]);

  const [
    moduleEntitlements,
    setModuleEntitlements,
  ] = useState<ModuleEntitlement[]>([]);

  const [capacityUsage, setCapacityUsage] =
    useState<CapacityUsage>(
      EMPTY_CAPACITY_USAGE,
    );

  const userRef = useRef<User | null>(null);
  const sessionRef =
    useRef<Session | null>(null);

  const activeTenantRef =
    useRef<string | null>(null);

  const tenantRequestSequence =
    useRef(0);

  const isWorkspaceActive =
    workspaceAccessStatus === "active" ||
    workspaceAccessStatus ===
      "trial_active";

  const requiresActivation =
    Boolean(user) &&
    Boolean(tenantId) &&
    !isWorkspaceActive &&
    workspaceAccessStatus !== "unknown";

  const safeSetUser = useCallback(
    (value: User | null) => {
      userRef.current = value;

      setUser((previous) =>
        previous?.id === value?.id
          ? previous
          : value,
      );
    },
    [],
  );

  const safeSetSession = useCallback(
    (value: Session | null) => {
      sessionRef.current = value;

      setSession((previous) =>
        previous?.access_token ===
        value?.access_token
          ? previous
          : value,
      );
    },
    [],
  );

  const clearWorkspaceState =
    useCallback(() => {
      activeTenantRef.current = null;

      setTenantId(null);
      setTenantName(null);
      setRole(null);
      setPermissions([]);

      setSubscriptionPlan(null);
      setSubscriptionStatus(null);
      setBillingCycle(null);
      setCurrentPeriodStart(null);
      setCurrentPeriodEnd(null);

      setPaymentStatus(null);
      setTrialStatus(null);
      setTrialEndsAt(null);
      setWorkspaceStatus(null);
      setOnboardingCompleted(false);
      setWorkspaceAccessStatus("unknown");

      setPlanFeatures([]);
      setPlanLimits([]);
      setModuleEntitlements([]);
      setCapacityUsage(
        EMPTY_CAPACITY_USAGE,
      );
    }, []);

  const applyWorkspaceAccessState =
    useCallback((source: any) => {
      const accessStatus =
        resolveWorkspaceAccessStatus({
          paymentStatus:
            source?.paymentStatus ??
            source?.payment_status,

          trialStatus:
            source?.trialStatus ??
            source?.trial_status,

          trialEndsAt:
            source?.trialEndsAt ??
            source?.trial_ends_at,

          workspaceStatus:
            source?.workspaceStatus ??
            source?.workspace_status,

          subscriptionStatus:
            source?.subscriptionStatus ??
            source?.subscription_status,
        });

      setSubscriptionPlan(
        source?.subscriptionPlan ??
          source?.subscription_plan ??
          source?.plan_code ??
          null,
      );

      setSubscriptionStatus(
        source?.subscriptionStatus ??
          source?.subscription_status ??
          null,
      );

      setBillingCycle(
        source?.billingCycle ??
          source?.billing_cycle ??
          null,
      );

      setCurrentPeriodStart(
        source?.currentPeriodStart ??
          source?.current_period_start ??
          null,
      );

      setCurrentPeriodEnd(
        source?.currentPeriodEnd ??
          source?.current_period_end ??
          null,
      );

      setPaymentStatus(
        source?.paymentStatus ??
          source?.payment_status ??
          null,
      );

      setTrialStatus(
        source?.trialStatus ??
          source?.trial_status ??
          null,
      );

      setTrialEndsAt(
        source?.trialEndsAt ??
          source?.trial_ends_at ??
          null,
      );

      setWorkspaceStatus(
        source?.workspaceStatus ??
          source?.workspace_status ??
          null,
      );

      setOnboardingCompleted(
        Boolean(
          source?.onboardingCompleted ??
            source?.onboarding_completed,
        ),
      );

      setWorkspaceAccessStatus(
        accessStatus,
      );

      return accessStatus;
    }, []);

  const applyCachedAuth =
    useCallback(() => {
      const cached =
        (getCachedOfflineAuth() as CachedAuthState | null) ||
        readCachedAuth();

      if (!cached?.user) {
        return false;
      }

      safeSetUser(cached.user);
      safeSetSession(
        cached.session || null,
      );

      activeTenantRef.current =
        cached.tenantId || null;

      setTenantId(
        cached.tenantId || null,
      );

      setTenantName(
        cached.tenantName || null,
      );

      setRole(cached.role || null);

      setPermissions(
        cached.permissions || [],
      );

      applyWorkspaceAccessState(cached);

      setPlanFeatures(
        cached.planFeatures || [],
      );

      setPlanLimits(
        cached.planLimits || [],
      );

      setModuleEntitlements(
        cached.moduleEntitlements || [],
      );

      setCapacityUsage({
        ...EMPTY_CAPACITY_USAGE,
        ...(cached.capacityUsage || {}),
      });

      setLoading(false);
      setTenantLoading(false);
      setEntitlementLoading(false);

      return true;
    }, [
      applyWorkspaceAccessState,
      safeSetSession,
      safeSetUser,
    ]);

  /*
   * The commercial entitlement catalog (plan features/limits, tenant
   * module overrides, capacity usage) isn't served by the backend yet -
   * it depends on the billing/platform-admin tables that land in a later
   * migration phase. Until then this resolves to safe, permissive
   * defaults: `getModuleAccess` already treats an empty `planFeatures`
   * list as "allow everything" (see the `catalog_unavailable` branch
   * below), so no page loses access because of this.
   */
  const loadCommercialEntitlements =
    useCallback(
      async (
        targetTenantId: string,
        _planCode: string | null,
        requestSequence?: number,
      ) => {
        if (
          !targetTenantId ||
          isOfflineMode()
        ) {
          return;
        }

        setEntitlementLoading(true);

        try {
          if (
            (requestSequence === undefined ||
              requestSequence ===
                tenantRequestSequence.current) &&
            activeTenantRef.current ===
              targetTenantId
          ) {
            setPlanFeatures([]);
            setPlanLimits([]);
            setModuleEntitlements([]);
            setCapacityUsage(
              EMPTY_CAPACITY_USAGE,
            );
          }
        } finally {
          if (
            requestSequence === undefined ||
            requestSequence ===
              tenantRequestSequence.current
          ) {
            setEntitlementLoading(false);
          }
        }
      },
      [],
    );

  const loadTenant = useCallback(
    async (
      uid: string,
      activeUser?: User | null,
      activeSession?: Session | null,
    ) => {
      const requestSequence =
        ++tenantRequestSequence.current;

      if (isOfflineMode()) {
        const loaded = applyCachedAuth();

        if (!loaded) {
          clearWorkspaceState();
        }

        setTenantLoading(false);
        setLoading(false);
        return;
      }

      setTenantLoading(true);

      try {
        /*
         * Replaces the old direct tenant_members/tenants/user_roles/
         * tenant_subscriptions/role_permissions Supabase queries with a
         * single call to the new backend's combined session endpoint.
         */
        const me = await authApi.me();

        if (
          requestSequence !==
          tenantRequestSequence.current
        ) {
          return;
        }

        const targetTenantId =
          me.tenant?.id ?? null;

        const tenantRecord =
          me.tenant ?? null;

        const targetTenantName =
          tenantRecord?.name ?? null;

        if (!targetTenantId) {
          clearWorkspaceState();
          return;
        }

        activeTenantRef.current =
          targetTenantId;

        const highestRole =
          normalizeRole(me.role);

        const loadedPermissions =
          (me.permissions ??
            []) as RolePermission[];

        const latestSubscription =
          me.subscription ?? null;

        const combinedAccessRecord = {
          ...tenantRecord,

          subscription_plan:
            latestSubscription?.plan_code ??
            tenantRecord?.subscription_plan ??
            null,

          subscription_status:
            latestSubscription?.status ??
            tenantRecord?.subscription_status ??
            null,

          billing_cycle:
            latestSubscription?.billing_cycle ??
            tenantRecord?.billing_cycle ??
            null,

          current_period_start:
            latestSubscription?.current_period_start ??
            null,

          current_period_end:
            latestSubscription?.current_period_end ??
            null,

          trial_ends_at:
            latestSubscription?.trial_ends_at ??
            tenantRecord?.trial_ends_at ??
            null,
        };

        const nextUser =
          activeUser || userRef.current;

        const nextSession =
          activeSession ||
          sessionRef.current;

        safeSetUser(nextUser || null);
        safeSetSession(
          nextSession || null,
        );

        setTenantId(targetTenantId);
        setTenantName(targetTenantName);
        setRole(highestRole);

        setPermissions((previous) =>
          sameValue(
            previous,
            loadedPermissions,
          )
            ? previous
            : loadedPermissions,
        );

        const accessStatus =
          applyWorkspaceAccessState(
            combinedAccessRecord,
          );

        await loadCommercialEntitlements(
          targetTenantId,
          combinedAccessRecord.subscription_plan,
          requestSequence,
        );

        if (
          requestSequence !==
          tenantRequestSequence.current
        ) {
          return;
        }

        /*
         * Cache after entitlement state has been applied.
         * State values are read from the local variables where
         * possible to avoid stale React-state writes.
         */
        const cached =
          readCachedAuth();

        writeCachedAuth({
          user: nextUser,
          session: nextSession,
          tenantId: targetTenantId,
          tenantName: targetTenantName,
          role: highestRole,
          permissions: loadedPermissions,
          offline: false,

          subscriptionPlan:
            combinedAccessRecord.subscription_plan,

          subscriptionStatus:
            combinedAccessRecord.subscription_status,

          billingCycle:
            combinedAccessRecord.billing_cycle,

          currentPeriodStart:
            combinedAccessRecord.current_period_start,

          currentPeriodEnd:
            combinedAccessRecord.current_period_end,

          paymentStatus:
            combinedAccessRecord.payment_status,

          trialStatus:
            combinedAccessRecord.trial_status,

          trialEndsAt:
            combinedAccessRecord.trial_ends_at,

          workspaceStatus:
            combinedAccessRecord.workspace_status,

          onboardingCompleted:
            Boolean(
              combinedAccessRecord.onboarding_completed,
            ),

          workspaceAccessStatus:
            accessStatus,

          planFeatures:
            cached?.tenantId ===
            targetTenantId
              ? cached.planFeatures || []
              : [],

          planLimits:
            cached?.tenantId ===
            targetTenantId
              ? cached.planLimits || []
              : [],

          moduleEntitlements:
            cached?.tenantId ===
            targetTenantId
              ? cached.moduleEntitlements ||
                []
              : [],

          capacityUsage:
            cached?.tenantId ===
            targetTenantId
              ? cached.capacityUsage ||
                EMPTY_CAPACITY_USAGE
              : EMPTY_CAPACITY_USAGE,
        });

        /*
         * Entitlements are cached again through the effect below
         * when their state values finish updating.
         */
      } catch (error) {
        console.warn(
          "Tenant load failed. Trying cached workspace...",
          error,
        );

        const loaded = applyCachedAuth();

        if (!loaded) {
          clearWorkspaceState();
        }
      } finally {
        if (
          requestSequence ===
          tenantRequestSequence.current
        ) {
          setTenantLoading(false);
          setLoading(false);
        }
      }
    },
    [
      applyCachedAuth,
      applyWorkspaceAccessState,
      clearWorkspaceState,
      loadCommercialEntitlements,
      safeSetSession,
      safeSetUser,
    ],
  );

  const loadOnlineSession =
    useCallback(async () => {
      disableOfflineMode();

      try {
        /*
         * A visitor with no stored tokens is the normal case on a public
         * route - resolve to "signed out" without treating it as an
         * error.
         */
        const onlineSession =
          await authApi.loadSession();

        if (!onlineSession) {
          safeSetSession(null);
          safeSetUser(null);
          clearWorkspaceState();
          setLoading(false);
          return;
        }

        const onlineUser =
          onlineSession.user;

        safeSetSession(onlineSession);
        safeSetUser(onlineUser);

        await loadTenant(
          onlineUser.id,
          onlineUser,
          onlineSession,
        );
      } catch (error) {
        console.warn(
          "Online session load failed. Trying cached authentication...",
          error,
        );

        const loaded = applyCachedAuth();

        if (!loaded) {
          safeSetSession(null);
          safeSetUser(null);
          clearWorkspaceState();
          setLoading(false);
        }
      }
    }, [
      applyCachedAuth,
      clearWorkspaceState,
      loadTenant,
      safeSetSession,
      safeSetUser,
    ]);

  useEffect(() => {
    if (isOfflineMode()) {
      applyCachedAuth();
      setLoading(false);
    } else {
      void loadOnlineSession();
    }

    /*
     * A plain REST API has no equivalent to Supabase's realtime
     * onAuthStateChange push, so the token is instead refreshed
     * proactively on a timer (loadOnlineSession/authApi.loadSession()
     * only actually calls the network when the stored access token is
     * within 5 minutes of expiring or already gone).
     */
    const refreshIntervalId = window.setInterval(
      () => {
        if (
          !isOfflineMode() &&
          sessionRef.current
        ) {
          void loadOnlineSession();
        }
      },
      4 * 60 * 1000,
    );

    const offlineLoginHandler = () => {
      applyCachedAuth();
      setLoading(false);
    };

    const onlineLoginHandler = () => {
      void loadOnlineSession();
    };

    const browserOnlineHandler = () => {
      if (!isOfflineMode()) {
        void loadOnlineSession();
      }
    };

    window.addEventListener(
      "shopcore-offline-login",
      offlineLoginHandler,
    );

    window.addEventListener(
      "shopcore-online-login",
      onlineLoginHandler,
    );

    window.addEventListener(
      "online",
      browserOnlineHandler,
    );

    return () => {
      window.clearInterval(
        refreshIntervalId,
      );

      window.removeEventListener(
        "shopcore-offline-login",
        offlineLoginHandler,
      );

      window.removeEventListener(
        "shopcore-online-login",
        onlineLoginHandler,
      );

      window.removeEventListener(
        "online",
        browserOnlineHandler,
      );
    };
  }, [
    applyCachedAuth,
    clearWorkspaceState,
    loadOnlineSession,
    loadTenant,
    safeSetSession,
    safeSetUser,
  ]);

  useEffect(() => {
    if (!user || !tenantId) {
      return;
    }

    writeCachedAuth({
      user,
      session,
      tenantId,
      tenantName,
      role,
      permissions,
      offline: isOfflineMode(),

      subscriptionPlan,
      subscriptionStatus,
      billingCycle,
      currentPeriodStart,
      currentPeriodEnd,

      paymentStatus,
      trialStatus,
      trialEndsAt,
      workspaceStatus,
      onboardingCompleted,
      workspaceAccessStatus,

      planFeatures,
      planLimits,
      moduleEntitlements,
      capacityUsage,
    });
  }, [
    billingCycle,
    capacityUsage,
    currentPeriodEnd,
    currentPeriodStart,
    moduleEntitlements,
    onboardingCompleted,
    paymentStatus,
    permissions,
    planFeatures,
    planLimits,
    role,
    session,
    subscriptionPlan,
    subscriptionStatus,
    tenantId,
    tenantName,
    trialEndsAt,
    trialStatus,
    user,
    workspaceAccessStatus,
    workspaceStatus,
  ]);

  const signOut = useCallback(async () => {
    tenantRequestSequence.current += 1;

    if (onlineNow()) {
      await authApi.logout().catch(() => {});
    }

    authApi.clearStoredSession();
    clearCachedAuth();
    disableOfflineMode();

    safeSetUser(null);
    safeSetSession(null);
    clearWorkspaceState();

    setLoading(false);
    setTenantLoading(false);
    setEntitlementLoading(false);
  }, [
    clearWorkspaceState,
    safeSetSession,
    safeSetUser,
  ]);

  const refreshTenant =
    useCallback(async () => {
      if (isOfflineMode()) {
        applyCachedAuth();
        return;
      }

      await loadOnlineSession();
    }, [
      applyCachedAuth,
      loadOnlineSession,
    ]);

  const refreshEntitlements =
    useCallback(async () => {
      if (
        isOfflineMode() ||
        !tenantId
      ) {
        applyCachedAuth();
        return;
      }

      await loadCommercialEntitlements(
        tenantId,
        subscriptionPlan,
      );
    }, [
      applyCachedAuth,
      loadCommercialEntitlements,
      subscriptionPlan,
      tenantId,
    ]);

  const planFeatureMap = useMemo(() => {
    const map = new Map<
      string,
      PlanFeature
    >();

    for (const feature of planFeatures) {
      map.set(
        canonicalModuleKey(
          feature.feature_key,
        ),
        feature,
      );
    }

    return map;
  }, [planFeatures]);

  const entitlementMap = useMemo(() => {
    const map = new Map<
      string,
      ModuleEntitlement
    >();

    for (const entitlement of moduleEntitlements) {
      map.set(
        canonicalModuleKey(
          entitlement.module_key,
        ),
        entitlement,
      );
    }

    return map;
  }, [moduleEntitlements]);

  const planLimitMap = useMemo(() => {
    const map = new Map<
      string,
      PlanLimit
    >();

    for (const limit of planLimits) {
      map.set(
        normalizeKey(limit.limit_key),
        limit,
      );
    }

    return map;
  }, [planLimits]);

  const getModuleAccess = useCallback(
    (
      moduleKey: string,
    ): PlanAccessDecision => {
      const canonicalKey =
        canonicalModuleKey(moduleKey);

      if (
        PLATFORM_CORE_MODULES.has(
          canonicalKey,
        )
      ) {
        return {
          allowed: true,
          featureKey: canonicalKey,
          accessLevel: "included",
          source: "platform_core",
          reason: null,
          feature: null,
          entitlement: null,
        };
      }

      const entitlement =
        entitlementMap.get(
          canonicalKey,
        ) || null;

      if (entitlement) {
        const enabled =
          entitlement.status ===
            "enabled" ||
          entitlement.status === "trial";

        return {
          allowed: enabled,
          featureKey: canonicalKey,
          accessLevel: enabled
            ? "included"
            : "unavailable",
          source: "tenant_override",
          reason: enabled
            ? null
            : `The ${entitlement.module_name} module is disabled for this workspace.`,
          feature: null,
          entitlement,
        };
      }

      const feature =
        planFeatureMap.get(canonicalKey) ||
        null;

      if (feature) {
        const allowed =
          feature.access_level ===
            "included" ||
          feature.access_level ===
            "limited";

        return {
          allowed,
          featureKey: canonicalKey,
          accessLevel:
            feature.access_level,
          source: "plan",
          reason: allowed
            ? null
            : feature.access_level ===
                "addon"
              ? `${feature.name} is available as an additional subscription module.`
              : `${feature.name} is not included in the current subscription plan.`,
          feature,
          entitlement: null,
        };
      }

      /*
       * When the commercial catalog is unavailable, preserve
       * existing workspace behavior rather than locking every
       * operational module because of a network or view error.
       *
       * Once a valid catalog has loaded, an unlisted module is
       * treated as unavailable.
       */
      if (planFeatures.length === 0) {
        return {
          allowed: true,
          featureKey: canonicalKey,
          accessLevel: "included",
          source: "catalog_unavailable",
          reason: null,
          feature: null,
          entitlement: null,
        };
      }

      return {
        allowed: false,
        featureKey: canonicalKey,
        accessLevel: "unavailable",
        source: "plan",
        reason:
          "This module is not included in the current commercial edition.",
        feature: null,
        entitlement: null,
      };
    },
    [
      entitlementMap,
      planFeatureMap,
      planFeatures.length,
    ],
  );

  const hasFeature = useCallback(
    (featureKey: string) =>
      getModuleAccess(featureKey).allowed,
    [getModuleAccess],
  );

  const getFeatureAccess = useCallback(
    (
      featureKey: string,
    ): FeatureAccessLevel =>
      getModuleAccess(featureKey)
        .accessLevel,
    [getModuleAccess],
  );

  const canAccessModule = useCallback(
    (moduleKey: string) => {
      if (!isWorkspaceActive) {
        return false;
      }

      return getModuleAccess(
        moduleKey,
      ).allowed;
    },
    [
      getModuleAccess,
      isWorkspaceActive,
    ],
  );

  const canViewModule = useCallback(
    (module: string) => {
      if (!isWorkspaceActive) {
        return false;
      }

      if (
        !getModuleAccess(module).allowed
      ) {
        return false;
      }

      if (
        role === "owner" ||
        role === "admin"
      ) {
        return true;
      }

      const canonicalKey =
        canonicalModuleKey(module);

      return permissions.some(
        (permission) =>
          canonicalModuleKey(
            permission.module,
          ) === canonicalKey &&
          permission.can_view,
      );
    },
    [
      getModuleAccess,
      isWorkspaceActive,
      permissions,
      role,
    ],
  );

  const getLimit = useCallback(
    (limitKey: string) =>
      planLimitMap.get(
        normalizeKey(limitKey),
      ) || null,
    [planLimitMap],
  );

  const getUsage = useCallback(
    (limitKey: string) => {
      const key =
        normalizeKey(limitKey);

      switch (key) {
        case "users":
          return capacityUsage.users;

        case "branches":
          return capacityUsage.branches;

        case "warehouses":
          return capacityUsage.warehouses;

        case "products":
          return capacityUsage.products;

        case "pos_terminals":
          return capacityUsage.pos_terminals;

        case "desktop_devices":
          return capacityUsage.desktop_devices;

        case "storage_gb":
          return capacityUsage.storage_gb;

        case "monthly_transactions":
          return capacityUsage.monthly_transactions;

        default:
          return 0;
      }
    },
    [capacityUsage],
  );

  const getRemainingCapacity =
    useCallback(
      (
        limitKey: string,
      ): number | null => {
        const limit =
          getLimit(limitKey);

        if (!limit) {
          /*
           * No limit record means the catalog has not defined
           * a restriction for this resource.
           */
          return null;
        }

        if (limit.is_unlimited) {
          return null;
        }

        if (limit.value === null) {
          return 0;
        }

        return Math.max(
          limit.value -
            getUsage(limitKey),
          0,
        );
      },
      [getLimit, getUsage],
    );

  const isAtLimit = useCallback(
    (limitKey: string) => {
      const limit =
        getLimit(limitKey);

      if (
        !limit ||
        limit.is_unlimited
      ) {
        return false;
      }

      if (limit.value === null) {
        return true;
      }

      return (
        getUsage(limitKey) >= limit.value
      );
    },
    [getLimit, getUsage],
  );

  const canUseCapacity = useCallback(
    (
      featureKey: string,
      limitKey: string,
    ) =>
      isWorkspaceActive &&
      hasFeature(featureKey) &&
      !isAtLimit(limitKey),
    [
      hasFeature,
      isAtLimit,
      isWorkspaceActive,
    ],
  );

  const canInviteUser = useCallback(
    () =>
      canUseCapacity(
        "user_management",
        "users",
      ),
    [canUseCapacity],
  );

  const canCreateBranch = useCallback(
    () =>
      canUseCapacity(
        "branches",
        "branches",
      ),
    [canUseCapacity],
  );

  const canCreateWarehouse =
    useCallback(
      () =>
        canUseCapacity(
          "warehouses",
          "warehouses",
        ),
      [canUseCapacity],
    );

  const canRegisterPOSTerminal =
    useCallback(
      () =>
        canUseCapacity(
          "pos",
          "pos_terminals",
        ),
      [canUseCapacity],
    );

  const canRegisterDesktopDevice =
    useCallback(
      () =>
        isWorkspaceActive &&
        !isAtLimit(
          "desktop_devices",
        ),
      [
        isAtLimit,
        isWorkspaceActive,
      ],
    );

  const canCreateProduct = useCallback(
    () =>
      canUseCapacity(
        "products",
        "products",
      ),
    [canUseCapacity],
  );

  const bootstrapping =
    loading ||
    Boolean(user && tenantLoading);

  const contextValue =
    useMemo<AuthContextType>(
      () => ({
        user,
        session,
        loading,
        bootstrapping,
        entitlementLoading,

        tenantId,
        tenantName,
        role,
        permissions,

        subscriptionPlan,
        subscriptionStatus,
        billingCycle,
        currentPeriodStart,
        currentPeriodEnd,

        paymentStatus,
        trialStatus,
        trialEndsAt,
        workspaceStatus,
        onboardingCompleted,

        workspaceAccessStatus,
        isWorkspaceActive,
        requiresActivation,

        planFeatures,
        planLimits,
        moduleEntitlements,
        capacityUsage,

        signOut,
        refreshTenant,
        refreshEntitlements,

        canViewModule,
        canAccessModule,
        getModuleAccess,

        hasFeature,
        getFeatureAccess,

        getLimit,
        getUsage,
        getRemainingCapacity,
        isAtLimit,

        canInviteUser,
        canCreateBranch,
        canCreateWarehouse,
        canRegisterPOSTerminal,
        canRegisterDesktopDevice,
        canCreateProduct,
      }),
      [
        billingCycle,
        bootstrapping,
        canAccessModule,
        canCreateBranch,
        canCreateProduct,
        canCreateWarehouse,
        canInviteUser,
        canRegisterDesktopDevice,
        canRegisterPOSTerminal,
        canViewModule,
        capacityUsage,
        currentPeriodEnd,
        currentPeriodStart,
        entitlementLoading,
        getFeatureAccess,
        getLimit,
        getModuleAccess,
        getRemainingCapacity,
        getUsage,
        hasFeature,
        isAtLimit,
        isWorkspaceActive,
        loading,
        moduleEntitlements,
        onboardingCompleted,
        paymentStatus,
        permissions,
        planFeatures,
        planLimits,
        refreshEntitlements,
        refreshTenant,
        requiresActivation,
        role,
        session,
        signOut,
        subscriptionPlan,
        subscriptionStatus,
        tenantId,
        tenantName,
        trialEndsAt,
        trialStatus,
        user,
        workspaceAccessStatus,
        workspaceStatus,
      ],
    );

  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default useAuth;
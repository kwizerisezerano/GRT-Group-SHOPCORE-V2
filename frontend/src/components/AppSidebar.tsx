import {
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Box,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CreditCard,
  Database,
  FileText,
  Heart,
  HelpCircle,
  History,
  Layers,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Monitor,
  Package,
  Receipt,
  RefreshCcw,
  Ruler,
  ServerCog,
  Settings,
  Shield,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
  Warehouse,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { decryptData } from "@/lib/encryption";

import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { syncOfflineData } from "@/lib/syncOfflineData";
import {
  isNetworkError,
  isOnline,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

type NavItem = {
  titleKey: string;
  url: string;
  icon: ElementType;

  feature: string;
  roleModule: string;

  requiredPlan?: string;
  core?: boolean;
  showWhenLocked?: boolean;
};

type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

type ResolvedNavItem = NavItem & {
  locked: boolean;
  allowedByPlan: boolean;
  allowedByRole: boolean;
  accessReason: string | null;
};

const navGroups: NavGroup[] = [
  {
    labelKey: "sidebar.groups.overview",
    items: [
      {
        titleKey: "navigation.dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
        feature: "dashboard",
        roleModule: "dashboard",
        core: true,
      },
    ],
  },
  {
    labelKey: "sidebar.groups.catalog",
    items: [
      {
        titleKey: "navigation.products",
        url: "/products",
        icon: Package,
        feature: "products",
        roleModule: "products",
      },
      {
        titleKey: "navigation.categories",
        url: "/categories",
        icon: Tags,
        feature: "categories",
        roleModule: "products",
      },
      {
        titleKey: "navigation.brands",
        url: "/brands",
        icon: Layers,
        feature: "brands",
        roleModule: "products",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.units",
        url: "/units",
        icon: Ruler,
        feature: "units",
        roleModule: "products",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
    ],
  },
  {
    labelKey: "sidebar.groups.inventory",
    items: [
      {
        titleKey: "navigation.stockOverview",
        url: "/inventory",
        icon: Warehouse,
        feature: "inventory_basic",
        roleModule: "inventory",
      },
      {
        titleKey: "navigation.adjustments",
        url: "/stock-adjustments",
        icon: Activity,
        feature: "inventory_advanced",
        roleModule: "inventory",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.transfers",
        url: "/transfers",
        icon: ArrowLeftRight,
        feature: "stock_transfers",
        roleModule: "inventory",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.stockCounts",
        url: "/stock-counts",
        icon: Box,
        feature: "inventory_advanced",
        roleModule: "inventory",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.movementHistory",
        url: "/stock-movements",
        icon: History,
        feature: "inventory_advanced",
        roleModule: "inventory",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
    ],
  },
  {
    labelKey: "sidebar.groups.sales",
    items: [
      {
        titleKey: "navigation.pos",
        url: "/pos",
        icon: Monitor,
        feature: "pos",
        roleModule: "pos",
      },
      {
        titleKey: "navigation.sales",
        url: "/sales",
        icon: Receipt,
        feature: "sales",
        roleModule: "sales",
      },
      {
        titleKey: "navigation.quotations",
        url: "/quotations",
        icon: FileText,
        feature: "quotations",
        roleModule: "sales",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
    ],
  },
  {
    labelKey: "sidebar.groups.procurement",
    items: [
      {
        titleKey: "navigation.purchases",
        url: "/purchases",
        icon: ShoppingCart,
        feature: "purchases",
        roleModule: "purchases",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.suppliers",
        url: "/suppliers",
        icon: Truck,
        feature: "suppliers",
        roleModule: "suppliers",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
    ],
  },
  {
    labelKey: "sidebar.groups.people",
    items: [
      {
        titleKey: "navigation.customers",
        url: "/customers",
        icon: Users,
        feature: "customers",
        roleModule: "customers",
      },
      {
        titleKey: "navigation.loyalty",
        url: "/loyalty",
        icon: Heart,
        feature: "loyalty",
        roleModule: "loyalty",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.staff",
        url: "/staff",
        icon: UserCog,
        feature: "staff",
        roleModule: "staff",
        requiredPlan: "Business Plus",
        showWhenLocked: true,
      },
    ],
  },
  {
    labelKey: "sidebar.groups.finance",
    items: [
      {
        titleKey: "navigation.expenses",
        url: "/expenses",
        icon: CreditCard,
        feature: "expenses",
        roleModule: "expenses",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.reports",
        url: "/reports",
        icon: BarChart3,
        feature: "reports_basic",
        roleModule: "reports",
      },
    ],
  },
  {
    labelKey: "sidebar.groups.organization",
    items: [
      {
        titleKey: "navigation.branches",
        url: "/branches",
        icon: Building2,
        feature: "branches",
        roleModule: "branches",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.warehouses",
        url: "/warehouses",
        icon: Store,
        feature: "warehouses",
        roleModule: "warehouses",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
    ],
  },
  {
    labelKey: "sidebar.groups.collaboration",
    items: [
      {
        titleKey: "navigation.workspaceChat",
        url: "/workspace-chat",
        icon: MessageCircle,
        feature: "workspace",
        roleModule: "dashboard",
        requiredPlan: "Business Plus",
        showWhenLocked: true,
      },
    ],
  },
  {
    labelKey: "sidebar.groups.system",
    items: [
      {
        titleKey: "navigation.workspace",
        url: "/workspace",
        icon: Building2,
        feature: "settings",
        roleModule: "settings",
        core: true,
      },
      {
        titleKey: "navigation.notifications",
        url: "/notifications",
        icon: Bell,
        feature: "notifications",
        roleModule: "dashboard",
        core: true,
      },
      {
        titleKey: "navigation.billing",
        url: "/billing",
        icon: CreditCard,
        feature: "billing",
        roleModule: "settings",
        core: true,
      },
      {
        titleKey: "navigation.support",
        url: "/support",
        icon: HelpCircle,
        feature: "support",
        roleModule: "dashboard",
        core: true,
      },
      {
        titleKey: "navigation.settings",
        url: "/settings",
        icon: Settings,
        feature: "settings",
        roleModule: "settings",
        core: true,
      },
      {
        titleKey: "navigation.ebmSetup",
        url: "/ebm-settings",
        icon: ServerCog,
        feature: "ebm",
        roleModule: "settings",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.activityLogs",
        url: "/activity-logs",
        icon: Shield,
        feature: "audit_logs",
        roleModule: "activity_logs",
        requiredPlan: "Business Plus",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.qa",
        url: "/qa",
        icon: Database,
        feature: "qa",
        roleModule: "qa",
        core: true,
      },
      {
        titleKey: "navigation.userManagement",
        url: "/user-management",
        icon: UserCog,
        feature: "user_management",
        roleModule: "staff",
        core: true,
      },
    ],
  },
];

function normalizeKey(value: string | null | undefined) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "") || ""
  );
}

function formatPlanName(
  value: string | null | undefined,
  fallback: string,
) {
  if (!value) {
    return fallback;
  }

  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isRouteActive(pathname: string, itemUrl: string) {
  const cleanUrl = itemUrl.split("?")[0];

  if (cleanUrl === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/";
  }

  return pathname === cleanUrl || pathname.startsWith(`${cleanUrl}/`);
}

function isUsableOnline() {
  return isOnline() && !isOfflineMode();
}

async function hasRealSupabaseSession() {
  if (!isUsableOnline()) {
    return false;
  }

  try {
    const { data } = await supabase.auth.getSession();

    if (data.session?.access_token) {
      return true;
    }

    const refreshed = await supabase.auth.refreshSession();

    return Boolean(refreshed.data.session?.access_token);
  } catch {
    return false;
  }
}

export function AppSidebar() {
  const { state } = useSidebar();
  const { t } = useLanguage();
  const collapsed = state === "collapsed";

  const location = useLocation();
  const navigate = useNavigate();

  const {
    user,
    signOut,
    role,
    permissions,
    tenantName,
    subscriptionPlan,
    workspaceAccessStatus,
    getModuleAccess,
  } = useAuth();

  const [isOnlineState, setIsOnlineState] = useState(isUsableOnline());
  const [syncing, setSyncing] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [lastSyncOk, setLastSyncOk] = useState<boolean | null>(null);

  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
  }>({
    display_name: null,
    avatar_url: null,
  });

  useEffect(() => {
    const updateOnlineState = () => {
      setIsOnlineState(isUsableOnline());
    };

    const handleSyncComplete = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail || {};
      const failed = Number(detail.failed || 0);
      const synced = Number(detail.synced || detail.count || 0);

      if (failed > 0) {
        setLastSyncOk(false);
        setLastSyncMessage(
          t("sidebar.recordsNeedAttention", { count: failed }),
        );
        setIsOnlineState(isUsableOnline());
        return;
      }

      setLastSyncOk(true);
      setLastSyncMessage(
        synced > 0
          ? t("sidebar.recordsSynchronized", { count: synced })
          : t("sidebar.allRecordsCurrent"),
      );

      setIsOnlineState(isUsableOnline());
    };

    const handleSyncFailed = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail || {};
      const failed = Number(detail.failed || 0);

      setLastSyncOk(false);
      setLastSyncMessage(
        failed > 0
          ? t("sidebar.recordsNeedAttention", { count: failed })
          : t("sync.failed"),
      );

      setIsOnlineState(isUsableOnline());
    };

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    window.addEventListener("shopcore-online-login", updateOnlineState);
    window.addEventListener("shopcore-offline-login", updateOnlineState);
    window.addEventListener(
      "shopcore-sync-success",
      handleSyncComplete as EventListener,
    );
    window.addEventListener(
      "shopcore-sync-failed",
      handleSyncFailed as EventListener,
    );
    window.addEventListener(
      "shopcore-offline-sync-complete",
      handleSyncComplete as EventListener,
    );

    const interval = window.setInterval(updateOnlineState, 5000);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
      window.removeEventListener(
        "shopcore-online-login",
        updateOnlineState,
      );
      window.removeEventListener(
        "shopcore-offline-login",
        updateOnlineState,
      );
      window.removeEventListener(
        "shopcore-sync-success",
        handleSyncComplete as EventListener,
      );
      window.removeEventListener(
        "shopcore-sync-failed",
        handleSyncFailed as EventListener,
      );
      window.removeEventListener(
        "shopcore-offline-sync-complete",
        handleSyncComplete as EventListener,
      );

      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfile({
        display_name: null,
        avatar_url: null,
      });
      return;
    }

    const cacheKey = `shopcore_profile_${user.id}`;
    const cachedProfile = localStorage.getItem(cacheKey);

    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);

        setProfile((current) =>
          current.display_name === parsed.display_name &&
          current.avatar_url === parsed.avatar_url
            ? current
            : parsed,
        );
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    if (!isUsableOnline()) {
      setIsOnlineState(false);
      return;
    }

    let mounted = true;

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (mounted && data) {
          const decryptedData = {
            display_name: decryptData(data.display_name || '') || '',
            avatar_url: data.avatar_url,
          };
          setProfile(decryptedData);
          localStorage.setItem(cacheKey, JSON.stringify(decryptedData));
          setIsOnlineState(true);
        }
      } catch (error) {
        if (isNetworkError(error)) {
          setIsOnlineState(false);
        }
      }
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const displayName =
    profile.display_name ||
    user?.email ||
    t("sidebar.workspaceUser");

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleCanView = useMemo(() => {
    return (module: string) => {
      if (role === "owner" || role === "admin") {
        return true;
      }

      const normalizedModule = normalizeKey(module);

      return permissions.some(
        (permission) =>
          normalizeKey(permission.module) === normalizedModule &&
          permission.can_view,
      );
    };
  }, [permissions, role]);

  const visibleGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        const items = group.items
          .map((item): ResolvedNavItem | null => {
            const allowedByRole = item.core || roleCanView(item.roleModule);

            if (!allowedByRole) {
              return null;
            }

            const planDecision = getModuleAccess(item.feature);
            const allowedByPlan = item.core || planDecision.allowed;

            if (!allowedByPlan && !item.showWhenLocked) {
              return null;
            }

            return {
              ...item,
              allowedByRole,
              allowedByPlan,
              locked: !allowedByPlan,
              accessReason: planDecision.reason,
            };
          })
          .filter(Boolean) as ResolvedNavItem[];

        return {
          ...group,
          items,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [getModuleAccess, roleCanView]);

  const lockedModuleCount = useMemo(
    () =>
      visibleGroups.reduce(
        (total, group) =>
          total + group.items.filter((item) => item.locked).length,
        0,
      ),
    [visibleGroups],
  );

  const handleSyncData = async () => {
    if (isOfflineMode()) {
      setIsOnlineState(false);
      toast.warning(t("sidebar.onlineLoginRequiredBeforeSync"));
      return;
    }

    if (!isOnline()) {
      setIsOnlineState(false);
      toast.error(
        t("sidebar.connectionNotReady"),
      );
      return;
    }

    setSyncing(true);

    try {
      const hasSession = await hasRealSupabaseSession();

      if (!hasSession) {
        toast.warning(t("sidebar.onlineLoginRequiredBeforeSync"));
        return;
      }

      const result = await syncOfflineData();

      if (result.failed > 0) {
        setLastSyncOk(false);
        setLastSyncMessage(
          t("sidebar.recordsNeedAttention", { count: result.failed }),
        );

        window.dispatchEvent(
          new CustomEvent("shopcore-sync-failed", {
            detail: result,
          }),
        );

        toast.error(
          t("sync.failedCount", { count: result.failed }),
          {
            duration: 9000,
          },
        );

        console.error(
          "Synchronization details:",
          JSON.stringify(result.errors, null, 2),
        );

        return;
      }

      setLastSyncOk(true);

      setLastSyncMessage(
        result.synced > 0
          ? t("sidebar.recordsSynchronized", { count: result.synced })
          : t("sidebar.allRecordsCurrent"),
      );

      window.dispatchEvent(
        new CustomEvent("shopcore-sync-success", {
          detail: result,
        }),
      );

      toast.success(
        result.synced > 0
          ? t("sync.success", { count: result.synced })
          : t("sidebar.allOfflineSynchronized"),
        {
          duration: 9000,
        },
      );
    } catch (error) {
      if (isNetworkError(error)) {
        setIsOnlineState(false);
        setLastSyncOk(false);
        setLastSyncMessage(t("sidebar.connectionUnavailable"));

        toast.error(
          t("sidebar.connectionUnavailableDescription"),
        );

        return;
      }

      setLastSyncOk(false);
      setLastSyncMessage(t("sync.failed"));
      toast.error(t("sync.failed"));

      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-2 py-4">
        <div className="flex items-center gap-1 px-1">
          <img
            src="/shopcore-icon.png"
            alt="ShopCore"
            className="h-14 w-14 shrink-0 object-contain"
          />

          {!collapsed ? (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-lg font-extrabold text-sidebar-primary">
                ShopCore
              </span>

              <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
                Business Operating System
              </span>
            </div>
          ) : null}
        </div>

        {!collapsed ? (
          <div className="mt-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-3">
            <div className="flex items-center gap-2 text-[11px] font-black text-sidebar-primary">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Operations Workspace
            </div>

            <p className="mt-1 truncate text-[10px] font-medium text-sidebar-muted">
              {tenantName || t("layout.primaryWorkspace")}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigate("/billing")}
                className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2 text-left"
              >
                <p className="text-[8px] font-black uppercase tracking-wide text-violet-300">
                  Edition
                </p>

                <p className="mt-1 truncate text-[10px] font-black text-sidebar-primary">
                  {formatPlanName(subscriptionPlan, t("sidebar.planPending"))}
                </p>
              </button>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2">
                <p className="text-[8px] font-black uppercase tracking-wide text-emerald-300">
                  Access
                </p>

                <p className="mt-1 truncate text-[10px] font-black text-sidebar-primary">
                  {formatPlanName(workspaceAccessStatus, t("status.pending"))}
                </p>
              </div>
            </div>

            {!isOnlineState ? (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-2 py-1.5 text-[10px] font-bold text-orange-300">
                <WifiOff className="h-3.5 w-3.5" />
                Offline continuity active
              </div>
            ) : null}

            {lastSyncMessage ? (
              <div
                className={[
                  "mt-2 rounded-xl border px-2 py-1.5 text-[10px] font-bold",
                  lastSyncOk
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                    : "border-rose-500/20 bg-rose-500/10 text-rose-300",
                ].join(" ")}
              >
                {lastSyncMessage}
              </div>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3 h-8 w-full rounded-xl text-xs font-black"
              onClick={() => void handleSyncData()}
              disabled={syncing}
            >
              <RefreshCcw
                className={[
                  "mr-2 h-3.5 w-3.5",
                  syncing ? "animate-spin" : "",
                ].join(" ")}
              />

              {syncing
                ? t("sync.syncing")
                : isOfflineMode()
                  ? t("sidebar.onlineLoginRequired")
                  : t("sidebar.synchronizeData")}
            </Button>

            {lockedModuleCount > 0 ? (
              <button
                type="button"
                onClick={() => navigate("/billing")}
                className="mt-2 flex w-full items-center justify-between rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <LockKeyhole className="h-3.5 w-3.5 text-orange-300" />

                  <span className="text-[10px] font-black text-orange-200">
                    {t("sidebar.upgradeOptions", {
                      count: lockedModuleCount,
                    })}
                  </span>
                </div>

                <Zap className="h-3.5 w-3.5 text-orange-300" />
              </button>
            ) : null}
          </div>
        ) : null}
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {visibleGroups.map((group) => (
          <Collapsible key={t(group.labelKey)} defaultOpen>
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                  {!collapsed ? (
                    <>
                      <span>{t(group.labelKey)}</span>
                      <ChevronDown className="h-3 w-3" />
                    </>
                  ) : null}
                </SidebarGroupLabel>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const active = isRouteActive(
                        location.pathname,
                        item.url,
                      );

                      const itemTitle = t(item.titleKey);

                      const tooltip = item.locked
                        ? `${itemTitle} · ${t("sidebar.requiresPlan", {
                            plan:
                              item.requiredPlan ||
                              t("sidebar.upgradedPlan"),
                          })}`
                        : itemTitle;

                      return (
                        <SidebarMenuItem
                          key={`${t(group.labelKey)}-${t(item.titleKey)}`}
                        >
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={tooltip}
                          >
                            <NavLink
                              to={item.url}
                              end={false}
                              className={[
                                "group/nav relative text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                item.locked ? "opacity-75" : "",
                              ].join(" ")}
                              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                            >
                              <item.icon className="h-4 w-4 shrink-0" />

                              {!collapsed ? (
                                <>
                                  <span className="min-w-0 flex-1 truncate text-sm">
                                    {t(item.titleKey)}
                                  </span>

                                  {item.locked ? (
                                    <div className="ml-auto flex items-center gap-1">
                                      {item.requiredPlan ? (
                                        <span className="hidden max-w-20 truncate rounded-full border border-orange-400/20 bg-orange-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-orange-300 xl:inline-flex">
                                          {item.requiredPlan}
                                        </span>
                                      ) : null}

                                      <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-orange-600" />
                                    </div>
                                  ) : null}
                                </>
                              ) : null}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div
          className="flex cursor-pointer items-center gap-2 rounded-2xl p-2 transition hover:bg-sidebar-accent"
          onClick={() => navigate("/profile")}
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile.avatar_url || undefined} />

            <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          {!collapsed ? (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-semibold text-sidebar-primary">
                  {displayName}
                </span>

                <span className="truncate text-[10px] text-sidebar-muted">
                  {(role ?? "viewer").toUpperCase()}
                  {tenantName ? ` · ${tenantName}` : ""}
                </span>
              </div>

              <button
                type="button"
                className="rounded-lg p-1 text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  void signOut();
                }}
                title={t("sidebar.signOut")}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
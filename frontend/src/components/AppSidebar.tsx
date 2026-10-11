import {
  useMemo,
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
  ChevronRight,
  CreditCard,
  Database,
  FileText,
  Heart,
  HelpCircle,
  History,
  Layers,
  LayoutDashboard,
  LockKeyhole,
  MessageCircle,
  Monitor,
  Package,
  Receipt,
  Ruler,
  ServerCog,
  Settings,
  Shield,
  ShieldOff,
  Sparkles,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
  Warehouse,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  isWorkspaceLocked,
  LOCKED_REACHABLE_ROUTES,
} from "@/lib/workspaceLock";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";


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

import {
} from "@/lib/offlineStore";

type NavItem = {
  titleKey: string;
  url: string;
  icon: ElementType;

  /** Subscription feature key, for the plan lock. Not a permission. */
  feature: string;

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
      },
      {
        titleKey: "navigation.categories",
        url: "/categories",
        icon: Tags,
        feature: "categories",
      },
      {
        titleKey: "navigation.brands",
        url: "/brands",
        icon: Layers,
        feature: "brands",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.units",
        url: "/units",
        icon: Ruler,
        feature: "units",
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
      },
      {
        titleKey: "navigation.adjustments",
        url: "/stock-adjustments",
        icon: Activity,
        feature: "inventory_advanced",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.transfers",
        url: "/transfers",
        icon: ArrowLeftRight,
        feature: "stock_transfers",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.stockCounts",
        url: "/stock-counts",
        icon: Box,
        feature: "inventory_advanced",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.movementHistory",
        url: "/stock-movements",
        icon: History,
        feature: "inventory_advanced",
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
      },
      {
        titleKey: "navigation.sales",
        url: "/sales",
        icon: Receipt,
        feature: "sales",
      },
      {
        titleKey: "navigation.quotations",
        url: "/quotations",
        icon: FileText,
        feature: "quotations",
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
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.suppliers",
        url: "/suppliers",
        icon: Truck,
        feature: "suppliers",
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
      },
      {
        titleKey: "navigation.loyalty",
        url: "/loyalty",
        icon: Heart,
        feature: "loyalty",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.staff",
        url: "/staff",
        icon: UserCog,
        feature: "staff",
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
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.reports",
        url: "/reports",
        icon: BarChart3,
        feature: "reports_basic",
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
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.warehouses",
        url: "/warehouses",
        icon: Store,
        feature: "warehouses",
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
        core: true,
      },
      {
        titleKey: "navigation.notifications",
        url: "/notifications",
        icon: Bell,
        feature: "notifications",
        core: true,
      },
      {
        titleKey: "navigation.billing",
        url: "/billing",
        icon: CreditCard,
        feature: "billing",
        core: true,
      },
      {
        titleKey: "navigation.support",
        url: "/support",
        icon: HelpCircle,
        feature: "support",
        core: true,
      },
      {
        titleKey: "navigation.settings",
        url: "/settings",
        icon: Settings,
        feature: "settings",
        core: true,
      },
      {
        titleKey: "navigation.ebmSetup",
        url: "/ebm-settings",
        icon: ServerCog,
        feature: "ebm",
        requiredPlan: "Professional",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.activityLogs",
        url: "/activity-logs",
        icon: Shield,
        feature: "audit_logs",
        requiredPlan: "Business Plus",
        showWhenLocked: true,
      },
      {
        titleKey: "navigation.qa",
        url: "/qa",
        icon: Database,
        feature: "qa",
        core: true,
      },
      {
        titleKey: "navigation.userManagement",
        url: "/user-management",
        icon: UserCog,
        feature: "user_management",
        core: true,
      },
    ],
  },
];

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

export function AppSidebar() {
  const { state } = useSidebar();
  const { t } = useLanguage();
  const collapsed = state === "collapsed";

  const location = useLocation();
  const navigate = useNavigate();

  const {
    subscriptionPlan,
    workspaceAccessStatus,
    getModuleAccess,
    isPlatformAdmin,
  } = useAuth();

  /*
   * The permission list comes from `usePermissions`, not from `useAuth`.
   * `useAuth` carries the snapshot taken by `/auth/me`, which only refreshes
   * when the workspace reloads; `usePermissions` re-asks the server on mount
   * and whenever the connection returns, and falls back to the cached answer
   * for this exact user and workspace when offline. Reading the two different
   * lists in the menu and in the route guard is what made a sidebar entry open
   * a page that then said "no permission".
   */
  const { canSeeRoute, ready: permissionsReady } = usePermissions();

  /*
   * A nav item's module comes from its own `url`, resolved through the same
   * table `RoleGate` uses. It used to be a `roleModule` field written by hand
   * on each item, which is how the menu ended up gating Activity Logs on
   * `activity_logs` while the server grants `activity.view` — the permission
   * was held, the menu was hidden, and the page refused. There is nothing left
   * to keep in sync now: the menu entry and the page it opens are judged by
   * one lookup on one map.
   *
   * There is deliberately no owner/admin shortcut here. A workspace can revoke
   * a permission from any role it outranks, and the server honours that; a
   * shortcut in the menu would show an admin a screen their own workspace had
   * taken away from them, and the API would then refuse every request on it.
   */
  /*
   * While the workspace is shut — unpaid, expired, suspended — the menu is
   * trimmed to the handful of screens that still do anything: the one that
   * fixes it, the one that explains it, and the person's own account.
   *
   * Showing the full menu would be twenty links that all land on the same
   * lock panel; hiding the menu entirely would strand them with no route to
   * billing at all. This is the middle, and it is the reason a failed payment
   * is recoverable without contacting anyone.
   */
  const workspaceLocked = isWorkspaceLocked(workspaceAccessStatus);

  const visibleGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        const items = group.items
          .map((item): ResolvedNavItem | null => {
            if (workspaceLocked && !LOCKED_REACHABLE_ROUTES.includes(item.url)) {
              return null;
            }

            // By path, not by module: /billing wants `settings.billing`
            // specifically, and asking the module would show it to anyone who
            // could merely read the workspace name.
            const allowedByRole = canSeeRoute(item.url);

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
  }, [canSeeRoute, getModuleAccess, workspaceLocked]);

  const lockedModuleCount = useMemo(
    () =>
      visibleGroups.reduce(
        (total, group) =>
          total + group.items.filter((item) => item.locked).length,
        0,
      ),
    [visibleGroups],
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-2 py-3">
        <div className="flex items-center gap-2 px-1">
          <img
            src="/shopcore-icon.png"
            alt="ShopCore"
            className="h-9 w-9 shrink-0 object-contain"
          />

          {!collapsed ? (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-base font-extrabold text-sidebar-primary">
                ShopCore
              </span>

              <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
                Business Operating System
              </span>
            </div>
          ) : null}
        </div>

        {/*
          The workspace's plan, and the one action attached to it.

          This panel was four nested boxes of `font-black` 10px type — a
          heading, the workspace name, an Edition/Access pair, a sync button and
          an upgrade banner — stacked in the space of two rows. It competed with
          the navigation it sits above for no good reason: none of it is
          something you act on often.

          What survives is what a person actually looks for: which plan this
          workspace is on, and how to change it. The workspace name is already
          in the header above, and "Access" repeated the plan in different
          words.
        */}
        {!collapsed ? (
          <button
            type="button"
            onClick={() => navigate("/billing")}
            className="mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border/70 px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
              <BriefcaseBusiness className="h-3.5 w-3.5 text-sidebar-primary" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-sidebar-muted">
                {t("sidebar.plan")}
              </span>
              <span className="block truncate text-xs font-semibold text-sidebar-foreground">
                {formatPlanName(subscriptionPlan, t("sidebar.planPending"))}
              </span>
            </span>

            {lockedModuleCount > 0 ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                {t("sidebar.upgrade")}
              </span>
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" />
            )}
          </button>
        ) : null}
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {/*
          Before the first answer arrives there is nothing honest to draw: an
          empty menu reads as "you have no access" and a full one is a promise
          the pages will not keep. A few placeholder rows say "loading", which
          is what is actually true. Returning users skip this entirely — the
          cached answer for this user and workspace is read synchronously.
        */}
        {!permissionsReady && visibleGroups.length === 0
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`nav-skeleton-${index}`}
                className="mx-2 my-1 h-8 animate-pulse rounded-lg bg-sidebar-accent/40"
              />
            ))
          : null}

        {/*
          A role can legitimately hold nothing — an owner revoking a role's
          access is a supported act, not an error state. What must not happen
          is a blank panel: an empty sidebar is indistinguishable from one that
          failed to load, and the person staring at it has no way to tell
          whether to wait, refresh, or ask somebody. So it says which of the
          two this is, and who can undo it.
        */}
        {permissionsReady && visibleGroups.length === 0 ? (
          <div className="mx-2 my-3 rounded-xl border border-dashed border-sidebar-border p-4 text-center">
            <ShieldOff className="mx-auto mb-2 h-5 w-5 text-sidebar-muted" />
            {!collapsed ? (
              <>
                <p className="text-xs font-medium text-sidebar-foreground">
                  {t("sidebar.noModules.title")}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-sidebar-muted">
                  {t("sidebar.noModules.body")}
                </p>
              </>
            ) : null}
          </div>
        ) : null}

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

                      /*
                        Locked rows point at the upgrade page rather than at a
                        module the plan does not include — following one used to
                        land on a screen whose only possible answer was "no".
                      */
                      const target = item.locked ? "/billing" : item.url;

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
                              to={target}
                              end={false}
                              className={[
                                "group/nav relative text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                item.locked ? "text-sidebar-muted" : "",
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
                                    <span className="ml-auto flex shrink-0 items-center gap-1">
                                      {/*
                                        The lock states the fact; "Upgrade"
                                        appears on hover to say what to do about
                                        it, in the same place rather than as a
                                        second badge competing for the row.
                                      */}
                                      <span className="hidden items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary group-hover/nav:inline-flex">
                                        <Sparkles className="h-2.5 w-2.5" />
                                        {t("sidebar.upgrade")}
                                      </span>

                                      <LockKeyhole className="h-3.5 w-3.5 shrink-0 group-hover/nav:hidden" />
                                    </span>
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

      {/*
        The way into the platform console.

        `isPlatformAdmin` existed only as a route guard, so an operator who
        signed in landed in an ordinary shop workspace with nothing anywhere
        in the interface pointing at /platform-admin — the console was
        reachable only by typing the URL. A permission nobody can find is a
        permission nobody has.

        In the footer rather than the module list because it is not a module:
        it leaves this workspace entirely for the operator view over every
        tenant, and grouping it with Sales or Inventory would suggest
        otherwise. Rendered for nobody else.
      */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {isPlatformAdmin && (
          <NavLink
            to="/platform-admin"
            className="group flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-sidebar-accent"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-sidebar-foreground">
                Platform console
              </span>
              <span className="block truncate text-[11px] text-sidebar-muted">
                All tenants and billing
              </span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-sidebar-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </NavLink>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}